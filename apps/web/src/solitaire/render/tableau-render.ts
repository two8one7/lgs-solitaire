/**
 * tableau-render — paints the 7 fanned columns.
 *
 * One Container per column. Each column's cards are stacked top-to-bottom
 * using `tableauCardYOffset`, so face-up cards leave room for the rank+suit
 * and face-down cards stack tight.
 *
 * Interaction: every card hit-area is a thin slice over the visible portion
 * of its card (the part not covered by the card below it). The bottom (top
 * of the visual stack) card uses the full card rect. Tap dispatches a
 * LocationTapEvent with `{ type: 'pile', index }` + `depth`.
 *
 * The selection-render layer paints the highlight overlay; tableau-render
 * only consumes `selectionPredicate` to dim non-selected items if Phase 4
 * decides to.
 *
 * No GSAP. Animations land in card-flip-anim-render / move-anim-render later.
 */

import { Container } from 'pixi.js'
import type { RenderContext } from './render-context'
import type { SolitaireBoardState } from '../logic/types'
import { CBoardState, CSelectedCardRef, CSelectionRunLength } from '../components'
import {
	CardTapEventId,
	LocationTapEventId,
	type CardTapEventData,
	type LocationTapEventData,
} from '../events'
import { tableauCardYOffset } from './layout'
import { createCardVisual, type CardVisual } from './card-visual'
import { parseHex } from './palette'

export type TableauRenderDeps = {
	parent: Container
	context: RenderContext
}

export function createTableauRender(deps: TableauRenderDeps) {
	const { parent, context } = deps
	const layer = new Container()
	layer.label = 'solitaire:tableau'
	parent.addChild(layer)

	// 7 columns × dynamic depth. We resize the visuals[][] grid as state grows.
	const visuals: CardVisual[][] = [[], [], [], [], [], [], []]
	const columnContainers: Container[] = []
	for (let i = 0; i < 7; i++) {
		const c = new Container()
		c.label = `tableau-col-${i}`
		layer.addChild(c)
		columnContainers.push(c)
	}

	function ensureVisualAt(colIdx: number, depth: number): CardVisual {
		const col = visuals[colIdx]!
		const existing = col[depth]
		if (existing) return existing
		const v = createCardVisual(context.palette)
		columnContainers[colIdx]!.addChild(v.container)
		v.container.eventMode = 'static'
		v.container.cursor = 'pointer'
		v.container.on('pointertap', () => {
			context.eventsCenter.dispatch<CardTapEventData>(
				{ id: CardTapEventId, source: 'tableau' },
				true,
			)
			context.eventsCenter.dispatch<LocationTapEventData>(
				{ id: LocationTapEventId, location: { type: 'pile', index: colIdx }, depth },
				true,
			)
		})
		col[depth] = v
		return v
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
		const selColumn = CSelectedCardRef.column[sWi][sIdx] as number
		const selDepth = CSelectedCardRef.depth[sWi][sIdx] as number
		const selRun = (CSelectionRunLength.value[sWi][sIdx] as number) ?? 0
		const radius = context.pack.personalityTheme.shape.cornerRadius.md
		const glowColor = parseHex(context.pack.palette.accentAlt)
		const glowAlpha = context.pack.juice.glows.selectedAnswer.alpha ?? 0.95
		const selectedScale = context.pack.juice.transitions.answerHoverIn.scale ?? 1

		for (let colIdx = 0; colIdx < 7; colIdx++) {
			const pile = state.piles[colIdx]!
			const topRect = layout.tableauTopRects[colIdx]!
			const colC = columnContainers[colIdx]!
			colC.x = topRect.x
			colC.y = topRect.y

			// Re-emit cards bottom-up so highest-depth child paints on top.
			const fanned: { faceUp: boolean }[] = pile.map((cardIdx) => ({
				faceUp: state.cards[cardIdx]!.faceUp,
			}))
			for (let depth = 0; depth < pile.length; depth++) {
				const cardIdx = pile[depth]!
				const card = state.cards[cardIdx]!
				const v = ensureVisualAt(colIdx, depth)
				v.container.y = tableauCardYOffset(fanned, depth, layout)
				v.container.x = 0
				v.container.visible = true
				const highlighted =
					selPile === 'tableau' &&
					selColumn === colIdx &&
					depth >= selDepth &&
					depth < selDepth + Math.max(selRun, 1)
				v.container.scale.set(highlighted ? selectedScale : 1)
				v.apply(card, layout.cardWidth, layout.cardHeight, {
					highlighted,
					radius,
					cardBackTexture: context.pack.solitaire.cardBack.texture,
					glowColor,
					glowAlpha,
				})
			}

			// Empty pile slot — show a placeholder hit target for King drops.
			if (pile.length === 0) {
				const v = ensureVisualAt(colIdx, 0)
				v.container.x = 0
				v.container.y = 0
				v.container.visible = true
				v.container.scale.set(1)
				v.apply(null, layout.cardWidth, layout.cardHeight, { radius })
			}

			// Hide extra visuals beyond current pile length.
			const visCol = visuals[colIdx]!
			const minVisible = Math.max(1, pile.length)
			for (let depth = minVisible; depth < visCol.length; depth++) {
				visCol[depth]!.container.visible = false
			}
		}
	}

	return { layer, render }
}
