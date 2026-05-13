/**
 * auto-place — handles LocationDoubleTap.
 *
 * Resolves the top card at the tapped location, finds its target foundation
 * (if legal), and commits the move via move-executor. Idempotent on the
 * "no legal foundation" branch — the tap silently no-ops.
 *
 * No Pixi imports.
 */

import type { IEntity } from '@2817/ecs'
import type { IEventsCenter } from '@2817/events-center'
import { CBoardState } from '../components'
import {
	LocationDoubleTapEventId,
	type LocationDoubleTapEventData,
} from '../events'
import type { CardLocation, SolitaireBoardState, SolitaireCard } from '../logic/types'
import { findFoundationFor } from './move-validator'
import type { MoveExecutor } from './move-executor'

export type AutoPlaceDeps = {
	eventsCenter: IEventsCenter
	boardEntity: IEntity
	executor: MoveExecutor
}

export function createAutoPlaceSystem(deps: AutoPlaceDeps) {
	const { eventsCenter, boardEntity, executor } = deps

	function topCardAt(
		state: SolitaireBoardState,
		loc: CardLocation,
	): { card: SolitaireCard; from: CardLocation } | null {
		if (loc.type === 'waste') {
			if (state.waste.length === 0) return null
			const idx = state.waste[state.waste.length - 1]!
			return { card: state.cards[idx]!, from: { type: 'waste' } }
		}
		if (loc.type === 'pile') {
			const pile = state.piles[loc.index]!
			if (pile.length === 0) return null
			const idx = pile[pile.length - 1]!
			const card = state.cards[idx]!
			if (!card.faceUp) return null
			return { card, from: { type: 'pile', index: loc.index } }
		}
		// foundation double-tap is a no-op (nothing higher to auto-place into).
		return null
	}

	function onDoubleTap(data: LocationDoubleTapEventData): void {
		const bWi = boardEntity.worldIndex
		const bIdx = boardEntity.index
		const state = CBoardState.value[bWi][bIdx] as SolitaireBoardState | null
		if (!state) return

		const top = topCardAt(state, data.location)
		if (top === null) return
		const suit = findFoundationFor(state, top.card)
		if (suit === undefined) return
		executor.execute(top.from, { type: 'foundation', suit }, 1)
	}

	function start(): void {
		eventsCenter.addListener<LocationDoubleTapEventData>(LocationDoubleTapEventId, onDoubleTap)
	}
	function stop(): void {
		eventsCenter.removeListener(LocationDoubleTapEventId, onDoubleTap)
	}

	return { start, stop, onDoubleTap }
}
