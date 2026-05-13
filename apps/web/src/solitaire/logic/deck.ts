/**
 * Deck deserialization + Klondike deal.
 *
 * Ported from star-spangled-solitaire/packages/solitaire-solver/src/{deserialize,state}.ts.
 * The deal algorithm uses PILES_LAYOUT [7,6,5,4,3,2,1] — classical Klondike
 * where pile p holds p+1 cards, top face-up, rest face-down. Remaining 24
 * cards go into stock (no draw-1 optimization here — stock is the unflipped
 * deck and gameplay's stock-cycle moves cards to waste).
 */

import {
	type Suit,
	type SolitaireCard,
	type SolitaireBoardState,
	SUIT_SPADES,
	SUIT_HEARTS,
	SUIT_CLUBS,
	SUIT_DIAMONDS,
} from './types'

const PILES_LAYOUT: ReadonlyArray<number> = [7, 6, 5, 4, 3, 2, 1]

function suitFromLetter(v: string): Suit {
	switch (v) {
		case 'H':
		case 'h':
			return SUIT_HEARTS
		case 'C':
		case 'c':
			return SUIT_CLUBS
		case 'D':
		case 'd':
			return SUIT_DIAMONDS
		case 'S':
		case 's':
		default:
			return SUIT_SPADES
	}
}

/** "2D,12C,..." → 52 SolitaireCard (faceUp:false). */
export function deserializeDeck(deck: string): SolitaireCard[] {
	const parts = deck.split(',')
	const cards: SolitaireCard[] = []
	for (const part of parts) {
		const trimmed = part.trim()
		if (trimmed.length === 0) continue
		const suit = suitFromLetter(trimmed.slice(-1))
		const value = parseInt(trimmed.slice(0, -1), 10)
		cards.push({ suit, value, faceUp: false })
	}
	return cards
}

/**
 * Deal a fresh Klondike board from a 52-card deck.
 *
 * Pile p ends with p+1 cards; the top of each pile is face-up; remaining cards
 * sit in stock face-down. Waste + foundations start empty.
 */
export function dealKlondike(cards: SolitaireCard[], drawSize = 1): SolitaireBoardState {
	if (cards.length !== 52) {
		throw new Error(`dealKlondike: expected 52 cards, got ${cards.length}`)
	}

	const state: SolitaireBoardState = {
		cards: cards.map((c) => ({ ...c, faceUp: false })),
		stock: [],
		waste: [],
		piles: [[], [], [], [], [], [], []],
		foundations: [[], [], [], []],
		drawSize,
	}

	let deckPos = 0
	for (let i = 0; i < PILES_LAYOUT.length; ++i) {
		for (let j = 0; j < PILES_LAYOUT[i]; ++j) {
			const cardIdx = deckPos++
			state.cards[cardIdx].faceUp = j === 0
			state.piles[i + j].push(cardIdx)
		}
	}

	for (let i = deckPos; i < state.cards.length; ++i) {
		state.stock.push(i)
	}

	return state
}

export function cardLabel(card: SolitaireCard): string {
	const values = ['?', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
	const suits = ['S', 'H', 'C', 'D']
	return `${values[card.value] ?? card.value}${suits[card.suit] ?? '?'}`
}

export function suitGlyph(suit: Suit): string {
	switch (suit) {
		case SUIT_SPADES:
			return '\u2660'
		case SUIT_HEARTS:
			return '\u2665'
		case SUIT_CLUBS:
			return '\u2663'
		case SUIT_DIAMONDS:
			return '\u2666'
	}
}

export function isRedSuit(suit: Suit): boolean {
	return suit === SUIT_HEARTS || suit === SUIT_DIAMONDS
}

export function isOppositeColor(a: Suit, b: Suit): boolean {
	return isRedSuit(a) !== isRedSuit(b)
}
