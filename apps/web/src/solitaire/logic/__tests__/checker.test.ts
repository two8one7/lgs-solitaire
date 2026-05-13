/**
 * Tests for checker.ts — move validation, move execution, stock cycle, win check.
 *
 * Tests construct boards by hand so cases are deterministic — no reliance on
 * dealKlondike's pile distribution.
 */

import { describe, expect, it } from 'vitest'
import {
	allTableauFaceUp,
	drawFromStock,
	executeMoveTo,
	isWon,
	recycleWaste,
	validateCanPlaceOnFoundation,
	validateCanPlaceOnPile,
} from '../checker'
import {
	SUIT_CLUBS,
	SUIT_DIAMONDS,
	SUIT_HEARTS,
	SUIT_SPADES,
	type SolitaireBoardState,
	type SolitaireCard,
} from '../types'

function blank(): SolitaireBoardState {
	return {
		cards: [],
		stock: [],
		waste: [],
		piles: [[], [], [], [], [], [], []],
		foundations: [[], [], [], []],
		drawSize: 1,
	}
}

function pushCard(state: SolitaireBoardState, card: SolitaireCard): number {
	const idx = state.cards.length
	state.cards.push(card)
	return idx
}

describe('validateCanPlaceOnPile (move-validator)', () => {
	it('accepts a King on an empty pile', () => {
		const state = blank()
		const k = pushCard(state, { suit: SUIT_SPADES, value: 13, faceUp: true })
		expect(validateCanPlaceOnPile(state.cards[k], [], state.cards)).toBeUndefined()
	})

	it('rejects non-King on empty pile', () => {
		const state = blank()
		const card = pushCard(state, { suit: SUIT_SPADES, value: 12, faceUp: true })
		expect(validateCanPlaceOnPile(state.cards[card], [], state.cards)).toMatch(/kings/)
	})

	it('accepts opposite color, value one less', () => {
		const state = blank()
		const black10 = pushCard(state, { suit: SUIT_SPADES, value: 10, faceUp: true })
		const redJ = pushCard(state, { suit: SUIT_HEARTS, value: 11, faceUp: true })
		expect(
			validateCanPlaceOnPile(state.cards[black10], [redJ], state.cards),
		).toBeUndefined()
	})

	it('rejects same color even with correct value', () => {
		const state = blank()
		const black10 = pushCard(state, { suit: SUIT_CLUBS, value: 10, faceUp: true })
		const blackJ = pushCard(state, { suit: SUIT_SPADES, value: 11, faceUp: true })
		expect(validateCanPlaceOnPile(state.cards[black10], [blackJ], state.cards)).toMatch(
			/opposite color/,
		)
	})

	it('rejects wrong value with correct color', () => {
		const state = blank()
		const red9 = pushCard(state, { suit: SUIT_HEARTS, value: 9, faceUp: true })
		const blackJ = pushCard(state, { suit: SUIT_SPADES, value: 11, faceUp: true })
		expect(validateCanPlaceOnPile(state.cards[red9], [blackJ], state.cards)).toMatch(
			/one less/,
		)
	})
})

describe('validateCanPlaceOnFoundation (move-validator)', () => {
	it('accepts an Ace on empty matching-suit foundation', () => {
		const state = blank()
		const a = pushCard(state, { suit: SUIT_HEARTS, value: 1, faceUp: true })
		expect(
			validateCanPlaceOnFoundation(state.cards[a], [], state.cards, SUIT_HEARTS),
		).toBeUndefined()
	})

	it('rejects non-Ace on empty foundation', () => {
		const state = blank()
		const two = pushCard(state, { suit: SUIT_HEARTS, value: 2, faceUp: true })
		expect(
			validateCanPlaceOnFoundation(state.cards[two], [], state.cards, SUIT_HEARTS),
		).toMatch(/aces/)
	})

	it('rejects wrong suit', () => {
		const state = blank()
		const heart = pushCard(state, { suit: SUIT_HEARTS, value: 1, faceUp: true })
		expect(
			validateCanPlaceOnFoundation(state.cards[heart], [], state.cards, SUIT_SPADES),
		).toMatch(/suit/)
	})

	it('accepts ascending value of same suit', () => {
		const state = blank()
		const a = pushCard(state, { suit: SUIT_HEARTS, value: 1, faceUp: true })
		const two = pushCard(state, { suit: SUIT_HEARTS, value: 2, faceUp: true })
		expect(
			validateCanPlaceOnFoundation(state.cards[two], [a], state.cards, SUIT_HEARTS),
		).toBeUndefined()
	})

	it('rejects skipping a value', () => {
		const state = blank()
		const a = pushCard(state, { suit: SUIT_HEARTS, value: 1, faceUp: true })
		const three = pushCard(state, { suit: SUIT_HEARTS, value: 3, faceUp: true })
		expect(
			validateCanPlaceOnFoundation(state.cards[three], [a], state.cards, SUIT_HEARTS),
		).toMatch(/one more/)
	})
})

describe('executeMoveTo (move-executor)', () => {
	it('waste → pile moves the waste top onto a legal pile', () => {
		const state = blank()
		const redJ = pushCard(state, { suit: SUIT_HEARTS, value: 11, faceUp: true })
		const black10 = pushCard(state, { suit: SUIT_SPADES, value: 10, faceUp: true })
		state.piles[0].push(redJ)
		state.waste.push(black10)
		expect(
			executeMoveTo(state, { type: 'waste' }, { type: 'pile', index: 0 }),
		).toBeUndefined()
		expect(state.waste).toEqual([])
		expect(state.piles[0]).toEqual([redJ, black10])
	})

	it('waste → foundation moves an Ace to its empty foundation', () => {
		const state = blank()
		const a = pushCard(state, { suit: SUIT_DIAMONDS, value: 1, faceUp: true })
		state.waste.push(a)
		expect(
			executeMoveTo(
				state,
				{ type: 'waste' },
				{ type: 'foundation', suit: SUIT_DIAMONDS },
			),
		).toBeUndefined()
		expect(state.foundations[SUIT_DIAMONDS]).toEqual([a])
	})

	it('pile → pile flips a newly-exposed face-down card', () => {
		const state = blank()
		const downCard = pushCard(state, { suit: SUIT_CLUBS, value: 5, faceUp: false })
		const blackJ = pushCard(state, { suit: SUIT_SPADES, value: 11, faceUp: true })
		const redQ = pushCard(state, { suit: SUIT_HEARTS, value: 12, faceUp: true })
		state.piles[0].push(downCard, blackJ)
		state.piles[1].push(redQ)
		expect(
			executeMoveTo(
				state,
				{ type: 'pile', index: 0 },
				{ type: 'pile', index: 1 },
				1,
			),
		).toBeUndefined()
		expect(state.piles[0]).toEqual([downCard])
		expect(state.cards[downCard].faceUp).toBe(true)
		expect(state.piles[1]).toEqual([redQ, blackJ])
	})

	it('multi-card pile → pile moves the whole run when top fits', () => {
		const state = blank()
		const redQ = pushCard(state, { suit: SUIT_HEARTS, value: 12, faceUp: true })
		const blackJ = pushCard(state, { suit: SUIT_SPADES, value: 11, faceUp: true })
		const red10 = pushCard(state, { suit: SUIT_DIAMONDS, value: 10, faceUp: true })
		const blackK = pushCard(state, { suit: SUIT_CLUBS, value: 13, faceUp: true })
		state.piles[0].push(redQ, blackJ, red10)
		state.piles[1].push(blackK)
		expect(
			executeMoveTo(
				state,
				{ type: 'pile', index: 0 },
				{ type: 'pile', index: 1 },
				3,
			),
		).toBeUndefined()
		expect(state.piles[0]).toEqual([])
		expect(state.piles[1]).toEqual([blackK, redQ, blackJ, red10])
	})

	it('refuses same-pile move', () => {
		const state = blank()
		const k = pushCard(state, { suit: SUIT_CLUBS, value: 13, faceUp: true })
		state.piles[0].push(k)
		expect(
			executeMoveTo(state, { type: 'pile', index: 0 }, { type: 'pile', index: 0 }),
		).toMatch(/same pile/)
	})
})

describe('drawFromStock + recycleWaste (stock-cycle)', () => {
	it('draws drawSize cards face-up to waste', () => {
		const state = blank()
		const a = pushCard(state, { suit: SUIT_HEARTS, value: 5, faceUp: false })
		const b = pushCard(state, { suit: SUIT_SPADES, value: 7, faceUp: false })
		state.stock.push(a, b)
		state.drawSize = 1
		expect(drawFromStock(state)).toBe(1)
		expect(state.waste).toEqual([a])
		expect(state.cards[a].faceUp).toBe(true)
		expect(state.stock).toEqual([b])
	})

	it('clamps to remaining stock when drawSize exceeds stock', () => {
		const state = blank()
		const a = pushCard(state, { suit: SUIT_HEARTS, value: 5, faceUp: false })
		state.stock.push(a)
		state.drawSize = 3
		expect(drawFromStock(state)).toBe(1)
		expect(state.stock).toEqual([])
	})

	it('returns 0 when stock is empty', () => {
		const state = blank()
		expect(drawFromStock(state)).toBe(0)
	})

	it('recycleWaste refuses while stock is non-empty', () => {
		const state = blank()
		const a = pushCard(state, { suit: SUIT_HEARTS, value: 5, faceUp: false })
		const b = pushCard(state, { suit: SUIT_SPADES, value: 7, faceUp: true })
		state.stock.push(a)
		state.waste.push(b)
		expect(recycleWaste(state)).toBe(false)
		expect(state.stock).toEqual([a])
		expect(state.waste).toEqual([b])
	})

	it('recycleWaste flips waste face-down back to stock in order', () => {
		const state = blank()
		const a = pushCard(state, { suit: SUIT_HEARTS, value: 5, faceUp: true })
		const b = pushCard(state, { suit: SUIT_SPADES, value: 7, faceUp: true })
		state.waste.push(a, b)
		expect(recycleWaste(state)).toBe(true)
		expect(state.waste).toEqual([])
		expect(state.stock).toEqual([a, b])
		expect(state.cards[a].faceUp).toBe(false)
		expect(state.cards[b].faceUp).toBe(false)
	})

	it('recycleWaste is a no-op when both stock and waste are empty', () => {
		const state = blank()
		expect(recycleWaste(state)).toBe(false)
	})
})

describe('isWon + allTableauFaceUp (win-check)', () => {
	it('isWon returns true only when foundations hold all 52 cards', () => {
		const state = blank()
		expect(isWon(state)).toBe(false)
		for (let i = 0; i < 13; ++i) {
			state.foundations[0].push(i)
			state.foundations[1].push(i + 13)
			state.foundations[2].push(i + 26)
			state.foundations[3].push(i + 39)
		}
		expect(isWon(state)).toBe(true)
	})

	it('allTableauFaceUp gates auto-complete on every pile card being face-up', () => {
		const state = blank()
		const down = pushCard(state, { suit: SUIT_CLUBS, value: 3, faceUp: false })
		const up = pushCard(state, { suit: SUIT_HEARTS, value: 4, faceUp: true })
		state.piles[0].push(down)
		state.piles[1].push(up)
		expect(allTableauFaceUp(state)).toBe(false)
		state.cards[down].faceUp = true
		expect(allTableauFaceUp(state)).toBe(true)
	})
})
