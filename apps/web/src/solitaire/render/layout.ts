/**
 * Klondike screen layout — pure geometry, no Pixi.
 *
 * Vertical stack (top → bottom):
 *   [PAD] hud (publisher · timer · moves) [PAD]
 *   [PAD] top-row: stock | waste | gap | 4 foundations [PAD]
 *   [PAD] 7 tableau columns, each with vertical fan offset [PAD]
 *
 * Tableau height plans for 19 fanned cards per column (worst case during the
 * middle of a long run); cards beyond that pile up at the bottom which is
 * acceptable for a skeleton render. cardWidth picks the largest size that
 * keeps the 7-column row + outer padding inside `canvasW`.
 *
 * Pure: same (canvasW, canvasH) always returns the same Layout.
 */

export type Rect = { x: number; y: number; width: number; height: number }

export type Layout = {
	canvasW: number
	canvasH: number
	pad: number
	hud: Rect
	stockRect: Rect
	wasteRect: Rect
	/** 4 foundation slots, indexed by suit (0=spades..3=diamonds). */
	foundationRects: [Rect, Rect, Rect, Rect]
	/** 7 tableau column rects — top-card rect; fanned cards sit below at fanStep. */
	tableauTopRects: Rect[]
	cardWidth: number
	cardHeight: number
	cardGap: number
	/** Vertical offset between fanned face-up cards in a tableau column. */
	fanStep: number
	/** Smaller offset for face-down cards (visual cue they're stacked tight). */
	fanStepFaceDown: number
}

const HUD_HEIGHT = 48
const CARD_GAP = 10
const TOP_ROW_GAP = 14

export function computeLayout(canvasW: number, canvasH: number): Layout {
	const pad = Math.max(10, Math.round(Math.min(canvasW, canvasH) * 0.018))

	// 7 columns of card width plus 6 gaps must fit in (canvasW - 2*pad).
	const availableW = canvasW - pad * 2
	const cardWidth = Math.max(40, Math.floor((availableW - CARD_GAP * 6) / 7))
	// 3:2 portrait aspect — classic playing-card proportion.
	const cardHeight = Math.round(cardWidth * 1.4)

	const hud: Rect = {
		x: pad,
		y: pad,
		width: availableW,
		height: HUD_HEIGHT,
	}

	const topRowY = hud.y + hud.height + TOP_ROW_GAP
	const stockRect: Rect = {
		x: pad,
		y: topRowY,
		width: cardWidth,
		height: cardHeight,
	}
	const wasteRect: Rect = {
		x: stockRect.x + cardWidth + CARD_GAP,
		y: topRowY,
		width: cardWidth,
		height: cardHeight,
	}
	// Foundations sit on columns 3..6 (right-aligned across the same 7-column grid).
	const foundationRects: [Rect, Rect, Rect, Rect] = [0, 1, 2, 3].map((i) => ({
		x: pad + (3 + i) * (cardWidth + CARD_GAP),
		y: topRowY,
		width: cardWidth,
		height: cardHeight,
	})) as [Rect, Rect, Rect, Rect]

	const tableauY = topRowY + cardHeight + TOP_ROW_GAP
	const tableauTopRects: Rect[] = []
	for (let i = 0; i < 7; i++) {
		tableauTopRects.push({
			x: pad + i * (cardWidth + CARD_GAP),
			y: tableauY,
			width: cardWidth,
			height: cardHeight,
		})
	}

	const fanStep = Math.max(14, Math.round(cardHeight * 0.22))
	const fanStepFaceDown = Math.max(8, Math.round(fanStep * 0.55))

	return {
		canvasW,
		canvasH,
		pad,
		hud,
		stockRect,
		wasteRect,
		foundationRects,
		tableauTopRects,
		cardWidth,
		cardHeight,
		cardGap: CARD_GAP,
		fanStep,
		fanStepFaceDown,
	}
}

/** Y offset of the `depth`-th card in a tableau column, given the column's pile array. */
export function tableauCardYOffset(
	pile: { faceUp: boolean }[],
	depth: number,
	layout: Layout,
): number {
	let y = 0
	for (let i = 0; i < depth; i++) {
		y += pile[i]!.faceUp ? layout.fanStep : layout.fanStepFaceDown
	}
	return y
}
