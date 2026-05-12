// Adapted from block-blast-cats: threeRenderer and camera are optional.
// GD is Pixi-only — Three.js renderer/camera are never passed.
import type { WebGLRenderer as PixiWebGLRenderer } from 'pixi.js'
import * as store from './store'

export * from './store'

type Props = {
	canvas: HTMLCanvasElement
	/** Optional — omit for Pixi-only hosts (like gravity-dash). */
	pixiRenderer?: PixiWebGLRenderer
	onResize?: (width: number, height: number) => void
}

export function createResizer({
	canvas,
	pixiRenderer,
	onResize,
}: Props) {
	function resize() {
		const parent = canvas.parentElement
		const width = parent?.clientWidth || canvas.clientWidth
		const height = parent?.clientHeight || canvas.clientHeight

		store.setSize(width, height)
		pixiRenderer?.resize(width, height)
		onResize?.(width, height)
	}

	// Initial resize runs immediately
	resize()

	// Subsequent resize events are debounced to prevent storms from layout thrash
	let resizeTimer: ReturnType<typeof setTimeout> | null = null
	let destroyed = false

	function debouncedResize() {
		if (destroyed) return
		if (resizeTimer !== null) {
			clearTimeout(resizeTimer)
		}
		resizeTimer = setTimeout(resize, 100)
	}

	// ResizeObserver fires on both window resize and parent-element layout changes
	// (e.g. editor panel collapse), unlike window.resize which misses the latter.
	const observer = new ResizeObserver(debouncedResize)
	if (canvas.parentElement) {
		observer.observe(canvas.parentElement)
	}

	return {
		destroy() {
			destroyed = true
			if (resizeTimer !== null) {
				clearTimeout(resizeTimer)
			}
			observer.disconnect()
		},
	}
}
