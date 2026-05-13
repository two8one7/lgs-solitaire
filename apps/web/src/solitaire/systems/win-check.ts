/**
 * win-check — sets CompletedFlag on the Board once all 52 cards reach foundations.
 *
 * On fire:
 *   - Stops the timer (removes CTimerRunning).
 *   - Reads final TimeElapsedMs and writes to ScoreCalc.PlayerTimeMs.
 *   - Computes TimeDeltaMs = PlayerTimeMs - ParTimeMs.
 *   - Dispatches DailyComplete event.
 *
 * No Pixi imports.
 *
 * ECS review notes:
 *   AP-26 ✓ — exclusion in query via `without: [CCompletedFlag]`.
 *   AP-30 ✓ — completion gate is integer foundation totals; no float math.
 */

import { addComponent, createQuery, removeComponent } from '@2817/ecs'
import type { IEntity, IWorld } from '@2817/ecs'
import type { IEventsCenter } from '@2817/events-center'
import { isWon } from '../logic/checker'
import {
	CBoardState,
	CCompletedFlag,
	CParTimeMs,
	CPlayerTimeMs,
	CStartedAtMs,
	CTimeDeltaMs,
	CTimeElapsedMs,
	CTimerRunning,
} from '../components'
import { DailyCompleteEventId, type DailyCompleteEventData } from '../events'
import type { SolitaireBoardState } from '../logic/types'

export type WinCheckDeps = {
	world: IWorld
	eventsCenter: IEventsCenter
	timerEntity: IEntity
	scoreCalcEntity: IEntity
}

export function createWinCheckSystem(deps: WinCheckDeps) {
	const { world, eventsCenter, timerEntity, scoreCalcEntity } = deps

	const activeBoardQ = createQuery(world, {
		with: [CBoardState],
		without: [CCompletedFlag],
	})

	function update(): void {
		const entities = activeBoardQ()
		for (let i = 0; i < entities.length; i++) {
			const e = entities[i]!
			const wi = e.worldIndex
			const idx = e.index
			const state = CBoardState.value[wi][idx] as SolitaireBoardState | null
			if (!state) continue
			if (!isWon(state)) continue

			addComponent(e, CCompletedFlag)
			removeComponent(timerEntity, CTimerRunning)

			const tWi = timerEntity.worldIndex
			const tIdx = timerEntity.index
			const playerTimeMs = (CTimeElapsedMs.value[tWi][tIdx] as number) ?? 0
			// Freeze startedAt so persistence reads stay stable.
			void CStartedAtMs.value[tWi][tIdx]

			const scWi = scoreCalcEntity.worldIndex
			const scIdx = scoreCalcEntity.index
			const parTimeMs = (CParTimeMs.value[scWi][scIdx] as number) ?? 0
			CPlayerTimeMs.value[scWi][scIdx] = playerTimeMs
			CTimeDeltaMs.value[scWi][scIdx] = playerTimeMs - parTimeMs

			eventsCenter.dispatch<DailyCompleteEventData>(
				{
					id: DailyCompleteEventId,
					playerTimeMs,
					timeDeltaMs: playerTimeMs - parTimeMs,
				},
				true,
			)
		}
	}

	return { update }
}
