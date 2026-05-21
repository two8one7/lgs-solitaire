/**
 * stock-waste-render — paints the stock + waste piles.
 *
 * Stock: a face-down card if any remain, or an empty "↺" recycle hint if not.
 * Tap dispatches StockTapEvent (handled by stock-cycle: draw or recycle).
 *
 * Waste: shows the top card (face-up) of the waste pile. Empty waste renders
 * as a translucent slot. Tap dispatches LocationTapEvent for waste.
 */

import { Container, Graphics, Text } from 'pixi.js'
import type { RenderContext } from './render-context'
import { CBoardState, CSelectedCardRef } from '../components'
import type { SolitaireBoardState } from '../logic/types'
import {
	CardPickupEventId,
	CardTapEventId,
	LocationTapEventId,
	MoveExecutedEventId,
	MoveRejectedEventId,
	StockTapEventId,
	type CardPickupEventData,
	type CardTapEventData,
	type LocationTapEventData,
	type MoveExecutedEventData,
	type MoveRejectedEventData,
	type StockTapEventData,
} from '../events'
import { createCardVisual, type CardVisual } from './card-visual'
import { parseHex } from './palette'
import { flash, motionDurationMs, pulseScale, shake, vibrate } from '../render-personality/juice'

export type StockWasteRenderDeps = {
	parent: Container
	context: RenderContext
}

export function createStockWasteRender(deps: StockWasteRenderDeps) {
	const { parent, context } = deps
	const layer = new Container()
	layer.label = 'solitaire:stock-waste'
	parent.addChild(layer)

	// Stock
	const stockContainer = new Container()
	stockContainer.label = 'stock'
	stockContainer.eventMode = 'static'
	stockContainer.cursor = 'pointer'
	stockContainer.on('pointertap', () => {
		context.eventsCenter.dispatch<CardTapEventData>(
			{ id: CardTapEventId, source: 'stock' },
			true,
		)
		context.eventsCenter.dispatch<StockTapEventData>({ id: StockTapEventId }, true)
	})
	layer.addChild(stockContainer)

	const stockCard: CardVisual = createCardVisual(context.palette)
	stockContainer.addChild(stockCard.container)

	const stockEmptyHint = new Graphics()
	stockContainer.addChild(stockEmptyHint)

	const stockRecycleGlyph = new Text({
		text: '\u21BA',
		style: {
			fill: context.palette.textSecondary,
			fontFamily: 'Georgia, "Times New Roman", serif',
			fontSize: 28,
			fontWeight: '700',
		},
	})
	stockRecycleGlyph.anchor.set(0.5)
	stockRecycleGlyph.visible = false
	stockContainer.addChild(stockRecycleGlyph)

	const stockCount = new Text({
		text: '',
		style: {
			fill: context.palette.textPrimary,
			fontFamily: 'Georgia, "Times New Roman", serif',
			fontSize: 12,
			fontWeight: '700',
		},
	})
	stockCount.anchor.set(1, 1)
	stockContainer.addChild(stockCount)

	// Waste
	const wasteContainer = new Container()
	wasteContainer.label = 'waste'
	wasteContainer.eventMode = 'static'
	wasteContainer.cursor = 'pointer'
	wasteContainer.on('pointertap', () => {
		context.eventsCenter.dispatch<CardTapEventData>(
			{ id: CardTapEventId, source: 'waste' },
			true,
		)
		context.eventsCenter.dispatch<LocationTapEventData>(
			{ id: LocationTapEventId, location: { type: 'waste' }, depth: 0 },
			true,
		)
	})
	layer.addChild(wasteContainer)

	const wasteCard: CardVisual = createCardVisual(context.palette)
	wasteContainer.addChild(wasteCard.container)

	// Per-card flash overlays — one each for waste source feedback.
	const wasteFlash = new Graphics()
	wasteFlash.eventMode = 'none'
	wasteFlash.visible = false
	wasteFlash.alpha = 0
	wasteContainer.addChild(wasteFlash)

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
		const radius = context.pack.personalityTheme.shape.cornerRadius.md
		const glowColor = parseHex(context.pack.palette.accentAlt)
		const glowAlpha = context.pack.juice.glows.selectedAnswer.alpha ?? 0.95

		// Stock placement
		stockContainer.x = layout.stockRect.x
		stockContainer.y = layout.stockRect.y
		if (state.stock.length > 0) {
			stockCard.apply(
				{ suit: 0, value: 0, faceUp: false },
				layout.cardWidth,
				layout.cardHeight,
				{ radius, cardBackTexture: context.pack.solitaire.cardBack.texture },
			)
			stockEmptyHint.clear()
			stockRecycleGlyph.visible = false
			stockCount.text = `${state.stock.length}`
			stockCount.x = layout.cardWidth - 6
			stockCount.y = layout.cardHeight - 4
			stockCount.visible = true
		} else {
			// Empty stock → recycle hint
			stockCard.apply(null, layout.cardWidth, layout.cardHeight, { radius })
			stockRecycleGlyph.visible = true
			stockRecycleGlyph.x = layout.cardWidth / 2
			stockRecycleGlyph.y = layout.cardHeight / 2
			stockCount.visible = false
		}

		// Waste placement
		wasteContainer.x = layout.wasteRect.x
		wasteContainer.y = layout.wasteRect.y
		const highlightWaste = selPile === 'waste'
		if (state.waste.length > 0) {
			const topIdx = state.waste[state.waste.length - 1]!
			const card = state.cards[topIdx]!
			wasteCard.apply(card, layout.cardWidth, layout.cardHeight, {
				highlighted: highlightWaste,
				radius,
				glowColor,
				glowAlpha,
			})
		} else {
			wasteCard.apply(null, layout.cardWidth, layout.cardHeight, { radius })
		}
	}

	const incorrectColor = parseHex(context.pack.palette.incorrect)

	function paintFlashRect(g: Graphics, w: number, h: number, radius: number, color: number): void {
		g.clear()
		g.roundRect(0, 0, w, h, radius)
		g.fill({ color, alpha: 0.78 })
	}

	// Moment 3 — squash when waste card is picked up.
	const unsubPickup = context.eventsCenter.addListener<CardPickupEventData>(
		CardPickupEventId,
		(data) => {
			if (data.source !== 'waste') return
			void pulseScale(wasteCard.content, {
				from: 1,
				peak: 0.94,
				rest: 1,
				baseMs: motionDurationMs(context.pack, 'popMs', 180),
				eventClass: 'feedback',
				pack: context.pack,
			})
		},
	)

	// Stock-tap micro-pulse — light feedback when player draws/recycles.
	const unsubStockTap = context.eventsCenter.addListener<StockTapEventData>(
		StockTapEventId,
		() => {
			void pulseScale(stockCard.content, {
				from: 1,
				peak: 0.96,
				rest: 1,
				baseMs: motionDurationMs(context.pack, 'popMs', 160),
				eventClass: 'feedback',
				pack: context.pack,
			})
		},
	)

	// Moment 4b — shake the waste source card when the player's selected waste
	// move is rejected.
	const unsubReject = context.eventsCenter.addListener<MoveRejectedEventData>(
		MoveRejectedEventId,
		(data) => {
			if (!data.from || data.from.type !== 'waste') return
			const layout = context.getLayout()
			const radius = context.pack.personalityTheme.shape.cornerRadius.md
			vibrate(20)
			void shake(wasteCard.shakeWrap, {
				amplitude: context.pack.juice.shake.incorrect.amplitude ?? 4,
				cycles: 3,
				baseMs: motionDurationMs(context.pack, 'shakeMs', 200),
				pack: context.pack,
				axis: 'horizontal',
			})
			paintFlashRect(wasteFlash, layout.cardWidth, layout.cardHeight, radius, incorrectColor)
			void flash(wasteFlash, {
				baseMs: motionDurationMs(context.pack, 'shakeMs', 220),
				pack: context.pack,
				eventClass: 'feedback',
			})
		},
	)

	// Moment 4a (waste-source success leg) — when MoveExecuted's source is
	// waste, the waste top card briefly pulses out (so the player sees their
	// source acknowledge).
	const unsubMove = context.eventsCenter.addListener<MoveExecutedEventData>(
		MoveExecutedEventId,
		(data) => {
			if (!data.from || data.from.type !== 'waste') return
			void pulseScale(wasteCard.content, {
				from: 1,
				peak: 1.04,
				rest: 1,
				baseMs: motionDurationMs(context.pack, 'popMs', 180),
				eventClass: 'feedback',
				pack: context.pack,
			})
		},
	)

	function destroy(): void {
		unsubPickup?.()
		unsubStockTap?.()
		unsubReject?.()
		unsubMove?.()
	}

	return { layer, render, destroy }
}
