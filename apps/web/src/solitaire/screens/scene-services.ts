/**
 * SceneServices — bundle every Solitaire scene receives from boot.
 *
 * Mirrors lgs-memory's scene-services in shape but pares back the layout
 * call: Solitaire's layout is a pure function of canvas size (no rows/cols),
 * so getLayout() needs nothing from the world.
 */

import type { IScreenManager } from '@2817/screen-manager'
import type { SolitaireRuntime } from '../runtime'
import type { SolitaireContentPack } from '../types'
import type { SaveStore } from '../save/store'
import type { Layout } from '../render/layout'
import { computeLayout } from '../render/layout'

export type SceneServices = {
	runtime: SolitaireRuntime
	pack: SolitaireContentPack
	store: SaveStore
	today: string
	getCanvasSize: () => { width: number; height: number }
	/** Recompute layout from current canvas size. */
	getLayout: () => Layout
	manager: () => IScreenManager
}

export type CreateSceneServicesOpts = {
	runtime: SolitaireRuntime
	pack: SolitaireContentPack
	store: SaveStore
	today: string
	getCanvasSize: () => { width: number; height: number }
	manager: () => IScreenManager
}

export function createSceneServices(opts: CreateSceneServicesOpts): SceneServices {
	return {
		runtime: opts.runtime,
		pack: opts.pack,
		store: opts.store,
		today: opts.today,
		getCanvasSize: opts.getCanvasSize,
		getLayout: () => {
			const { width, height } = opts.getCanvasSize()
			return computeLayout(width, height)
		},
		manager: opts.manager,
	}
}
