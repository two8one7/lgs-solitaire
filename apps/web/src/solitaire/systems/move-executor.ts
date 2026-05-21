/**
 * move-executor — applies a validated move, syncs per-card components, bumps
 * MovesCount, and dispatches MoveExecuted.
 *
 * Validates via checker.ts (defense-in-depth — input-system already filtered,
 * but auto-place / auto-complete also call this and tests should be able to
 * call with an arbitrary move).
 *
 * No Pixi imports.
 *
 * ECS review notes:
 *   AP-1  ✓ — single concern: commit a single move.
 *   AP-2  ✓ — checker.ts mutates plain data; this file ferries state into ECS.
 */

import type { IEntity } from '@2817/ecs'
import type { IEventsCenter } from '@2817/events-center'
import { executeMoveTo } from '../logic/checker'
import type { CardLocation, SolitaireBoardState } from '../logic/types'
import { CBoardState, CMovesCount } from '../components'
import {
	FoundationCompletedEventId,
	MoveExecutedEventId,
	type FoundationCompletedEventData,
	type MoveExecutedEventData,
} from '../events'
import { syncCardPositions } from './sync-card-positions'

export type ExecuteMoveDeps = {
	eventsCenter: IEventsCenter
	boardEntity: IEntity
	cardEntities: IEntity[]
}

export function createMoveExecutor(deps: ExecuteMoveDeps) {
	const { eventsCenter, boardEntity, cardEntities } = deps

	function execute(from: CardLocation, to: CardLocation, count = 1): string | undefined {
		const bWi = boardEntity.worldIndex
		const bIdx = boardEntity.index
		const state = CBoardState.value[bWi][bIdx] as SolitaireBoardState | null
		if (!state) return 'board state not initialised'

		const err = executeMoveTo(state, from, to, count)
		if (err) return err

		CMovesCount.value[bWi][bIdx] = ((CMovesCount.value[bWi][bIdx] as number) ?? 0) + 1
		syncCardPositions(state, cardEntities)

		eventsCenter.dispatch<MoveExecutedEventData>(
			{ id: MoveExecutedEventId, fromKind: from.type, toKind: to.type, from, to },
			true,
		)
		if (to.type === 'foundation' && state.foundations[to.suit]!.length === 13) {
			eventsCenter.dispatch<FoundationCompletedEventData>(
				{ id: FoundationCompletedEventId, suit: to.suit },
				true,
			)
		}
		return undefined
	}

	return { execute }
}

export type MoveExecutor = ReturnType<typeof createMoveExecutor>
