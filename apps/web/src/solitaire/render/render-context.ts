/**
 * Solitaire render context — passed to every render system.
 *
 * Bundles the things Pixi-side code needs (world for queries, pack for
 * branding, layout for geometry, palette for colors, entities for direct
 * singleton access, eventsCenter for input dispatch). Built once at boot;
 * getLayout resolves live each call so render systems see resize updates.
 */

import type { IWorld } from '@2817/ecs'
import type { IEventsCenter } from '@2817/events-center'
import type { SolitaireContentPack } from '../types'
import type { SolitaireWorldEntities } from '../runtime/types'
import type { Layout } from './layout'
import type { RenderPalette } from './palette'

export type RenderContext = {
	world: IWorld
	eventsCenter: IEventsCenter
	pack: SolitaireContentPack
	palette: RenderPalette
	/** Live layout — recomputed on resize, so render systems read it via this getter. */
	getLayout: () => Layout
	entities: SolitaireWorldEntities
}
