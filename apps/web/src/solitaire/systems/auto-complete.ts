/**
 * auto-complete — once all tableau cards are face-up and stock+waste are
 * empty, drain every remaining card into its foundation, one move per update
 * tick. Each step calls into move-executor, so per-card components stay in
 * sync and MoveExecuted events still fire.
 *
 * Trigger gate: allTableauFaceUp(state) && stock.length === 0 && waste.length === 0
 * && not yet won. While active, each update tick attempts ONE pile→foundation
 * move (cheapest legal foundation that accepts the top of any pile).
 *
 * Pauses ON COMPLETE FLAG — win-check handles transition out.
 *
 * No Pixi imports.
 */

import { createQuery } from '@2817/ecs'
import type { IEntity, IWorld } from '@2817/ecs'
import { allTableauFaceUp, isWon } from '../logic/checker'
import type { SolitaireBoardState } from '../logic/types'
import { CBoardState, CCompletedFlag } from '../components'
import type { MoveExecutor } from './move-executor'
import { findFoundationFor } from './move-validator'

export type AutoCompleteDeps = {
	world: IWorld
	boardEntity: IEntity
	executor: MoveExecutor
	/** Seconds between auto-flush steps. Default 0.06 (~16 fps of moves). */
	stepIntervalS?: number
}

export function createAutoCompleteSystem(deps: AutoCompleteDeps) {
	const { world, boardEntity, executor } = deps
	const stepIntervalS = deps.stepIntervalS ?? 0.06

	const eligibleQ = createQuery(world, {
		with: [CBoardState],
		without: [CCompletedFlag],
	})

	let accum = 0

	function shouldTrigger(state: SolitaireBoardState): boolean {
		if (state.stock.length !== 0) return false
		if (state.waste.length !== 0) return false
		if (isWon(state)) return false
		return allTableauFaceUp(state)
	}

	function pickNextPileMove(state: SolitaireBoardState): number | null {
		// Walk piles, pick the one whose top card has a legal foundation.
		for (let i = 0; i < state.piles.length; i++) {
			const pile = state.piles[i]!
			if (pile.length === 0) continue
			const idx = pile[pile.length - 1]!
			const card = state.cards[idx]!
			if (!card.faceUp) continue
			const suit = findFoundationFor(state, card)
			if (suit !== undefined) return i
		}
		return null
	}

	function update(dt: number): void {
		const entities = eligibleQ()
		if (entities.length === 0) return
		let target: IEntity | null = null
		for (let i = 0; i < entities.length; i++) {
			if (entities[i]!.id === boardEntity.id) {
				target = entities[i]!
				break
			}
		}
		if (target === null) return

		const bWi = target.worldIndex
		const bIdx = target.index
		const state = CBoardState.value[bWi][bIdx] as SolitaireBoardState | null
		if (!state) return
		if (!shouldTrigger(state)) {
			accum = 0
			return
		}

		accum += dt
		if (accum < stepIntervalS) return
		accum = 0

		const pileIdx = pickNextPileMove(state)
		if (pileIdx === null) return
		const idx = state.piles[pileIdx]![state.piles[pileIdx]!.length - 1]!
		const suit = state.cards[idx]!.suit
		executor.execute({ type: 'pile', index: pileIdx }, { type: 'foundation', suit }, 1)
	}

	return { update }
}
