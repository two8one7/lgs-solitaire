// Transition fade overlay + horizontal progress bar.
//
// fade(direction, durationS):
//   direction 'in'  fades from black → clear (used on scene enter)
//   direction 'out' fades from clear → black (used on scene exit)
//
// setProgress(ratio): renders a horizontal bar inside the timer rect; used by
// the between-questions scene to indicate "next question in N s." Pure draw.
// Owns no ECS reads; the scene drives ratio + fade calls.
//
// Palette keys consumed from ctx.palette: overlayBg, hudBg, accent.

import { Container, Graphics } from 'pixi.js'
import { getRadius } from './shape-tokens'
import type { RenderContext } from './render-context'

export type FadeDirection = 'in' | 'out'

export type TransitionRender = {
	display: Container
	render: (dt: number) => void
	destroy: () => void
	fade: (direction: FadeDirection, durationS: number) => Promise<void>
	setProgress: (ratio: number) => void
	clearProgress: () => void
}

export function createTransitionRender(ctx: RenderContext): TransitionRender {
	const display = new Container()
	const fadeRect = new Graphics()
	const progressBg = new Graphics()
	const progressFg = new Graphics()
	display.addChild(fadeRect)
	display.addChild(progressBg)
	display.addChild(progressFg)

	let fadeElapsed = 0
	let fadeDuration = 0
	let fadeFrom = 0
	let fadeTo = 0
	let fadeAlpha = 0
	let fadeResolve: (() => void) | null = null

	let progress = -1

	function render(dt: number): void {
		const layout = ctx.getLayout()
		const palette = ctx.palette

		if (fadeDuration > 0) {
			fadeElapsed += dt
			const t = Math.min(1, fadeElapsed / fadeDuration)
			fadeAlpha = fadeFrom + (fadeTo - fadeFrom) * t
			if (t >= 1) {
				fadeDuration = 0
				if (fadeResolve !== null) {
					const r = fadeResolve
					fadeResolve = null
					r()
				}
			}
		}

		fadeRect.clear()
		if (fadeAlpha > 0.001) {
			fadeRect.rect(0, 0, layout.canvasW, layout.canvasH)
			fadeRect.fill({ color: palette.overlayBg ?? 0x000000, alpha: fadeAlpha })
		}

		progressBg.clear()
		progressFg.clear()
		if (progress >= 0) {
			const r = layout.timer
			progressBg.roundRect(r.x, r.y, r.width, r.height, getRadius('sm', ctx.pack, 6))
			progressBg.fill(palette.hudBg ?? 0x000000)
			const innerPad = 2
			const innerW = Math.max(0, (r.width - innerPad * 2) * Math.min(1, progress))
			if (innerW > 0) {
				progressFg.roundRect(r.x + innerPad, r.y + innerPad, innerW, r.height - innerPad * 2, getRadius('sm', ctx.pack, 4))
				progressFg.fill(palette.accent ?? 0xffffff)
			}
		}
	}

	function fade(direction: FadeDirection, durationS: number): Promise<void> {
		fadeFrom = direction === 'in' ? 1 : 0
		fadeTo = direction === 'in' ? 0 : 1
		fadeAlpha = fadeFrom
		fadeElapsed = 0
		fadeDuration = Math.max(0.001, durationS)
		return new Promise((resolve) => {
			fadeResolve = resolve
		})
	}

	function setProgress(ratio: number): void {
		progress = Math.max(0, Math.min(1, ratio))
	}

	function clearProgress(): void {
		progress = -1
	}

	function destroy(): void {
		display.destroy({ children: true })
	}

	return { display, render, destroy, fade, setProgress, clearProgress }
}
