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

import { Container, Graphics, Text } from 'pixi.js'
import type { RenderContext } from './render-context'
import { CBoardState, CSelectedCardRef } from '../components'
import type { SolitaireBoardState, Suit } from '../logic/types'
import { isRedSuit, suitGlyph } from '../logic/deck'
import {
	CardTapEventId,
	FoundationCompletedEventId,
	LocationTapEventId,
	MoveExecutedEventId,
	type CardTapEventData,
	type FoundationCompletedEventData,
	type LocationTapEventData,
	type MoveExecutedEventData,
} from '../events'
import { createCardVisual, type CardVisual } from './card-visual'
import { parseHex } from './palette'
import { flash, motionDurationMs, pulseScale, sweep } from '../render-personality/juice'

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
		flashOverlay: Graphics
		sweepLayer: Graphics
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

		// Flash overlay (success pulse on placement).
		const flashOverlay = new Graphics()
		flashOverlay.eventMode = 'none'
		flashOverlay.visible = false
		flashOverlay.alpha = 0
		c.addChild(flashOverlay)

		// Sweep layer (K-rollover foundation-completed wash).
		const sweepLayer = new Graphics()
		sweepLayer.eventMode = 'none'
		sweepLayer.visible = false
		c.addChild(sweepLayer)

		slots.push({ container: c, card: cardVisual, suitHint, flashOverlay, sweepLayer })
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

	const successColor = parseHex(context.pack.palette.success)
	const accentColor = parseHex(context.pack.palette.accent)

	function paintFlash(g: Graphics, w: number, h: number, radius: number, color: number): void {
		g.clear()
		g.roundRect(0, 0, w, h, radius)
		g.fill({ color, alpha: 0.72 })
	}

	// Moment 4a — pulse + green flash when a card lands on this foundation slot.
	const unsubMove = context.eventsCenter.addListener<MoveExecutedEventData>(
		MoveExecutedEventId,
		(data) => {
			if (!data.to || data.to.type !== 'foundation') return
			const suit = data.to.suit
			const slot = slots[suit]
			if (!slot) return
			const layout = context.getLayout()
			const rect = layout.foundationRects[suit] ?? layout.foundationRects[0]!
			const radius = context.pack.personalityTheme.shape.cornerRadius.md
			void pulseScale(slot.card.content, {
				from: 1,
				peak: 1.08,
				rest: 1,
				baseMs: motionDurationMs(context.pack, 'popMs', 180),
				eventClass: 'feedback',
				pack: context.pack,
			})
			paintFlash(slot.flashOverlay, rect.width, rect.height, radius, successColor)
			void flash(slot.flashOverlay, {
				baseMs: motionDurationMs(context.pack, 'popMs', 240),
				pack: context.pack,
				eventClass: 'feedback',
			})
		},
	)

	// Moment 5 — vertical sweep on the K-rollover foundation completion.
	const unsubComplete = context.eventsCenter.addListener<FoundationCompletedEventData>(
		FoundationCompletedEventId,
		(data) => {
			const slot = slots[data.suit]
			if (!slot) return
			const layout = context.getLayout()
			const rect = layout.foundationRects[data.suit] ?? layout.foundationRects[0]!
			void sweep(slot.sweepLayer, {
				rect: { x: 0, y: 0, w: rect.width, h: rect.height },
				axis: 'vertical',
				color: accentColor,
				bandFraction: 0.28,
				baseMs: motionDurationMs(context.pack, 'sweepMs', 520),
				pack: context.pack,
			})
		},
	)

	function destroy(): void {
		unsubMove?.()
		unsubComplete?.()
	}

	return { layer, render, destroy }
}
