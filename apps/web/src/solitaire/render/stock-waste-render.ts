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
	LocationTapEventId,
	StockTapEventId,
	type LocationTapEventData,
	type StockTapEventData,
} from '../events'
import { createCardVisual, type CardVisual } from './card-visual'

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
		context.eventsCenter.dispatch<LocationTapEventData>(
			{ id: LocationTapEventId, location: { type: 'waste' }, depth: 0 },
			true,
		)
	})
	layer.addChild(wasteContainer)

	const wasteCard: CardVisual = createCardVisual(context.palette)
	wasteContainer.addChild(wasteCard.container)

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

		// Stock placement
		stockContainer.x = layout.stockRect.x
		stockContainer.y = layout.stockRect.y
		if (state.stock.length > 0) {
			stockCard.apply({ suit: 0, value: 0, faceUp: false }, layout.cardWidth, layout.cardHeight)
			stockEmptyHint.clear()
			stockRecycleGlyph.visible = false
			stockCount.text = `${state.stock.length}`
			stockCount.x = layout.cardWidth - 6
			stockCount.y = layout.cardHeight - 4
			stockCount.visible = true
		} else {
			// Empty stock → recycle hint
			stockCard.apply(null, layout.cardWidth, layout.cardHeight)
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
			wasteCard.apply(card, layout.cardWidth, layout.cardHeight, { highlighted: highlightWaste })
		} else {
			wasteCard.apply(null, layout.cardWidth, layout.cardHeight)
		}
	}

	return { layer, render }
}
