/**
 * Tests for deck.ts — deserialization, dealing, label helpers.
 */

import { describe, expect, it } from 'vitest'
import {
	cardLabel,
	dealKlondike,
	deserializeDeck,
	isOppositeColor,
	isRedSuit,
	suitGlyph,
} from '../deck'
import {
	SUIT_CLUBS,
	SUIT_DIAMONDS,
	SUIT_HEARTS,
	SUIT_SPADES,
	type SolitaireCard,
} from '../types'

function fullDeck(): SolitaireCard[] {
	const cards: SolitaireCard[] = []
	for (let suit = 0; suit < 4; ++suit) {
		for (let value = 1; value <= 13; ++value) {
			cards.push({ suit: suit as 0 | 1 | 2 | 3, value, faceUp: false })
		}
	}
	return cards
}

describe('deserializeDeck', () => {
	it('parses suit letters case-insensitively', () => {
		const cards = deserializeDeck('1S,13H,7c,2d')
		expect(cards).toHaveLength(4)
		expect(cards[0]).toEqual({ suit: SUIT_SPADES, value: 1, faceUp: false })
		expect(cards[1]).toEqual({ suit: SUIT_HEARTS, value: 13, faceUp: false })
		expect(cards[2]).toEqual({ suit: SUIT_CLUBS, value: 7, faceUp: false })
		expect(cards[3]).toEqual({ suit: SUIT_DIAMONDS, value: 2, faceUp: false })
	})

	it('skips empty entries from trailing commas', () => {
		const cards = deserializeDeck('1S,,2H,')
		expect(cards).toHaveLength(2)
	})
})

describe('dealKlondike', () => {
	it('produces 7 piles with sizes 1..7, top face-up, rest face-down', () => {
		const state = dealKlondike(fullDeck())
		expect(state.piles).toHaveLength(7)
		for (let i = 0; i < 7; ++i) {
			expect(state.piles[i].length).toBe(i + 1)
			const top = state.cards[state.piles[i][i]]
			expect(top.faceUp).toBe(true)
			for (let depth = 0; depth < i; ++depth) {
				expect(state.cards[state.piles[i][depth]].faceUp).toBe(false)
			}
		}
	})

	it('leaves remaining 24 cards in stock, empty waste + foundations', () => {
		const state = dealKlondike(fullDeck())
		expect(state.stock).toHaveLength(24)
		expect(state.waste).toHaveLength(0)
		expect(state.foundations.map((f) => f.length)).toEqual([0, 0, 0, 0])
	})

	it('throws on non-52 input', () => {
		expect(() => dealKlondike(fullDeck().slice(0, 51))).toThrow(/expected 52/)
	})

	it('honors drawSize', () => {
		const state = dealKlondike(fullDeck(), 3)
		expect(state.drawSize).toBe(3)
	})
})

describe('label + color helpers', () => {
	it('cardLabel formats face cards', () => {
		expect(cardLabel({ suit: SUIT_HEARTS, value: 1, faceUp: true })).toBe('AH')
		expect(cardLabel({ suit: SUIT_CLUBS, value: 11, faceUp: true })).toBe('JC')
		expect(cardLabel({ suit: SUIT_DIAMONDS, value: 13, faceUp: true })).toBe('KD')
	})

	it('suitGlyph maps to UTF suit chars', () => {
		expect(suitGlyph(SUIT_SPADES)).toBe('\u2660')
		expect(suitGlyph(SUIT_HEARTS)).toBe('\u2665')
		expect(suitGlyph(SUIT_CLUBS)).toBe('\u2663')
		expect(suitGlyph(SUIT_DIAMONDS)).toBe('\u2666')
	})

	it('isRedSuit + isOppositeColor agree on red/black split', () => {
		expect(isRedSuit(SUIT_HEARTS)).toBe(true)
		expect(isRedSuit(SUIT_DIAMONDS)).toBe(true)
		expect(isRedSuit(SUIT_SPADES)).toBe(false)
		expect(isRedSuit(SUIT_CLUBS)).toBe(false)
		expect(isOppositeColor(SUIT_HEARTS, SUIT_SPADES)).toBe(true)
		expect(isOppositeColor(SUIT_DIAMONDS, SUIT_CLUBS)).toBe(true)
		expect(isOppositeColor(SUIT_HEARTS, SUIT_DIAMONDS)).toBe(false)
		expect(isOppositeColor(SUIT_SPADES, SUIT_CLUBS)).toBe(false)
	})
})
