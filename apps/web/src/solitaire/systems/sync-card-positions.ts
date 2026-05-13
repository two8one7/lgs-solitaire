/**
 * sync-card-positions — mirror SolitaireBoardState back onto Card components.
 *
 * checker.ts mutates the board state in-place; render systems and queries
 * still read per-card CPosition / CFaceUp. After every executed move, walk
 * piles/stock/waste/foundations and write each card's logical location +
 * face-up flag.
 *
 * Pure mutation, no event dispatch, no validation. Called by move-executor /
 * stock-cycle / auto-place after a successful primitive call.
 *
 * No Pixi imports.
 */

import type { IEntity } from '@2817/ecs'
import type { SolitaireBoardState, PileType } from '../logic/types'
import { CFaceUp, CPosition } from '../components'

function writePosition(
	entity: IEntity,
	pile: PileType,
	column: number,
	depth: number,
	faceUp: boolean,
): void {
	const wi = entity.worldIndex
	const idx = entity.index
	CPosition.pile[wi][idx] = pile
	CPosition.column[wi][idx] = column
	CPosition.depth[wi][idx] = depth
	CFaceUp.value[wi][idx] = faceUp
}

export function syncCardPositions(state: SolitaireBoardState, cardEntities: IEntity[]): void {
	for (let col = 0; col < state.piles.length; col++) {
		const pile = state.piles[col]!
		for (let depth = 0; depth < pile.length; depth++) {
			const cardIdx = pile[depth]!
			const e = cardEntities[cardIdx]
			if (!e) continue
			writePosition(e, 'tableau', col, depth, state.cards[cardIdx]!.faceUp)
		}
	}
	for (let depth = 0; depth < state.stock.length; depth++) {
		const cardIdx = state.stock[depth]!
		const e = cardEntities[cardIdx]
		if (!e) continue
		writePosition(e, 'stock', 0, depth, state.cards[cardIdx]!.faceUp)
	}
	for (let depth = 0; depth < state.waste.length; depth++) {
		const cardIdx = state.waste[depth]!
		const e = cardEntities[cardIdx]
		if (!e) continue
		writePosition(e, 'waste', 0, depth, state.cards[cardIdx]!.faceUp)
	}
	for (let suit = 0; suit < state.foundations.length; suit++) {
		const f = state.foundations[suit]!
		for (let depth = 0; depth < f.length; depth++) {
			const cardIdx = f[depth]!
			const e = cardEntities[cardIdx]
			if (!e) continue
			writePosition(e, 'foundation', suit, depth, state.cards[cardIdx]!.faceUp)
		}
	}
}
