/**
 * Solitaire core types — ported from star-spangled-solitaire/packages/solitaire-solver.
 *
 * Logic-only, no Pixi imports. The ECS owns runtime state; this module owns
 * the plain-data structures used by the validator, executor, and hydration
 * systems.
 *
 * Suit encoding matches sss: spades=0, hearts=1, clubs=2, diamonds=3.
 */

export type Suit = 0 | 1 | 2 | 3

export const SUIT_SPADES: Suit = 0
export const SUIT_HEARTS: Suit = 1
export const SUIT_CLUBS: Suit = 2
export const SUIT_DIAMONDS: Suit = 3

/** 1=Ace, 11=Jack, 12=Queen, 13=King */
export type Rank = number

export interface SolitaireCard {
	suit: Suit
	value: Rank
	faceUp: boolean
}

export interface SolitaireBoardState {
	cards: SolitaireCard[]
	stock: number[]
	waste: number[]
	piles: number[][]
	foundations: number[][]
	drawSize: number
}

export type PileType = 'tableau' | 'foundation' | 'stock' | 'waste'

/** Logical position of a card (no pixel coordinates). */
export interface CardPosition {
	pile: PileType
	column: number
	depth: number
}

export type CardLocation =
	| { type: 'waste' }
	| { type: 'pile'; index: number }
	| { type: 'foundation'; suit: Suit }
