/**
 * foundation-render — paints the 4 foundation slots (one per suit).
 *
 * Each slot shows either:
 *   - an empty placeholder when the foundation has no cards yet, OR
 *   - the top-of-pile card (rank+suit text + center glyph).
 *
 * Tapping the slot dispatches a LocationTapEvent for that foundation.
 * Foundation index 0..3 maps to suit 0..3 (spades, hearts, clubs, diamonds).
 */

import { Container, Text } from 'pixi.js'
import type { RenderContext } from './render-context'
import { CBoardState, CSelectedCardRef } from '../components'
import type { SolitaireBoardState, Suit } from '../logic/types'
import { isRedSuit, suitGlyph } from '../logic/deck'
import {
	CardTapEventId,
	LocationTapEventId,
	type CardTapEventData,
	type LocationTapEventData,
} from '../events'
import { createCardVisual, type CardVisual } from './card-visual'
import { parseHex } from './palette'

export type FoundationRenderDeps = {
	parent: Container
	context: RenderContext
}

export function createFoundationRender(deps: FoundationRenderDeps) {
	const { parent, context } = deps
	const layer = new Container()
	layer.label = 'solitaire:foundations'
	parent.addChild(layer)

	type Slot = {
		container: Container
		card: CardVisual
		suitHint: Text
	}
	const slots: Slot[] = []
	for (let i = 0; i < 4; i++) {
		const suit = i as Suit
		const c = new Container()
		c.label = `foundation-${i}`
		c.eventMode = 'static'
		c.cursor = 'pointer'
		c.on('pointertap', () => {
			context.eventsCenter.dispatch<CardTapEventData>(
				{ id: CardTapEventId, source: 'foundation' },
				true,
			)
			context.eventsCenter.dispatch<LocationTapEventData>(
				{
					id: LocationTapEventId,
					location: { type: 'foundation', suit },
					depth: 0,
				},
				true,
			)
		})
		layer.addChild(c)

		const cardVisual = createCardVisual(context.palette)
		c.addChild(cardVisual.container)

		const suitHint = new Text({
			text: suitGlyph(suit),
			style: {
				fill: isRedSuit(suit) ? context.palette.suitRed : context.palette.suitBlack,
				fontFamily: 'Georgia, "Times New Roman", serif',
				fontSize: 22,
				fontWeight: '700',
			},
		})
		suitHint.anchor.set(0.5)
		suitHint.alpha = 0.5
		c.addChild(suitHint)

		slots.push({ container: c, card: cardVisual, suitHint })
	}

	function render(): void {
		const board = context.entities.board
		const bWi = board.worldIndex
		const bIdx = board.index
		const state = CBoardState.value[bWi][bIdx] as SolitaireBoardState | null
		if (!state) return
		const layout = context.getLayout()
		const sWi = context.entities.selection.worldIndex
		const sIdx = context.entities.selection.index
		const selPile = CSelectedCardRef.pile[sWi][sIdx] as string
		const selCol = CSelectedCardRef.column[sWi][sIdx] as number
		const radius = context.pack.personalityTheme.shape.cornerRadius.md
		const glowColor = parseHex(context.pack.palette.accentAlt)
		const glowAlpha = context.pack.juice.glows.selectedAnswer.alpha ?? 0.95

		for (let i = 0; i < 4; i++) {
			const slot = slots[i]!
			const rect = layout.foundationRects[i]!
			slot.container.x = rect.x
			slot.container.y = rect.y

			const found = state.foundations[i]!
			const highlighted = selPile === 'foundation' && selCol === i
			if (found.length === 0) {
				slot.card.apply(null, rect.width, rect.height, { highlighted, radius })
				slot.suitHint.x = rect.width / 2
				slot.suitHint.y = rect.height / 2
				slot.suitHint.visible = true
			} else {
				const topIdx = found[found.length - 1]!
				const card = state.cards[topIdx]!
				slot.card.apply(card, rect.width, rect.height, {
					highlighted,
					radius,
					glowColor,
					glowAlpha,
				})
				slot.suitHint.visible = false
			}
		}
	}

	return { layer, render }
}
