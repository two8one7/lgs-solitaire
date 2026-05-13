/**
 * hud-render — moves counter + timer pip + publisher title.
 *
 * Reads from CMovesCount + CTimeElapsedMs on every render call. Times are
 * formatted as M:SS for sub-hour sessions (typical Klondike). Moves use
 * comma thousands separator (preferences/number-formatting.md).
 *
 * No interaction wiring — the HUD is read-only for the skeleton.
 */

import { Container, Graphics, Text } from 'pixi.js'
import type { RenderContext } from './render-context'
import { CMovesCount, CTimeElapsedMs } from '../components'

export type HudRenderDeps = {
	parent: Container
	context: RenderContext
}

const HUD_FONT = '"Helvetica Neue", Arial, sans-serif'

function formatTime(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	const m = Math.floor(totalSeconds / 60)
	const s = totalSeconds % 60
	return `${m}:${s.toString().padStart(2, '0')}`
}

function formatMoves(n: number): string {
	return n.toLocaleString('en-US')
}

export function createHudRender(deps: HudRenderDeps) {
	const { parent, context } = deps
	const layer = new Container()
	layer.label = 'solitaire:hud'
	parent.addChild(layer)

	const bg = new Graphics()
	bg.eventMode = 'none'
	layer.addChild(bg)

	const titleText = new Text({
		text: context.pack.brand.publisherName,
		style: {
			fill: context.palette.textPrimary,
			fontFamily: HUD_FONT,
			fontSize: 16,
			fontWeight: '700',
		},
	})
	titleText.anchor.set(0, 0.5)
	layer.addChild(titleText)

	const movesText = new Text({
		text: 'Moves 0',
		style: {
			fill: context.palette.textPrimary,
			fontFamily: HUD_FONT,
			fontSize: 14,
			fontWeight: '600',
		},
	})
	movesText.anchor.set(0.5, 0.5)
	layer.addChild(movesText)

	const timerText = new Text({
		text: '0:00',
		style: {
			fill: context.palette.textPrimary,
			fontFamily: HUD_FONT,
			fontSize: 14,
			fontWeight: '700',
		},
	})
	timerText.anchor.set(1, 0.5)
	layer.addChild(timerText)

	function render(): void {
		const layout = context.getLayout()
		const board = context.entities.board
		const timer = context.entities.timer
		const bWi = board.worldIndex
		const bIdx = board.index
		const tWi = timer.worldIndex
		const tIdx = timer.index

		const moves = (CMovesCount.value[bWi][bIdx] as number) ?? 0
		const elapsedMs = (CTimeElapsedMs.value[tWi][tIdx] as number) ?? 0

		bg.clear()
		bg.roundRect(layout.hud.x, layout.hud.y, layout.hud.width, layout.hud.height, 10)
		bg.fill({ color: context.palette.felt, alpha: 0.75 })

		const midY = layout.hud.y + layout.hud.height / 2

		titleText.x = layout.hud.x + 14
		titleText.y = midY
		titleText.style.fill = context.palette.textPrimary

		movesText.text = `Moves ${formatMoves(moves)}`
		movesText.x = layout.hud.x + layout.hud.width / 2
		movesText.y = midY

		timerText.text = formatTime(elapsedMs)
		timerText.x = layout.hud.x + layout.hud.width - 14
		timerText.y = midY
	}

	return { layer, render }
}
