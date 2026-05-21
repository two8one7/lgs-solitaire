/**
 * input-system — owns Selection and commits moves.
 *
 * Listens for LocationTap events fired by the render layer. Selection lifecycle:
 *   1. No selection + tap on tableau/waste/foundation top → if tappable, set
 *      selection to that location.
 *   2. Selection set + tap on a legal destination → execute move via the
 *      injected move-executor. Always clears selection afterward.
 *   3. Selection set + tap on the same location → deselect.
 *   4. Selection set + tap elsewhere (illegal target) → swap selection to the
 *      new tappable location, else clear.
 *
 * Multi-card runs: tapping the middle of a tableau pile selects that depth
 * down to the bottom of the pile, recorded in CSelectionRunLength.
 *
 * Reject rules:
 *   - Board has CompletedFlag → ignore.
 *   - Tap on a face-down card → ignore (top will flip on next move executed).
 *
 * Starts the timer on the first successful selection or move.
 *
 * No Pixi imports.
 *
 * ECS review notes:
 *   AP-1  ✓ — single concern: gate taps, drive Selection + executor.
 *   AP-26 ✓ — no hasComponent in hot loops; resolves singletons up front.
 */

import { addComponent, createQuery } from '@2817/ecs'
import type { IEntity, IWorld } from '@2817/ecs'
import type { IEventsCenter } from '@2817/events-center'
import {
	CBoardState,
	CCompletedFlag,
	CMovesCount,
	CSelectedCardRef,
	CSelectionRunLength,
	CStartedAtMs,
	CTimeElapsedMs,
	CTimerRunning,
} from '../components'
import {
	CardPickupEventId,
	LocationTapEventId,
	MoveRejectedEventId,
	type CardPickupEventData,
	type LocationTapEventData,
	type MoveRejectedEventData,
} from '../events'
import type { CardLocation, PileType, SolitaireBoardState, Suit } from '../logic/types'
import type { MoveExecutor } from './move-executor'
import { validateMove } from './move-validator'

export type InputSystemDeps = {
	world: IWorld
	eventsCenter: IEventsCenter
	boardEntity: IEntity
	selectionEntity: IEntity
	timerEntity: IEntity
	executor: MoveExecutor
	now: () => number
}

type Selection = {
	pile: PileType | ''
	column: number
	depth: number
	runLength: number
}

function pickupSource(sel: Selection): 'tableau' | 'waste' | 'foundation' {
	if (sel.pile === 'foundation') return 'foundation'
	if (sel.pile === 'waste') return 'waste'
	return 'tableau'
}

export function createInputSystem(deps: InputSystemDeps) {
	const { world, eventsCenter, boardEntity, selectionEntity, timerEntity, executor, now } = deps

	const activeBoardQ = createQuery(world, {
		with: [CBoardState, CMovesCount],
		without: [CCompletedFlag],
	})

	function isBoardActive(): boolean {
		const active = activeBoardQ()
		for (let i = 0; i < active.length; i++) {
			if (active[i]!.id === boardEntity.id) return true
		}
		return false
	}

	function readSelection(): Selection {
		const sWi = selectionEntity.worldIndex
		const sIdx = selectionEntity.index
		return {
			pile: (CSelectedCardRef.pile[sWi][sIdx] as PileType | '') ?? '',
			column: (CSelectedCardRef.column[sWi][sIdx] as number) ?? 0,
			depth: (CSelectedCardRef.depth[sWi][sIdx] as number) ?? 0,
			runLength: (CSelectionRunLength.value[sWi][sIdx] as number) ?? 0,
		}
	}

	function writeSelection(sel: Selection): void {
		const sWi = selectionEntity.worldIndex
		const sIdx = selectionEntity.index
		CSelectedCardRef.pile[sWi][sIdx] = sel.pile
		CSelectedCardRef.column[sWi][sIdx] = sel.column
		CSelectedCardRef.depth[sWi][sIdx] = sel.depth
		CSelectionRunLength.value[sWi][sIdx] = sel.runLength
	}

	function clearSelection(): void {
		writeSelection({ pile: '', column: 0, depth: 0, runLength: 0 })
	}

	function startTimerIfNeeded(): void {
		const tWi = timerEntity.worldIndex
		const tIdx = timerEntity.index
		const started = (CStartedAtMs.value[tWi][tIdx] as number) ?? 0
		if (started === 0) {
			CStartedAtMs.value[tWi][tIdx] = now()
			CTimeElapsedMs.value[tWi][tIdx] = 0
			addComponent(timerEntity, CTimerRunning)
		}
	}

	function locationToSelection(
		state: SolitaireBoardState,
		loc: CardLocation,
		depth: number,
	): Selection | null {
		if (loc.type === 'waste') {
			if (state.waste.length === 0) return null
			return { pile: 'waste', column: 0, depth: state.waste.length - 1, runLength: 1 }
		}
		if (loc.type === 'foundation') {
			if (state.foundations[loc.suit]!.length === 0) return null
			return {
				pile: 'foundation',
				column: loc.suit,
				depth: state.foundations[loc.suit]!.length - 1,
				runLength: 1,
			}
		}
		if (loc.type === 'pile') {
			const pile = state.piles[loc.index]!
			if (pile.length === 0) return null
			// Clamp depth into the pile and require face-up at that depth.
			const useDepth = Math.min(Math.max(depth, 0), pile.length - 1)
			const cardIdx = pile[useDepth]!
			const card = state.cards[cardIdx]!
			if (!card.faceUp) return null
			const runLength = pile.length - useDepth
			return { pile: 'tableau', column: loc.index, depth: useDepth, runLength }
		}
		return null
	}

	function selectionToLocation(sel: Selection): CardLocation | null {
		if (sel.pile === 'tableau') return { type: 'pile', index: sel.column }
		if (sel.pile === 'waste') return { type: 'waste' }
		if (sel.pile === 'foundation') return { type: 'foundation', suit: sel.column as Suit }
		return null
	}

	function onLocationTap(data: LocationTapEventData): void {
		if (!isBoardActive()) return
		const bWi = boardEntity.worldIndex
		const bIdx = boardEntity.index
		const state = CBoardState.value[bWi][bIdx] as SolitaireBoardState | null
		if (!state) return

		const sel = readSelection()
		const tappedSel = locationToSelection(state, data.location, data.depth)

		// No active selection: try to select the tapped location.
		if (sel.pile === '') {
			if (tappedSel === null) return
			writeSelection(tappedSel)
			eventsCenter.dispatch<CardPickupEventData>(
				{ id: CardPickupEventId, source: pickupSource(tappedSel) },
				true,
			)
			startTimerIfNeeded()
			return
		}

		// Active selection: same location → deselect.
		if (
			tappedSel !== null &&
			tappedSel.pile === sel.pile &&
			tappedSel.column === sel.column &&
			tappedSel.depth === sel.depth
		) {
			clearSelection()
			return
		}

		// Active selection: try to commit a move to the tapped destination.
		const from = selectionToLocation(sel)
		if (from === null) {
			clearSelection()
			return
		}
		// Build a destination CardLocation, even for empty piles/foundations.
		const to: CardLocation | null = (() => {
			if (data.location.type === 'pile') return { type: 'pile', index: data.location.index }
			if (data.location.type === 'foundation')
				return { type: 'foundation', suit: data.location.suit }
			return null
		})()
		if (to === null) {
			// Tapped waste while a selection is held: just deselect.
			clearSelection()
			return
		}

		const count = sel.runLength > 0 ? sel.runLength : 1
		const validateErr = validateMove(state, from, to, count)
		if (validateErr) {
			eventsCenter.dispatch<MoveRejectedEventData>(
				{ id: MoveRejectedEventId, reason: validateErr, from },
				true,
			)
			// Illegal target — try to swap selection if the new tap is selectable.
			if (tappedSel !== null) {
				writeSelection(tappedSel)
				eventsCenter.dispatch<CardPickupEventData>(
					{
						id: CardPickupEventId,
						source: pickupSource(tappedSel),
					},
					true,
				)
			} else {
				clearSelection()
			}
			return
		}
		const execErr = executor.execute(from, to, count)
		clearSelection()
		if (!execErr) startTimerIfNeeded()
	}

	function start(): void {
		eventsCenter.addListener<LocationTapEventData>(LocationTapEventId, onLocationTap)
	}
	function stop(): void {
		eventsCenter.removeListener(LocationTapEventId, onLocationTap)
	}

	return { start, stop, onLocationTap }
}
