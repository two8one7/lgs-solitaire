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

import { Container, Graphics } from 'pixi.js'
import type { RenderContext } from './render-context'
import type { SolitaireBoardState } from '../logic/types'
import { CBoardState, CSelectedCardRef, CSelectionRunLength } from '../components'
import {
	CardPickupEventId,
	CardTapEventId,
	LocationTapEventId,
	MoveExecutedEventId,
	MoveRejectedEventId,
	type CardPickupEventData,
	type CardTapEventData,
	type LocationTapEventData,
	type MoveExecutedEventData,
	type MoveRejectedEventData,
} from '../events'
import { tableauCardYOffset } from './layout'
import { createCardVisual, type CardVisual } from './card-visual'
import { parseHex } from './palette'
import {
	cardEntrance,
	flash,
	motionDurationMs,
	pulseScale,
	shake,
	vibrate,
} from '../render-personality/juice'

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

	// Per-card flash overlays (one Graphics per visual, painted/cleared on demand).
	// Keyed by colIdx:depth so we don't allocate a new Graphics per flash.
	const flashOverlays = new Map<string, Graphics>()
	function flashKey(col: number, depth: number): string {
		return `${col}:${depth}`
	}
	function ensureFlashOverlay(col: number, depth: number): Graphics {
		const k = flashKey(col, depth)
		const existing = flashOverlays.get(k)
		if (existing) return existing
		const g = new Graphics()
		g.eventMode = 'none'
		g.visible = false
		g.alpha = 0
		// Same parent as the card visual so it tracks layout writes.
		columnContainers[col]!.addChild(g)
		flashOverlays.set(k, g)
		return g
	}
	function paintFlash(
		g: Graphics,
		x: number,
		y: number,
		w: number,
		h: number,
		radius: number,
		color: number,
	): void {
		g.clear()
		g.roundRect(x, y, w, h, radius)
		g.fill({ color, alpha: 0.78 })
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

	// ── Pack-driven juice listeners (Phase 3 fan-out) ────────────────────────
	// Each listener captures the event's grid position then defers the visual
	// lookup with rAF — by the time the next frame paints, render() has reused
	// the matching CardVisual at that (col, depth).

	function nextFrame(cb: () => void): void {
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => cb())
		} else {
			setTimeout(cb, 16)
		}
	}

	function topDepthOfPile(colIdx: number): number {
		const board = context.entities.board
		const state = CBoardState.value[board.worldIndex][board.index] as SolitaireBoardState | null
		if (!state) return 0
		const len = state.piles[colIdx]?.length ?? 0
		return Math.max(0, len - 1)
	}

	const successColor = parseHex(context.pack.palette.success)
	const incorrectColor = parseHex(context.pack.palette.incorrect)

	// Moment 3 — squash on card pickup from the tableau.
	const unsubPickup = context.eventsCenter.addListener<CardPickupEventData>(
		CardPickupEventId,
		(data) => {
			if (data.source !== 'tableau') return
			const sWi = context.entities.selection.worldIndex
			const sIdx = context.entities.selection.index
			const col = CSelectedCardRef.column[sWi][sIdx] as number
			const depth = CSelectedCardRef.depth[sWi][sIdx] as number
			if (typeof col !== 'number' || col < 0 || col >= 7) return
			const v = visuals[col]?.[depth]
			if (!v) return
			void pulseScale(v.content, {
				from: 1,
				peak: 0.94,
				rest: 1,
				baseMs: motionDurationMs(context.pack, 'popMs', 180),
				eventClass: 'feedback',
				pack: context.pack,
			})
		},
	)

	// Moment 4a — pulse + green flash on the destination tableau card.
	const unsubMove = context.eventsCenter.addListener<MoveExecutedEventData>(
		MoveExecutedEventId,
		(data) => {
			if (!data.to || data.to.type !== 'pile') return
			const colIdx = data.to.index
			nextFrame(() => {
				const depth = topDepthOfPile(colIdx)
				const v = visuals[colIdx]?.[depth]
				if (!v) return
				const layout = context.getLayout()
				const radius = context.pack.personalityTheme.shape.cornerRadius.md
				void pulseScale(v.content, {
					from: 1,
					peak: 1.06,
					rest: 1,
					baseMs: motionDurationMs(context.pack, 'popMs', 180),
					eventClass: 'feedback',
					pack: context.pack,
				})
				const overlay = ensureFlashOverlay(colIdx, depth)
				paintFlash(
					overlay,
					v.container.x,
					v.container.y,
					layout.cardWidth,
					layout.cardHeight,
					radius,
					successColor,
				)
				void flash(overlay, {
					baseMs: motionDurationMs(context.pack, 'popMs', 220),
					pack: context.pack,
					eventClass: 'feedback',
				})
			})
		},
	)

	// Moment 4b — shake + red flash + haptic on the rejected source card.
	const unsubReject = context.eventsCenter.addListener<MoveRejectedEventData>(
		MoveRejectedEventId,
		(data) => {
			if (!data.from || data.from.type !== 'pile') return
			const colIdx = data.from.index
			const depth = topDepthOfPile(colIdx)
			const v = visuals[colIdx]?.[depth]
			if (!v) return
			const layout = context.getLayout()
			const radius = context.pack.personalityTheme.shape.cornerRadius.md
			vibrate(20)
			void shake(v.shakeWrap, {
				amplitude: context.pack.juice.shake.incorrect.amplitude ?? 4,
				cycles: 3,
				baseMs: motionDurationMs(context.pack, 'shakeMs', 200),
				pack: context.pack,
				axis: 'horizontal',
			})
			const overlay = ensureFlashOverlay(colIdx, depth)
			paintFlash(
				overlay,
				v.container.x,
				v.container.y,
				layout.cardWidth,
				layout.cardHeight,
				radius,
				incorrectColor,
			)
			void flash(overlay, {
				baseMs: motionDurationMs(context.pack, 'shakeMs', 220),
				pack: context.pack,
				eventClass: 'feedback',
			})
		},
	)

	// Moment 2 — staggered deal entrance. Driven from playing-scene on enter;
	// here we expose the API so the scene can invoke it once visuals are paint.
	function playDealEntrance(): void {
		const board = context.entities.board
		const state = CBoardState.value[board.worldIndex][board.index] as SolitaireBoardState | null
		if (!state) return
		const baseStaggerMs = motionDurationMs(context.pack, 'staggerMs', 55)
		// Row-major reveal: column 0 fires first, then 1..6.
		for (let colIdx = 0; colIdx < 7; colIdx++) {
			const delay = baseStaggerMs * colIdx
			const idx = colIdx
			setTimeout(() => {
				const pile = state.piles[idx] ?? []
				for (let depth = 0; depth < pile.length; depth++) {
					const v = visuals[idx]?.[depth]
					if (!v) continue
					void cardEntrance(v.content, context.pack)
				}
			}, delay)
		}
	}

	function destroy(): void {
		unsubPickup?.()
		unsubMove?.()
		unsubReject?.()
	}

	return { layer, render, playDealEntrance, destroy }
}
