/**
 * stock-cycle — handles StockTap.
 *
 * Behaviour:
 *   - Stock non-empty → drawFromStock (flips 1..drawSize cards face-up to waste).
 *   - Stock empty, waste non-empty → recycleWaste (face-down back to stock).
 *   - Both empty → no-op.
 *
 * On any successful state change, syncs per-card components and dispatches
 * StockCycled with the kind. Counts as a move iff drawSize cards moved.
 *
 * No Pixi imports.
 */

import type { IEntity, IWorld } from '@2817/ecs'
import { addComponent } from '@2817/ecs'
import type { IEventsCenter } from '@2817/events-center'
import { drawFromStock, recycleWaste } from '../logic/checker'
import type { SolitaireBoardState } from '../logic/types'
import {
	CBoardState,
	CMovesCount,
	CStartedAtMs,
	CTimeElapsedMs,
	CTimerRunning,
} from '../components'
import {
	StockCycledEventId,
	StockTapEventId,
	type StockCycledEventData,
	type StockTapEventData,
} from '../events'
import { syncCardPositions } from './sync-card-positions'

export type StockCycleDeps = {
	world: IWorld
	eventsCenter: IEventsCenter
	boardEntity: IEntity
	timerEntity: IEntity
	cardEntities: IEntity[]
	now: () => number
}

export function createStockCycleSystem(deps: StockCycleDeps) {
	const { eventsCenter, boardEntity, timerEntity, cardEntities, now } = deps

	function onStockTap(_data: StockTapEventData): void {
		const bWi = boardEntity.worldIndex
		const bIdx = boardEntity.index
		const state = CBoardState.value[bWi][bIdx] as SolitaireBoardState | null
		if (!state) return

		let kind: 'draw' | 'recycle' | 'empty' = 'empty'
		if (state.stock.length > 0) {
			const drew = drawFromStock(state)
			if (drew > 0) kind = 'draw'
		} else if (state.waste.length > 0) {
			recycleWaste(state)
			kind = 'recycle'
		}

		if (kind === 'empty') {
			eventsCenter.dispatch<StockCycledEventData>(
				{ id: StockCycledEventId, kind },
				true,
			)
			return
		}

		CMovesCount.value[bWi][bIdx] = ((CMovesCount.value[bWi][bIdx] as number) ?? 0) + 1
		syncCardPositions(state, cardEntities)
		startTimerIfNeeded()
		eventsCenter.dispatch<StockCycledEventData>({ id: StockCycledEventId, kind }, true)
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

	function start(): void {
		eventsCenter.addListener<StockTapEventData>(StockTapEventId, onStockTap)
	}
	function stop(): void {
		eventsCenter.removeListener(StockTapEventId, onStockTap)
	}

	return { start, stop, onStockTap }
}
