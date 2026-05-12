// @lgs/render-personality — pack-driven render primitives shared by every
// LGS game. Personality-axis output (motion, glow, particles, transitions,
// typography, shape tokens, layout slots) lives here; game-specific render
// systems (HUD, scenes, question/answer rendering) stay in each game.
//
// This package is pack-agnostic — it never branches on publisher slug.
// Personalities differentiate themselves by what they declare in the pack.

// ─── FX primitives (tween / glow / playTransition) ─────────────────────────
export {
	EASINGS,
	applyGlow,
	playTransition,
	resolveDurationMs,
	resolveEasing,
	tween,
} from './fx-primitives'
export type { EasingFn, EventClass } from './fx-primitives'

// ─── FX particles (ECS-native burst engine) ────────────────────────────────
export { createFxParticles } from './fx-particles'
export type { FxParticles } from './fx-particles'

// ─── Particle ECS components ──────────────────────────────────────────────
export { CParticleBurst, CParticleLifetime } from './components'

// ─── Transition overlay + progress bar ────────────────────────────────────
export { createTransitionRender } from './transition-render'
export type { FadeDirection, TransitionRender } from './transition-render'

// ─── Shape tokens (radius + stroke) ───────────────────────────────────────
export { getRadius, getStroke } from './shape-tokens'
export type { RadiusToken, StrokeToken } from './shape-tokens'

// ─── Typography (font stack + size + weight + tracking) ──────────────────
export { getTextStyle, loadPackFonts } from './typography'
export type { ResolvedTextStyle, TextRole } from './typography'

// ─── Layout slots (composition → named canvas regions) ───────────────────
export { resolveAnswerGap, resolveSlots } from './layout-slots'
export type { Rect, SlotMap } from './layout-slots'

// ─── Texture cache (SVG/PNG → Texture, WHITE fallback) ───────────────────
export { _clearTextureCache, resolveTexturePath } from './texture-cache'

// ─── Render context (structural type consumed by every render system) ────
export type { LayoutLike, RenderContext } from './render-context'
