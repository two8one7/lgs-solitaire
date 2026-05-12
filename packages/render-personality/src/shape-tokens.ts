// Shape tokens — resolves corner-radius and stroke-width from the content pack.
//
// Two public functions:
//   getRadius(size, pack, customDefault?) — corner radius in px.
//   getStroke(weight, pack, customDefault?) — stroke width in px.
//
// Resolution order for radius:
//   1. If pack.personalityTheme.shape.primitive === 'sharp' → 0.
//   2. Resolved base radius:
//      a. pack.personalityTheme.shape.cornerRadius[size] if defined.
//      b. else customDefault if provided by the call site.
//      c. else built-in token default (sm=6, md=10, lg=16, pill=9999).
//   3. If primitive === 'organic', multiply base × 1.5 (v1 alias for 'rounded').
//   4. Multiply by pack.personalityTheme.shape.scale (default 1.0).
//
// The optional `customDefault` parameter preserves byte-identical visuals for
// pre-Phase-3 call sites whose hardcoded literals (e.g. 28 for a play button)
// don't match the canonical token defaults (lg = 16). When the pack declares
// a `cornerRadius.lg` override, the override still wins.
//
// Resolution order for stroke is the same shape with token defaults
// thin=1, regular=2, bold=3.

import type { ContentPack } from '@lgs/content-pack'

// ─── Token defaults ────────────────────────────────────────────────────────

export type RadiusToken = 'sm' | 'md' | 'lg' | 'pill'
export type StrokeToken = 'thin' | 'regular' | 'bold'

const DEFAULT_RADIUS: Record<RadiusToken, number> = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 9999,
}

const DEFAULT_STROKE: Record<StrokeToken, number> = {
  thin: 1,
  regular: 2,
  bold: 3,
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve a corner radius for the given size token.
 *
 * @param size           Semantic size token (sm | md | lg | pill).
 * @param pack           Content pack. Reads pack.personalityTheme.shape.
 * @param customDefault  Optional per-call default that wins over the built-in
 *                       token default. Pack-level overrides still take priority.
 *                       Use this to preserve a pre-Phase-3 literal at one call
 *                       site without forcing every site to share the same value.
 * @returns Corner radius in px (>= 0).
 */
export function getRadius(
  size: RadiusToken,
  pack: ContentPack,
  customDefault?: number,
): number {
  const shape = pack.personalityTheme?.shape
  const primitive = shape?.primitive ?? 'rounded'

  // Sharp primitive collapses every corner to 0 — square edges.
  if (primitive === 'sharp') return 0

  // Resolve base: pack override → call-site default → token default.
  const declared = shape?.cornerRadius?.[size]
  let base: number
  if (typeof declared === 'number') {
    base = declared
  } else if (typeof customDefault === 'number') {
    base = customDefault
  } else {
    base = DEFAULT_RADIUS[size]
  }

  // Organic is a v1 alias for rounded with +50% radius (continuous,
  // never angular — softer than the rounded default).
  if (primitive === 'organic') base = base * 1.5

  const scale = typeof shape?.scale === 'number' ? shape.scale : 1
  const out = base * scale
  return out >= 0 ? out : 0
}

/**
 * Resolve a stroke width for the given weight token.
 *
 * @param weight         Semantic weight token (thin | regular | bold).
 * @param pack           Content pack. Reads pack.personalityTheme.shape.
 * @param customDefault  Optional per-call default; pack-level override wins.
 * @returns Stroke width in px (>= 0).
 */
export function getStroke(
  weight: StrokeToken,
  pack: ContentPack,
  customDefault?: number,
): number {
  const declared = pack.personalityTheme?.shape?.strokeWidth?.[weight]
  if (typeof declared === 'number') return declared >= 0 ? declared : 0
  if (typeof customDefault === 'number') return customDefault >= 0 ? customDefault : 0
  return DEFAULT_STROKE[weight]
}
