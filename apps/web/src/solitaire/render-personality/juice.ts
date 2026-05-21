/**
 * Pack-driven juice helpers for Solitaire — small, composable tween / shake /
 * flash / sweep primitives that read easing + duration multiplier + per-moment
 * timing from the active solitaire content pack.
 *
 * Mirrors the lgs-crossword `juice.ts` shape (sha 7044576): named per-moment
 * keys (`popMs`, `shakeMs`, `sweepMs`, `staggerMs`, `winPulse.{durationMs,scale}`),
 * stacked easing slots (`popEase`, `shakeEase`, `sweepEase`, `entranceEase`).
 * Pack-agnostic — personalities differentiate purely via JSON.
 *
 * The helpers wrap `requestAnimationFrame` directly rather than going through
 * `@lgs/render-personality`'s `tween()`, because that helper resolves duration
 * from a fixed per-class table while these moments need explicit per-moment
 * durations while still respecting `motion.durationMultiplier`.
 *
 * LOAD-BEARING RULE on card squash (lgs-trivia@bd8e097): squash multiplies the
 * card's **inner content Container** scale. Mutating root.scale.x/y races
 * `applyLayout`/render per-frame. Every callsite that squashes a card MUST
 * pass the inner content Container, never the cell/card root.
 *
 * This file imports only Pixi + the local solitaire pack type + the shared
 * EASINGS table from `@lgs/render-personality`. NO solitaire-specific logic
 * imports — purely visual primitives.
 */

import { Container, Graphics } from 'pixi.js'
import { EASINGS, type EasingFn, type EventClass } from '@lgs/render-personality'
import type { EasingName as ContentPackEasingName } from '@lgs/content-pack'
import type { EasingName, SolitaireContentPack } from '../types'

// ---------------------------------------------------------------------------
// Duration scaling — clamp + multiply by pack.motion.durationMultiplier
// ---------------------------------------------------------------------------

/**
 * Resolve `baseMs × pack.personalityTheme.motion.durationMultiplier`, clamped
 * to the same sane range the personality engine uses (0.1 – 10×). A malformed
 * or missing multiplier resolves to 1.0 (no scaling).
 */
export function scaledMs(baseMs: number, pack: SolitaireContentPack): number {
	const raw = pack.personalityTheme?.motion?.durationMultiplier
	const mult = typeof raw === 'number' && Number.isFinite(raw) ? raw : 1.0
	const clamped = Math.max(0.1, Math.min(10, mult))
	return baseMs * clamped
}

type PerMomentDurationKey = 'staggerMs' | 'popMs' | 'shakeMs' | 'sweepMs'

/**
 * Read a positive-finite ms duration off `pack.personalityTheme.motion.<key>`,
 * scaled by the duration multiplier. Falls back to `fallbackMs` if the pack
 * key is missing or not a positive finite number.
 */
export function motionDurationMs(
	pack: SolitaireContentPack,
	key: PerMomentDurationKey,
	fallbackMs: number,
): number {
	const motion = pack.personalityTheme?.motion as
		| (typeof pack.personalityTheme.motion & Partial<Record<PerMomentDurationKey, number>>)
		| undefined
	const raw = motion?.[key]
	const base =
		typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : fallbackMs
	return scaledMs(base, pack)
}

type PerMomentEasingKey = 'popEase' | 'shakeEase' | 'sweepEase' | 'entranceEase'

/**
 * Local resolveEasing — mirrors `@lgs/render-personality`'s but accepts a
 * solitaire-typed pack instead of the cross-game ContentPack. Falls back to
 * 'easeOutCubic' if neither the per-class easing nor the fallback exists.
 */
function resolveSolitaireEasing(
	eventClass: EventClass,
	pack: SolitaireContentPack,
): EasingFn {
	const declared = pack.personalityTheme?.motion?.easing?.[eventClass]
	if (declared !== undefined && declared in EASINGS) {
		return EASINGS[declared as ContentPackEasingName]
	}
	return EASINGS.easeOutCubic
}

/**
 * Resolve `pack.personalityTheme.motion.<key>` as an easing name. If the pack
 * declares a known easing under the per-moment key, use it; otherwise cascade
 * to the event-class default via the personality theme's `easing.<class>`.
 */
export function motionEasing(
	pack: SolitaireContentPack,
	key: PerMomentEasingKey,
	fallbackClass: EventClass,
): EasingFn {
	const motion = pack.personalityTheme?.motion as
		| (typeof pack.personalityTheme.motion & Partial<Record<PerMomentEasingKey, EasingName>>)
		| undefined
	const declared = motion?.[key]
	if (typeof declared === 'string' && declared in EASINGS) {
		return EASINGS[declared as ContentPackEasingName]
	}
	return resolveSolitaireEasing(fallbackClass, pack)
}

// ---------------------------------------------------------------------------
// Internal RAF runner — same shape as crossword canonical
// ---------------------------------------------------------------------------

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
	// jsdom / SSR fallback; never used in production.
	setTimeout(cb, 16)
}

type Steppable = { destroyed?: boolean }

/**
 * Run `onFrame(eased, raw)` once per RAF until raw>=1. Resolves when complete.
 * `target.destroyed === true` short-circuits cleanly (Pixi container teardown).
 */
function runAnim(
	target: Steppable,
	durationMs: number,
	easing: EasingFn,
	onFrame: (eased: number, raw: number) => void,
): Promise<void> {
	return new Promise<void>((resolve) => {
		if (target.destroyed === true || durationMs <= 0) {
			onFrame(1, 1)
			resolve()
			return
		}
		const startMs = nowMs()
		function tick(): void {
			if (target.destroyed === true) {
				resolve()
				return
			}
			const elapsed = nowMs() - startMs
			const raw = elapsed / durationMs
			const t = raw >= 1 ? 1 : raw < 0 ? 0 : raw
			onFrame(easing(t), t)
			if (t >= 1) {
				resolve()
				return
			}
			scheduleFrame(tick)
		}
		scheduleFrame(tick)
	})
}

// ---------------------------------------------------------------------------
// pulseScale — scale-up-and-back (card squash, win heading pop)
// ---------------------------------------------------------------------------

export type PulseScaleOpts = {
	/** Starting scale (typically 1.0). */
	from: number
	/** Peak scale (e.g. 0.94 for squash-down, 1.18 for win heading pop). */
	peak: number
	/** Resting scale at the end (typically 1.0; defaults to `from`). */
	rest?: number
	/** Total animation duration in ms, before multiplier. */
	baseMs: number
	/** Pack event class — drives easing curve via pack.motion.easing.<class>. */
	eventClass: EventClass
	/** Active pack. */
	pack: SolitaireContentPack
	/** Optional explicit easing function (overrides eventClass lookup). */
	easing?: EasingFn
}

/**
 * Two-phase scale pulse: `from → peak` over the first half, then `peak → rest`
 * over the second. Both halves use the resolved easing for `eventClass` unless
 * `opts.easing` is supplied. Pack-driven so a snappy-feedback pack and a
 * slow-luxury pack diverge purely by JSON, no code change.
 *
 * Target MUST be the inner content Container, never the card root — see
 * file header for the lgs-trivia load-bearing rule.
 */
export function pulseScale(target: Container, opts: PulseScaleOpts): Promise<void> {
	const { from, peak, rest = from, eventClass, pack } = opts
	const easing = opts.easing ?? resolveSolitaireEasing(eventClass, pack)
	const totalMs = scaledMs(opts.baseMs, pack)
	const halfMs = totalMs / 2
	target.scale.set(from)
	return runAnim(target, halfMs, easing, (eased) => {
		const s = from + (peak - from) * eased
		target.scale.set(s)
	}).then(() =>
		runAnim(target, halfMs, easing, (eased) => {
			const s = peak + (rest - peak) * eased
			target.scale.set(s)
		}),
	)
}

// ---------------------------------------------------------------------------
// fadeIn — opacity + optional scale entrance (title brand, tableau card)
// ---------------------------------------------------------------------------

export type FadeInOpts = {
	/** Starting alpha (defaults 0). */
	fromAlpha?: number
	/** Final alpha (defaults 1). */
	toAlpha?: number
	/** Optional concurrent scale entrance. */
	fromScale?: number
	toScale?: number
	baseMs: number
	eventClass: EventClass
	pack: SolitaireContentPack
	/** Optional explicit easing — defaults to pack.motion.entranceEase, then eventClass. */
	easing?: EasingFn
}

/**
 * Combined alpha + scale entrance. Used for the title brand pop on mount and
 * for the staggered tableau deal entrance. Runs both channels in lockstep with
 * the resolved entrance easing.
 */
export function fadeIn(target: Container, opts: FadeInOpts): Promise<void> {
	const fromAlpha = opts.fromAlpha ?? 0
	const toAlpha = opts.toAlpha ?? 1
	const fromScale = opts.fromScale ?? 1
	const toScale = opts.toScale ?? 1
	const easing = opts.easing ?? motionEasing(opts.pack, 'entranceEase', opts.eventClass)
	const durationMs = scaledMs(opts.baseMs, opts.pack)
	target.alpha = fromAlpha
	target.scale.set(fromScale)
	return runAnim(target, durationMs, easing, (eased) => {
		target.alpha = fromAlpha + (toAlpha - fromAlpha) * eased
		const s = fromScale + (toScale - fromScale) * eased
		target.scale.set(s)
	})
}

// ---------------------------------------------------------------------------
// shake — translate oscillation with damped sine (rejected source card)
// ---------------------------------------------------------------------------

export type ShakeOpts = {
	/** Peak pixel amplitude (e.g. 5 for ±5px shake). */
	amplitude: number
	/** Number of full ±/∓ cycles. */
	cycles: number
	/** Total duration before multiplier. */
	baseMs: number
	pack: SolitaireContentPack
	/** 'horizontal' (default), 'vertical', or 'both'. */
	axis?: 'horizontal' | 'vertical' | 'both'
	/** Optional explicit easing — defaults to linear (the wave supplies the shape). */
	easing?: EasingFn
}

/**
 * Translate oscillation using a damped sine on the target's local x/y.
 * Restores the original x / y on completion. Uses `linear` easing internally
 * by default because the oscillation itself supplies the curve shape — easing
 * on top rounds the wave away.
 *
 * Target should be the card root Container (NOT the inner content) because we
 * want the whole card to wiggle laterally; root.x/y is not touched by the
 * render loop on a per-frame basis the way root.scale is — render loop sets
 * card.x/y once per frame from layout, the shake adds an oscillation offset
 * via a wrapping intermediate. In practice callers can wrap a card in a
 * "shakeWrap" Container to isolate the translation from the layout writes.
 */
export function shake(target: Container, opts: ShakeOpts): Promise<void> {
	const { amplitude, cycles, pack } = opts
	const axis = opts.axis ?? 'horizontal'
	const durationMs = scaledMs(opts.baseMs, pack)
	const easing = opts.easing ?? EASINGS.linear
	const originX = target.x
	const originY = target.y
	return runAnim(target, durationMs, easing, (_eased, raw) => {
		const decay = 1 - raw
		const wave = Math.sin(raw * cycles * Math.PI * 2) * amplitude * decay
		if (axis === 'horizontal' || axis === 'both') target.x = originX + wave
		if (axis === 'vertical' || axis === 'both') target.y = originY + wave
	}).then(() => {
		target.x = originX
		target.y = originY
	})
}

// ---------------------------------------------------------------------------
// flash — colored overlay alpha 1 → 0 (success / reject pulse)
// ---------------------------------------------------------------------------

export type FlashOpts = {
	baseMs: number
	pack: SolitaireContentPack
	eventClass?: EventClass
	easing?: EasingFn
}

/**
 * Animate `target.alpha` from 1 → 0 using the pack feedback easing. Caller is
 * responsible for filling the Graphics with the pulse shape + color beforehand.
 * Marks the target invisible at t=1 so it stops blocking pointer events; the
 * renderer can re-show it on the next event.
 */
export function flash(target: Container, opts: FlashOpts): Promise<void> {
	const easing = opts.easing ?? resolveSolitaireEasing(opts.eventClass ?? 'feedback', opts.pack)
	const durationMs = scaledMs(opts.baseMs, opts.pack)
	target.alpha = 1
	target.visible = true
	return runAnim(target, durationMs, easing, (eased) => {
		target.alpha = 1 - eased
	}).then(() => {
		target.alpha = 0
		target.visible = false
	})
}

// ---------------------------------------------------------------------------
// sweep — accent wash band across a rectangle (foundation completion)
// ---------------------------------------------------------------------------

export type SweepOpts = {
	/** Pixel-space rectangle the sweep band traverses. */
	rect: { x: number; y: number; w: number; h: number }
	/** Direction the band moves: 'horizontal' = L→R, 'vertical' = T→B. */
	axis?: 'horizontal' | 'vertical'
	/** Fill color in 0xRRGGBB. */
	color: number
	/** Sweep band thickness as a fraction of the traversal extent (0..1). Default 0.22. */
	bandFraction?: number
	baseMs: number
	pack: SolitaireContentPack
	/** Optional explicit easing — defaults to pack.motion.sweepEase, then 'transition' class. */
	easing?: EasingFn
}

/**
 * Animate a translucent accent band across a rectangle. Use `axis: 'vertical'`
 * for the K-rollover foundation completion (T→B). Caller supplies a Graphics
 * layer; this function clears + re-draws the band each frame and hides the
 * layer on completion.
 */
export function sweep(layer: Graphics, opts: SweepOpts): Promise<void> {
	const { rect, color, pack } = opts
	const axis = opts.axis ?? 'vertical'
	const bandFraction = opts.bandFraction ?? 0.22
	const easing = opts.easing ?? motionEasing(pack, 'sweepEase', 'transition')
	const durationMs = scaledMs(opts.baseMs, pack)
	layer.visible = true

	if (axis === 'horizontal') {
		const bandW = Math.max(8, rect.w * bandFraction)
		const startX = rect.x - bandW
		const endX = rect.x + rect.w
		return runAnim(layer, durationMs, easing, (eased) => {
			const x = startX + (endX - startX) * eased
			layer.clear()
			layer.rect(x, rect.y, bandW, rect.h).fill({ color, alpha: 0.55 })
			layer.rect(x + bandW * 0.25, rect.y, bandW * 0.5, rect.h).fill({ color, alpha: 0.35 })
		}).then(() => {
			layer.clear()
			layer.visible = false
		})
	}

	// vertical (T → B)
	const bandH = Math.max(8, rect.h * bandFraction)
	const startY = rect.y - bandH
	const endY = rect.y + rect.h
	return runAnim(layer, durationMs, easing, (eased) => {
		const y = startY + (endY - startY) * eased
		layer.clear()
		layer.rect(rect.x, y, rect.w, bandH).fill({ color, alpha: 0.55 })
		layer.rect(rect.x, y + bandH * 0.25, rect.w, bandH * 0.5).fill({ color, alpha: 0.35 })
	}).then(() => {
		layer.clear()
		layer.visible = false
	})
}

// ---------------------------------------------------------------------------
// stagger — call onIndex(i) with `staggerMs` between fires
// ---------------------------------------------------------------------------

export type StaggerOpts = {
	count: number
	/** ms between successive starts; scaled by pack multiplier. */
	staggerMs: number
	pack: SolitaireContentPack
	onIndex: (i: number) => void
	/** Optional predicate — index is skipped (timer NOT advanced) when false. */
	predicate?: (i: number) => boolean
}

/**
 * Schedule `onIndex(i)` for i ∈ [0, count) with `staggerMs` between fires.
 * Index 0 fires immediately (no perceived input lag).
 *
 * When `predicate(i)` returns false, the index is skipped entirely — neither
 * fired nor counted toward the timeline.
 */
export function stagger(opts: StaggerOpts): void {
	const stepMs = scaledMs(opts.staggerMs, opts.pack)
	const predicate = opts.predicate
	let visibleIndex = 0
	for (let i = 0; i < opts.count; i++) {
		if (predicate !== undefined && !predicate(i)) continue
		const delay = stepMs * visibleIndex
		visibleIndex++
		if (delay <= 0) {
			opts.onIndex(i)
		} else {
			const idx = i
			setTimeout(() => opts.onIndex(idx), delay)
		}
	}
}

// ---------------------------------------------------------------------------
// vibrate — guarded mobile haptic
// ---------------------------------------------------------------------------

/**
 * Fire a short navigator.vibrate pulse if the API exists. Wrapped in try/catch
 * because Safari throws SecurityError on iOS for vibration without a user
 * gesture in some contexts. Silently no-ops if unsupported.
 */
export function vibrate(ms: number): void {
	if (typeof navigator === 'undefined') return
	const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }
	if (typeof nav.vibrate !== 'function') return
	try {
		nav.vibrate(ms)
	} catch {
		// Ignore vibration failures — non-fatal UX nice-to-have.
	}
}

// ---------------------------------------------------------------------------
// cardEntrance — combined alpha + small scale pop for tableau deal
// ---------------------------------------------------------------------------

/**
 * Single-card deal entrance — alpha 0 → 1 + scale 0.86 → 1.0 over `popMs`,
 * using the pack's entranceEase. Used by the staggered tableau reveal on
 * playing-scene mount.
 */
export function cardEntrance(target: Container, pack: SolitaireContentPack): Promise<void> {
	// fadeIn applies scaledMs internally; pass the RAW per-moment popMs so the
	// duration multiplier only fires once.
	const motion = pack.personalityTheme?.motion as
		| (typeof pack.personalityTheme.motion & { popMs?: number })
		| undefined
	const rawPopMs =
		typeof motion?.popMs === 'number' && Number.isFinite(motion.popMs) && motion.popMs > 0
			? motion.popMs
			: 220
	return fadeIn(target, {
		fromAlpha: 0,
		toAlpha: 1,
		fromScale: 0.86,
		toScale: 1.0,
		baseMs: rawPopMs,
		eventClass: 'entrance',
		pack,
		easing: motionEasing(pack, 'entranceEase', 'entrance'),
	})
}

// ---------------------------------------------------------------------------
// playWinPulse — convenience for the DailyComplete heading pulse moment
// ---------------------------------------------------------------------------

/**
 * Run the win heading pulse using `pack.personalityTheme.motion.winPulse`.
 * Reads `durationMs` / `scale` off the pack with fallbacks for malformed
 * values. Named-keys path keeps callsites tiny while leaving per-personality
 * tuning entirely in the JSON.
 */
export function playWinPulse(target: Container, pack: SolitaireContentPack): Promise<void> {
	const motion = pack.personalityTheme?.motion as
		| (typeof pack.personalityTheme.motion & {
				winPulse?: { durationMs?: number; scale?: number }
		  })
		| undefined
	const cfg = motion?.winPulse
	const durationMs =
		typeof cfg?.durationMs === 'number' && Number.isFinite(cfg.durationMs) && cfg.durationMs > 0
			? cfg.durationMs
			: 520
	const peak =
		typeof cfg?.scale === 'number' && Number.isFinite(cfg.scale) && cfg.scale > 0 ? cfg.scale : 1.18
	return pulseScale(target, {
		from: 1,
		peak,
		rest: 1,
		baseMs: durationMs,
		eventClass: 'feedback',
		pack,
	})
}
