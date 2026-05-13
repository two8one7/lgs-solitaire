/**
 * Boot wiring for LGS Solitaire — Phase 3 playable skeleton.
 *
 * Pixi init → daily artifact fetch → runtime composition → scene wiring
 * → gameloop start. Mirrors lgs-memory's boot in shape; differences are
 * isolated to Solitaire's runtime and the lack of Phase 4 scenes
 * (onboarding / locked / challenge land later).
 */

import { Application, Container, TextStyle } from 'pixi.js'
import { createResizer } from '@2817/canvas-resizer'
import { createRaf } from '@2817/gameloop'
import { createScreenManager } from '@2817/screen-manager'
import { solitairePack } from './solitaire/pack-loader'
import { fetchDailyDeal } from './solitaire/systems'
import { todayInZone } from './solitaire/runtime/today'
import { createSaveStore, createResilientStorage } from './solitaire/save/store'
import { hydrateSlotFromSave } from './solitaire/save/schema'
import { createSolitaireRuntime } from './solitaire/runtime'
import {
	createSceneServices,
	createBootScene,
	createTitleScene,
	createPlayingScene,
	createCompleteScene,
} from './solitaire/screens'
import { parseHex } from './solitaire/render/palette'

export async function boot(canvas: HTMLCanvasElement): Promise<void> {
	// Reserve generous TextStyle padding — Pixi v8 underestimates bounds on
	// heavy display weights (see skills/pixi-v8-pack-typography).
	TextStyle.defaultTextStyle.padding = 56

	const app = new Application()
	await app.init({
		canvas,
		background: parseHex(solitairePack.palette.bg),
		antialias: true,
		autoDensity: true,
		resolution: window.devicePixelRatio || 1,
		resizeTo: canvas.parentElement ?? undefined,
	})

	// Three-layer stage: screens / modals / transitions.
	const screenParent = new Container()
	const modalParent = new Container()
	const transitionParent = new Container()
	app.stage.addChild(screenParent, modalParent, transitionParent)

	const screens = createScreenManager({ screenParent, modalParent, transitionParent })

	// --- Today + daily artifact ---------------------------------------------
	const today = todayInZone({
		timeZone: solitairePack.timeZone,
		rolloverHour: solitairePack.dailyMatch.rolloverHour,
	})
	const artifact = await fetchDailyDeal({
		packSlug: solitairePack.slug,
		date: today,
	})

	// --- Save store ---------------------------------------------------------
	const store = createSaveStore(createResilientStorage(window.localStorage))
	const existingSave = store.read(solitairePack.slug, today, 'daily')

	// --- Runtime ------------------------------------------------------------
	const runtime = createSolitaireRuntime(artifact, {
		getDate: () => today,
		saveStore: store,
		packSlug: solitairePack.slug,
		initialSave: existingSave !== null ? hydrateSlotFromSave(existingSave) : undefined,
	})

	// --- Scene services + scenes -------------------------------------------
	const getCanvasSize = (): { width: number; height: number } => ({
		width: app.renderer.width,
		height: app.renderer.height,
	})
	const services = createSceneServices({
		runtime,
		pack: solitairePack,
		store,
		today,
		getCanvasSize,
		manager: () => screens,
	})

	const bootScene = createBootScene(services)
	const titleScene = createTitleScene(services)
	const playingScene = createPlayingScene(services)
	const completeScene = createCompleteScene(services)

	screens.addScreen(bootScene)
	screens.addScreen(titleScene)
	screens.addScreen(playingScene)
	screens.addScreen(completeScene)

	await screens.initialize()

	const resizeAll = (w: number, h: number): void => {
		bootScene.resize(w, h)
		titleScene.resize(w, h)
		playingScene.resize(w, h)
		completeScene.resize(w, h)
	}
	resizeAll(app.renderer.width, app.renderer.height)

	createResizer({
		canvas,
		onResize: (width, height) => {
			app.renderer.resize(width, height)
			resizeAll(width, height)
		},
	})

	await screens.go('boot')

	// --- Game loop ----------------------------------------------------------
	// The screen manager drives the active scene's update(); the playing
	// scene's update() calls runtime.tick() and the per-frame render systems.
	const loop = createRaf(
		[
			(dt) => {
				screens.update(dt)
			},
		],
		undefined,
		{ autoVisibility: true },
	)
	loop.start()

	// --- Flush save on tab close / visibility loss --------------------------
	const flush = (): void => runtime.systems.save.flush()
	window.addEventListener('pagehide', () => {
		flush()
	})
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flush()
	})

	// eslint-disable-next-line no-console
	console.log('[lgs-solitaire] booted', {
		width: app.renderer.width,
		height: app.renderer.height,
		pack: solitairePack.slug,
		brand: solitairePack.brand.title,
		today,
		timeZone: solitairePack.timeZone,
		drawSize: artifact.drawSize,
	})
}
