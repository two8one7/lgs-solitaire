/**
 * Playing scene — the keystone gameplay scene for Klondike Draw-1.
 *
 * Owns the tableau, foundation, stock-waste, and HUD render layers. Each
 * frame:
 *   - runtime.tick(dt) drives every logic system (timer, auto-complete,
 *     win-check, streak-update, save).
 *   - tableau / foundation / stock-waste / hud redraw from live ECS state.
 *   - When CCompletedFlag lands on the Board entity, route to 'complete'.
 *
 * Input is event-driven: render systems dispatch LocationTap / StockTap
 * onto the eventsCenter; input-system + stock-cycle listen for them.
 */

import { Container, Graphics } from 'pixi.js'
import { createQuery } from '@2817/ecs'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import type { SceneServices } from './scene-services'
import { parseHex, toRenderPalette } from '../render/palette'
import {
	createTableauRender,
	createFoundationRender,
	createStockWasteRender,
	createHudRender,
} from '../render'
import type { RenderContext } from '../render'
import { CCompletedFlag } from '../components'

export type PlayingScene = IScreen & {
	resize: (w: number, h: number) => void
}

export function createPlayingScene(services: SceneServices): PlayingScene {
	const { runtime, pack } = services
	const display = new Container()
	display.eventMode = 'static'

	const bg = new Graphics()
	display.addChild(bg)

	const renderPalette = toRenderPalette(pack.palette)

	const ctx: RenderContext = {
		world: runtime.world,
		eventsCenter: runtime.eventsCenter,
		pack,
		palette: renderPalette,
		getLayout: services.getLayout,
		entities: runtime.entities,
	}

	const tableau = createTableauRender({ parent: display, context: ctx })
	const foundations = createFoundationRender({ parent: display, context: ctx })
	const stockWaste = createStockWasteRender({ parent: display, context: ctx })
	const hud = createHudRender({ parent: display, context: ctx })

	// One-shot completion query — fires once the Board picks up CCompletedFlag.
	const completedQ = createQuery(runtime.world, { with: [CCompletedFlag] })

	let completedRouted = false

	function paintBg(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.palette.feltColor) })
	}

	function renderAll(): void {
		tableau.render()
		foundations.render()
		stockWaste.render()
		hud.render()
	}

	function resize(w: number, h: number): void {
		paintBg(w, h)
		renderAll()
	}

	function update(dt: number): void {
		runtime.tick(dt)
		renderAll()

		if (!completedRouted && completedQ().length > 0) {
			completedRouted = true
			// Brief hold so the final move settles before the complete scene takes over.
			setTimeout(() => {
				void services.manager().go('complete')
			}, 900)
		}
	}

	async function enter(_manager: IScreenManager): Promise<void> {
		const { width, height } = services.getCanvasSize()
		resize(width, height)
	}

	async function exit(_manager: IScreenManager): Promise<void> {
		// No-op: render systems own their event handlers on their own containers.
	}

	function destroy(): void {
		display.destroy({ children: true })
	}

	return {
		name: 'playing',
		display,
		enter,
		exit,
		update,
		destroy,
		resize,
	}
}
