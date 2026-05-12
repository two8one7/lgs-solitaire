// Shared render-side context type for personality engine systems.
//
// Each render system in this package takes a `RenderContext` — a thin bundle
// of (world, pack, getLayout, palette). Game-specific RenderContext types
// (e.g. trivia's, which adds `entities: TriviaWorldEntities`) are structural
// supersets and pass through unchanged.

import type { IWorld } from '@2817/ecs'
import type { ContentPack } from '@lgs/content-pack'

/**
 * Minimal layout surface the personality renderers need. Concrete games may
 * return a richer layout type (with their own region rects); only these
 * fields are read here.
 */
export type LayoutLike = {
  canvasW: number
  canvasH: number
  timer: { x: number; y: number; width: number; height: number }
}

/**
 * Render context consumed by personality renderers.
 *
 * Generic over `TLayout` so games can pass their richer layout type and still
 * type-check. Trivia passes its `Layout` (a `LayoutLike` superset) here.
 */
export type RenderContext<TLayout extends LayoutLike = LayoutLike> = {
  world: IWorld
  /** Active content pack — drives juice, theme, typography, shape, audio. */
  pack: ContentPack
  /** Returns the current layout for this frame. */
  getLayout: () => TLayout
  /** Pack-derived palette — name → 0xRRGGBB lookup. */
  palette: Record<string, number>
}
