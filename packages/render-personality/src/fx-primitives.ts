// FX primitives — pack-driven tween, glow, and scene transitions.
//
// Three public functions:
//   tween(target, props, eventClass, pack)          — animate numeric props on
//                                                     any Pixi DisplayObject
//                                                     (or any object with the
//                                                     named numeric keys).
//   applyGlow(target, glowSpec)                     — soft outer-stroke glow.
//   playTransition(layer, transitionSpec, pack)     — slide / fade / curtain /
//                                                     iris-wipe layer reveal.
//
// All three derive timing and curves from the pack's personality theme:
//   pack.personalityTheme.motion.durationMultiplier  (default 1.0)
//   pack.personalityTheme.motion.easing[eventClass]  (per-class override)
//
// The easing table below is a fixed map — no eval, no dynamic lookup by URL —
// so the bundler can dead-code-eliminate unused curves and a malformed pack
// can never inject a behavior.
//
// fx-primitives is pack-agnostic about *which* personality it serves: it does
// not branch on publisher/slug. Personalities differentiate themselves by
// declaring `motion.easing.entrance: 'easeOutBack'` (bouncy newsletter) vs.
// `'easeInOutQuart'` (slow ballet) in their pack — no engine code change.

import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { ContentPack, EasingName, TransitionConfig, GlowConfig } from '@lgs/content-pack'
import { resolveTexturePath } from './texture-cache'

// ─── Event classes ─────────────────────────────────────────────────────────

export type EventClass = 'entrance' | 'exit' | 'feedback' | 'transition' | 'ambient'

const BASE_DURATION_MS: Record<EventClass, number> = {
  entrance: 280,
  exit: 220,
  feedback: 180,
  transition: 320,
  ambient: 600,
}

const FALLBACK_EASING: Record<EventClass, EasingName> = {
  entrance: 'easeOutCubic',
  exit: 'easeInQuad',
  feedback: 'easeOutBack',
  transition: 'easeInOutSine',
  ambient: 'easeInOutSine',
}

// ─── Easing table ──────────────────────────────────────────────────────────

export type EasingFn = (t: number) => number

/**
 * Fixed name → easing-function map. Adding a new curve here requires:
 *   1. Appending the name to `EasingName` in content-pack.ts.
 *   2. Adding the function below.
 * No code path turns a string into an easing without going through this table.
 */
export const EASINGS: Record<EasingName, EasingFn> = {
  linear: linear,
  easeInQuad: easeInQuad,
  easeOutQuad: easeOutQuad,
  easeInOutQuad: easeInOutQuad,
  easeInCubic: easeInCubic,
  easeOutCubic: easeOutCubic,
  easeInOutCubic: easeInOutCubic,
  easeInQuart: easeInQuart,
  easeOutQuart: easeOutQuart,
  easeInOutQuart: easeInOutQuart,
  easeInOutQuint: easeInOutQuint,
  easeOutBack: easeOutBack,
  easeInOutSine: easeInOutSine,
  bounce: bounceOut,
}

function linear(t: number): number {
  return t
}

function easeInQuad(t: number): number {
  return t * t
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function easeInCubic(t: number): number {
  return t * t * t
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function easeInQuart(t: number): number {
  return t * t * t * t
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2
}

function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2
}

/**
 * Penner-style bounce-out. The standard four-stage piecewise curve, suitable
 * for "drop and settle" feedback motion (a question card landing into place).
 */
function bounceOut(t: number): number {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) {
    return n1 * t * t
  } else if (t < 2 / d1) {
    const t2 = t - 1.5 / d1
    return n1 * t2 * t2 + 0.75
  } else if (t < 2.5 / d1) {
    const t2 = t - 2.25 / d1
    return n1 * t2 * t2 + 0.9375
  } else {
    const t2 = t - 2.625 / d1
    return n1 * t2 * t2 + 0.984375
  }
}

// ─── Duration + easing resolution ──────────────────────────────────────────

/**
 * Resolve the final tween duration in milliseconds for the given event class.
 * Final = pack.motion.durationMultiplier × class base duration.
 *
 * Multiplier is clamped to a sane range (0.1 – 10×) so a malformed pack can't
 * stall the UI or speed-blur every animation past usefulness.
 */
export function resolveDurationMs(eventClass: EventClass, pack: ContentPack): number {
  const raw = pack.personalityTheme?.motion?.durationMultiplier
  const mult = typeof raw === 'number' && Number.isFinite(raw) ? raw : 1.0
  const clamped = Math.max(0.1, Math.min(10, mult))
  return BASE_DURATION_MS[eventClass] * clamped
}

/**
 * Resolve the easing function for an event class on a given pack.
 * Falls back to the per-class default when the pack hasn't declared an
 * override (or declared an unknown name that didn't land in the table).
 */
export function resolveEasing(eventClass: EventClass, pack: ContentPack): EasingFn {
  const declared = pack.personalityTheme?.motion?.easing?.[eventClass]
  if (declared !== undefined && declared in EASINGS) {
    return EASINGS[declared]
  }
  return EASINGS[FALLBACK_EASING[eventClass]]
}

// ─── tween ────────────────────────────────────────────────────────────────

type TweenTarget = Record<string, number> & { destroyed?: boolean }

const activeTweens: TweenRunner[] = []

type TweenRunner = {
  target: TweenTarget
  startValues: Record<string, number>
  endValues: Record<string, number>
  easing: EasingFn
  startMs: number
  durationMs: number
  resolve: () => void
}

let rafScheduled = false

/**
 * Animate numeric properties on `target` from their current values to `props`
 * over the duration resolved for `eventClass`. Resolves when the tween
 * completes; a duration of 0 resolves on the next frame after writing the end
 * values.
 *
 * The runner uses `requestAnimationFrame` (no Pixi Ticker coupling) so it
 * works for any object with numeric keys — Pixi DisplayObjects, Graphics,
 * plain `{ x: 0 }` debug objects.
 *
 * Cancellation: if the target is destroyed mid-tween, the runner short-circuits
 * on its next frame. Re-tweening the same prop replaces the prior tween for
 * that property (the older one keeps running on stale values then naturally
 * completes — its final write IS overwritten by the newer end-values).
 */
export function tween(
  target: TweenTarget,
  props: Record<string, number>,
  eventClass: EventClass,
  pack: ContentPack,
): Promise<void> {
  const durationMs = resolveDurationMs(eventClass, pack)
  const easing = resolveEasing(eventClass, pack)
  const startValues: Record<string, number> = {}
  const keys = Object.keys(props)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const cur = (target as Record<string, unknown>)[k]
    startValues[k] = typeof cur === 'number' ? cur : 0
  }

  return new Promise<void>((resolve) => {
    if (durationMs <= 0) {
      // Zero-duration writes are still asynchronous so callers can `await`.
      writeProps(target, props)
      queueMicrotask(resolve)
      return
    }
    activeTweens.push({
      target,
      startValues,
      endValues: { ...props },
      easing,
      startMs: nowMs(),
      durationMs,
      resolve,
    })
    if (!rafScheduled) {
      rafScheduled = true
      scheduleFrame(stepTweens)
    }
  })
}

function writeProps(target: TweenTarget, props: Record<string, number>): void {
  const keys = Object.keys(props)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    ;(target as Record<string, unknown>)[k] = props[k]
  }
}

function stepTweens(): void {
  rafScheduled = false
  const now = nowMs()
  // Cache length up front — slice for safety since runners may push during
  // resolve callbacks (see for-loop-over-for-of-with-getters pref).
  const runners = activeTweens
  for (let i = runners.length - 1; i >= 0; i--) {
    const r = runners[i]
    if (r.target.destroyed === true) {
      runners.splice(i, 1)
      r.resolve()
      continue
    }
    const elapsed = now - r.startMs
    const raw = elapsed / r.durationMs
    const t = raw >= 1 ? 1 : raw < 0 ? 0 : raw
    const eased = r.easing(t)
    const keys = Object.keys(r.endValues)
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k]
      const s = r.startValues[key]
      const e = r.endValues[key]
      ;(r.target as Record<string, unknown>)[key] = s + (e - s) * eased
    }
    if (t >= 1) {
      runners.splice(i, 1)
      r.resolve()
    }
  }
  if (runners.length > 0 && !rafScheduled) {
    rafScheduled = true
    scheduleFrame(stepTweens)
  }
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

function scheduleFrame(cb: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(cb)
    return
  }
  // Headless/SSR fallback — should not run in production but keeps tests
  // and SSR boot from exploding.
  setTimeout(cb, 16)
}

// ─── applyGlow ────────────────────────────────────────────────────────────

/**
 * Apply a soft outer-stroke approximation of a glow to `target`. v1 ships a
 * Graphics-based approximation rather than a Pixi v8 `Filter` — v8's blur /
 * glow filter API requires extra setup (FilterArea, FilterContainer) for
 * uniform-friendly use, and the cost is wrong for small UI elements like
 * answer buttons. This approximation:
 *
 *   1. Adds (or replaces) a child Graphics named "__fx_glow" rendered behind
 *      everything else.
 *   2. Draws a slightly-larger outer stroke in the spec's color/alpha.
 *
 * Limitation: this is a hard outer stroke, not a blurred falloff. A real
 * blur lands in Phase 4 alongside particles. The hook here is forward-
 * compatible: same call signature, same spec.
 */
export function applyGlow(target: Container, glowSpec: GlowConfig): void {
  if (target.destroyed === true) return
  const color = parseColor(glowSpec.color, 0xffffff)
  const alpha = clamp01(glowSpec.alpha ?? 0.6)
  const blur = Math.max(0, glowSpec.blur ?? 12)

  // Find or create the glow child.
  let glow = target.getChildByLabel('__fx_glow') as Graphics | null
  if (glow === null) {
    glow = new Graphics()
    glow.label = '__fx_glow'
    target.addChildAt(glow, 0)
  } else {
    glow.clear()
  }

  // Use bounds local to the target so the glow tracks scale/position.
  const bounds = target.getLocalBounds()
  const pad = Math.max(2, blur)
  glow.rect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2)
  glow.stroke({ color, alpha, width: Math.max(1, blur / 2) })
}

function parseColor(value: string | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const v = value.trim()
  if (v.startsWith('#')) {
    const n = parseInt(v.slice(1), 16)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return n < 0 ? 0 : n > 1 ? 1 : n
}

// ─── playTransition ────────────────────────────────────────────────────────

/**
 * Animate a layer's appearance per the supplied transition spec. The layer is
 * assumed to be already attached to the stage at its final position/size;
 * playTransition only animates the visual reveal.
 *
 * Supported kinds:
 *   slide  — slides from the right by the layer's width.
 *   fade   — alpha 0 → 1.
 *   curtain — stubbed as fade with TODO(Phase 4) (real curtain geometry needs
 *             a mask layer; ships in Phase 4 alongside the particle system).
 *   irisWipe — stubbed as fade with TODO(Phase 4) (needs circular mask + Graphics
 *             frame-by-frame mask updates).
 *
 * Returns a Promise that resolves when the reveal finishes.
 */
export function playTransition(
  layer: Container,
  transitionSpec: TransitionConfig,
  pack: ContentPack,
): Promise<void> {
  if (layer.destroyed === true) return Promise.resolve()
  const kind = transitionSpec.kind ?? 'fade'

  switch (kind) {
    case 'slide':
      return playSlide(layer, pack)
    case 'fade':
      return playFade(layer, pack)
    case 'curtain':
      // Legacy: falls back to fade. Packs that declared 'curtain' get a smooth
      // reveal unchanged from Phase 3. Real geometry lives in 'curtain-wipe'.
      return playFade(layer, pack)
    case 'curtain-wipe':
      return playCurtainWipe(layer, transitionSpec, pack)
    case 'irisWipe':
      // TODO(Phase 4): real iris (circular Graphics mask growing from layer
      // center). Falls back to fade.
      return playFade(layer, pack)
    default:
      return playFade(layer, pack)
  }
}

function playFade(layer: Container, pack: ContentPack): Promise<void> {
  layer.alpha = 0
  return tween(layer as unknown as TweenTarget, { alpha: 1 }, 'transition', pack)
}

function playSlide(layer: Container, pack: ContentPack): Promise<void> {
  const bounds = layer.getLocalBounds()
  const distance = bounds.width > 0 ? bounds.width : 400
  const finalX = layer.x
  layer.x = finalX + distance
  return tween(layer as unknown as TweenTarget, { x: finalX }, 'transition', pack)
}

/**
 * Curtain-wipe reveal: two sprite panels covering the layer (top + bottom
 * halves) slide apart in opposite directions, exposing the content below.
 * Visual metaphor: a stage curtain opening vertically.
 *
 * Uses `spec.ms` and `spec.ease` when present, falling back to the pack's
 * 'transition' class defaults. The panels are added as children of `layer`
 * and removed on completion — no persistent children.
 *
 * texturePath resolves via the shared texture cache (Texture.WHITE fallback
 * when absent, loading, or failed).
 */
function playCurtainWipe(layer: Container, spec: TransitionConfig, pack: ContentPack): Promise<void> {
  if (layer.destroyed === true) return Promise.resolve()

  const texture: Texture = spec.texturePath ? resolveTexturePath(spec.texturePath) : Texture.WHITE
  const bounds = layer.getLocalBounds()
  const w = bounds.width > 0 ? bounds.width : 800
  const h = bounds.height > 0 ? bounds.height : 600
  const halfH = h / 2

  // Top panel: covers upper half, slides up to reveal.
  const top = new Sprite({ texture })
  top.x = bounds.x
  top.y = bounds.y
  top.width = w
  top.height = halfH

  // Bottom panel: covers lower half, slides down to reveal.
  const bottom = new Sprite({ texture })
  bottom.x = bounds.x
  bottom.y = bounds.y + halfH
  bottom.width = w
  bottom.height = halfH

  layer.addChild(top)
  layer.addChild(bottom)

  const durationMs =
    typeof spec.ms === 'number' && spec.ms > 0
      ? spec.ms
      : resolveDurationMs('transition', pack)

  const easeFn: EasingFn =
    spec.ease !== undefined && spec.ease in EASINGS
      ? EASINGS[spec.ease]
      : resolveEasing('transition', pack)

  const topStartY = bounds.y
  const topEndY = bounds.y - halfH
  const bottomStartY = bounds.y + halfH
  const bottomEndY = bounds.y + h

  return new Promise<void>((resolve) => {
    const startMs = nowMs()

    function frame(): void {
      if (layer.destroyed === true) {
        resolve()
        return
      }
      const elapsed = nowMs() - startMs
      const raw = durationMs > 0 ? elapsed / durationMs : 1
      const t = raw >= 1 ? 1 : raw < 0 ? 0 : raw
      const eased = easeFn(t)

      top.y = topStartY + (topEndY - topStartY) * eased
      bottom.y = bottomStartY + (bottomEndY - bottomStartY) * eased

      if (t >= 1) {
        layer.removeChild(top)
        layer.removeChild(bottom)
        resolve()
        return
      }
      scheduleFrame(frame)
    }

    scheduleFrame(frame)
  })
}
