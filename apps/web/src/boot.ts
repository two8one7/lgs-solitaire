/**
 * Boot wiring for LGS Solitaire — Phase 2 scaffold.
 * 
 * Minimal Pixi v8 bootstrap with placeholder text scene.
 * Game logic lands in Phase 3.
 */

import { Application, Container, Text, TextStyle } from 'pixi.js'

export async function boot(canvas: HTMLCanvasElement): Promise<void> {
	// Set TextStyle padding to 56 BEFORE any Text instances (per typography trap skill)
	TextStyle.defaultTextStyle.padding = 56

	const app = new Application()
	await app.init({
		canvas,
		background: 0x1a1a1a,
		antialias: true,
		autoDensity: true,
		resolution: window.devicePixelRatio || 1,
		resizeTo: canvas.parentElement ?? undefined,
	})

	// Single-scene placeholder
	const scene = new Container()
	app.stage.addChild(scene)

	const style = new TextStyle({
		fontFamily: 'system-ui, -apple-system, sans-serif',
		fontSize: 32,
		fill: 0xffffff,
		align: 'center',
	})

	const text = new Text({
		text: 'Lake Nona Solitaire — Phase 2 scaffold',
		style,
	})
	text.anchor.set(0.5)
	text.x = app.screen.width / 2
	text.y = app.screen.height / 2
	scene.addChild(text)

	// Re-center on resize
	app.renderer.on('resize', () => {
		text.x = app.screen.width / 2
		text.y = app.screen.height / 2
	})
}
