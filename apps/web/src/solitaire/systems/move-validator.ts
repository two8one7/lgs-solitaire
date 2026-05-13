/**
 * move-validator — thin wrapper around checker.ts primitives.
 *
 * Pulled out so input-system and auto-place can ask "is this move legal?"
 * before committing. Returns undefined on legal, error string on rejected.
 *
 * Pure functions, no ECS reads, no Pixi.
 */

import type { CardLocation, SolitaireBoardState, SolitaireCard, Suit } from '../logic/types'
import { validateCanPlaceOnFoundation, validateCanPlaceOnPile } from '../logic/checker'

export function validateMove(
	state: SolitaireBoardState,
	from: CardLocation,
	to: CardLocation,
	count = 1,
): string | undefined {
	const source = peekMovingCard(state, from, count)
	if (typeof source === 'string') return source
	const { card, faceUpRunOk } = source
	if (!faceUpRunOk) return 'cannot move a face-down card or break a non-run'

	if (to.type === 'pile') {
		return validateCanPlaceOnPile(card, state.piles[to.index]!, state.cards)
	}
	if (to.type === 'foundation') {
		if (count !== 1) return 'foundation accepts one card at a time'
		return validateCanPlaceOnFoundation(card, state.foundations[to.suit]!, state.cards, to.suit)
	}
	return `unsupported destination: ${(to as { type: string }).type}`
}

/**
 * Find the topmost card in the moving run for a `from` location.
 * Returns the card object + whether the run from there is fully face-up and
 * internally legal as a Klondike run (alternating color descending).
 */
function peekMovingCard(
	state: SolitaireBoardState,
	from: CardLocation,
	count: number,
):
	| { card: SolitaireCard; faceUpRunOk: boolean }
	| string {
	if (from.type === 'waste') {
		if (state.waste.length === 0) return 'waste is empty'
		const idx = state.waste[state.waste.length - 1]!
		return { card: state.cards[idx]!, faceUpRunOk: true }
	}
	if (from.type === 'foundation') {
		const f = state.foundations[from.suit]!
		if (f.length === 0) return `foundation ${from.suit} is empty`
		const idx = f[f.length - 1]!
		return { card: state.cards[idx]!, faceUpRunOk: true }
	}
	if (from.type === 'pile') {
		const pile = state.piles[from.index]!
		if (pile.length === 0) return `pile ${from.index} is empty`
		const startPos = pile.length - count
		if (startPos < 0) return `pile ${from.index} cannot give ${count} cards`
		const topIdx = pile[startPos]!
		const topCard = state.cards[topIdx]!
		if (!topCard.faceUp) return 'run head is face-down'
		// Verify the run is internally legal (alternating color, descending).
		for (let i = startPos + 1; i < pile.length; i++) {
			const prev = state.cards[pile[i - 1]!]!
			const cur = state.cards[pile[i]!]!
			if (!cur.faceUp) return 'run contains a face-down card'
			const oppositeColor =
				(prev.suit === 0 || prev.suit === 2) !== (cur.suit === 0 || cur.suit === 2)
			if (!oppositeColor) return 'run not alternating color'
			if (cur.value !== prev.value - 1) return 'run not descending'
		}
		return { card: topCard, faceUpRunOk: true }
	}
	return `unsupported source: ${(from as { type: string }).type}`
}

/** Find the foundation suit accepting `card` next, if any. */
export function findFoundationFor(
	state: SolitaireBoardState,
	card: SolitaireCard,
): Suit | undefined {
	const suit = card.suit
	const foundation = state.foundations[suit]!
	const err = validateCanPlaceOnFoundation(card, foundation, state.cards, suit)
	if (err) return undefined
	return suit
}
