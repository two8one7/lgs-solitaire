/**
 * Klondike move validation + execution.
 *
 * Ported from star-spangled-solitaire/packages/solitaire-solver/src/checker.ts.
 * These are the headless rule primitives the ECS systems call into. No Pixi,
 * no DOM, no ECS — pure functions on SolitaireBoardState.
 *
 * Rules (Klondike Draw-1, v1):
 *   - Tableau: descending value, alternating color. Empty tableau accepts Kings only.
 *   - Foundation: ascending by suit starting at Ace. One foundation per suit.
 *   - Multi-card pile→pile: legal if top of the moving run can be placed on the destination.
 *   - On pile→{pile,foundation} success, if the new top of source pile is face-down, flip it.
 */

import type { SolitaireBoardState, SolitaireCard, Suit, CardLocation } from './types'
import { cardLabel, isOppositeColor } from './deck'

export function validateCanPlaceOnPile(
	card: SolitaireCard,
	pile: number[],
	cards: SolitaireCard[],
): string | undefined {
	if (pile.length === 0) {
		if (card.value !== 13) {
			return `only kings can go on empty piles, got ${cardLabel(card)}`
		}
		return undefined
	}
	const topIdx = pile[pile.length - 1]
	const topCard = cards[topIdx]
	if (!isOppositeColor(card.suit, topCard.suit)) {
		return `${cardLabel(card)} is not opposite color to ${cardLabel(topCard)}`
	}
	if (card.value !== topCard.value - 1) {
		return `${cardLabel(card)} must be one less than ${cardLabel(topCard)}`
	}
	return undefined
}

export function validateCanPlaceOnFoundation(
	card: SolitaireCard,
	foundation: number[],
	cards: SolitaireCard[],
	foundationSuit: Suit,
): string | undefined {
	if (card.suit !== foundationSuit) {
		return `card suit does not match foundation suit`
	}
	if (foundation.length === 0) {
		if (card.value !== 1) {
			return `only aces can start a foundation, got ${cardLabel(card)}`
		}
		return undefined
	}
	const topIdx = foundation[foundation.length - 1]
	const topCard = cards[topIdx]
	if (card.value !== topCard.value + 1) {
		return `${cardLabel(card)} must be one more than ${cardLabel(topCard)}`
	}
	return undefined
}

/** Execute a single move. Returns an error string or undefined on success. */
export function executeMoveTo(
	state: SolitaireBoardState,
	from: CardLocation,
	to: CardLocation,
	count?: number,
): string | undefined {
	// waste → pile
	if (from.type === 'waste' && to.type === 'pile') {
		if (state.waste.length === 0) return 'waste is empty'
		const cardIdx = state.waste[state.waste.length - 1]
		const card = state.cards[cardIdx]
		const pile = state.piles[to.index]
		const err = validateCanPlaceOnPile(card, pile, state.cards)
		if (err) return `waste → pile-${to.index}: ${err}`
		state.waste.pop()
		pile.push(cardIdx)
		return undefined
	}

	// waste → foundation
	if (from.type === 'waste' && to.type === 'foundation') {
		if (state.waste.length === 0) return 'waste is empty'
		const cardIdx = state.waste[state.waste.length - 1]
		const card = state.cards[cardIdx]
		const foundation = state.foundations[to.suit]
		const err = validateCanPlaceOnFoundation(card, foundation, state.cards, to.suit)
		if (err) return `waste → foundation: ${err}`
		state.waste.pop()
		foundation.push(cardIdx)
		return undefined
	}

	// pile → pile (supports multi-card runs)
	if (from.type === 'pile' && to.type === 'pile') {
		if (from.index === to.index) return 'cannot move to same pile'
		const srcPile = state.piles[from.index]
		if (srcPile.length === 0) return `pile-${from.index} is empty`
		const moveCount = count ?? 1
		const startPos = srcPile.length - moveCount
		if (startPos < 0) {
			return `pile-${from.index} has ${srcPile.length} cards, cannot move ${moveCount}`
		}
		const topMovingIdx = srcPile[startPos]
		const topMovingCard = state.cards[topMovingIdx]
		if (!topMovingCard.faceUp) {
			return `card at depth ${startPos} of pile-${from.index} is face-down`
		}
		const dstPile = state.piles[to.index]
		const err = validateCanPlaceOnPile(topMovingCard, dstPile, state.cards)
		if (err) return `pile-${from.index} → pile-${to.index}: ${err}`
		const moving = srcPile.splice(startPos)
		dstPile.push(...moving)
		flipNewTopIfFaceDown(srcPile, state.cards)
		return undefined
	}

	// pile → foundation (top card only)
	if (from.type === 'pile' && to.type === 'foundation') {
		const srcPile = state.piles[from.index]
		if (srcPile.length === 0) return `pile-${from.index} is empty`
		const cardIdx = srcPile[srcPile.length - 1]
		const card = state.cards[cardIdx]
		if (!card.faceUp) return `top of pile-${from.index} is face-down`
		const foundation = state.foundations[to.suit]
		const err = validateCanPlaceOnFoundation(card, foundation, state.cards, to.suit)
		if (err) return `pile-${from.index} → foundation: ${err}`
		srcPile.pop()
		foundation.push(cardIdx)
		flipNewTopIfFaceDown(srcPile, state.cards)
		return undefined
	}

	// foundation → pile (undo-ish; rare but allowed in Klondike)
	if (from.type === 'foundation' && to.type === 'pile') {
		const foundation = state.foundations[from.suit]
		if (foundation.length === 0) return `foundation-${from.suit} is empty`
		const cardIdx = foundation[foundation.length - 1]
		const card = state.cards[cardIdx]
		const dstPile = state.piles[to.index]
		const err = validateCanPlaceOnPile(card, dstPile, state.cards)
		if (err) return `foundation → pile-${to.index}: ${err}`
		foundation.pop()
		dstPile.push(cardIdx)
		return undefined
	}

	return `unsupported move: ${from.type} → ${to.type}`
}

function flipNewTopIfFaceDown(pile: number[], cards: SolitaireCard[]): void {
	if (pile.length === 0) return
	const top = pile[pile.length - 1]
	if (!cards[top].faceUp) {
		cards[top].faceUp = true
	}
}

/** Draw `drawSize` cards from stock to waste, flipping each face-up. */
export function drawFromStock(state: SolitaireBoardState): number {
	if (state.stock.length === 0) return 0
	const count = Math.min(state.drawSize, state.stock.length)
	for (let i = 0; i < count; ++i) {
		const idx = state.stock.shift()!
		state.cards[idx].faceUp = true
		state.waste.push(idx)
	}
	return count
}

/** Recycle waste back to stock (face-down) when stock is empty. */
export function recycleWaste(state: SolitaireBoardState): boolean {
	if (state.stock.length !== 0) return false
	if (state.waste.length === 0) return false
	while (state.waste.length > 0) {
		const idx = state.waste.shift()!
		state.cards[idx].faceUp = false
		state.stock.push(idx)
	}
	return true
}

/** Sum of foundation lengths == 52 means a won game. */
export function isWon(state: SolitaireBoardState): boolean {
	let total = 0
	for (let i = 0; i < 4; ++i) total += state.foundations[i].length
	return total === 52
}

/** True when every pile card is face-up (auto-complete is now safe). */
export function allTableauFaceUp(state: SolitaireBoardState): boolean {
	for (const pile of state.piles) {
		for (const idx of pile) {
			if (!state.cards[idx].faceUp) return false
		}
	}
	return true
}
