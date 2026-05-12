// Typography pipeline — resolves font-family, font-weight, letter-spacing,
// and base font-size from the content pack's personality theme.
//
// Two public functions:
//   loadPackFonts(pack)  — injects a Google Fonts <link> and waits for fonts
//                          to be ready. Call before scene init.
//   getTextStyle(role, pack) — returns a partial TextStyle suitable for
//                              spreading into Pixi Text style objects.
//
// Consumers spread the result first, then override only what they need:
//
//   new Text({ text: 'Hello', style: {
//     ...getTextStyle('h1', pack),
//     fontSize: 36,        // layout-driven override takes priority
//     fill: palette.text,  // palette is separate from typography
//   }})
//
// Fallback chain: pack stack → system-ui / monospace — fonts load failure
// degrades cleanly to system-ui.

import type { TextStyleFontWeight } from 'pixi.js'
import type { ContentPack, TypographyConfig } from '@lgs/content-pack'

// ─── Role → base size map ──────────────────────────────────────────────────
// These match the sizes used in the codebase before Phase 2 so that a pack
// with no typography overrides produces visually identical output.

const BASE_FONT_SIZES: Record<TextRole, number> = {
  h1: 32,
  h2: 22,
  body: 16,
  small: 12,
  mono: 14,
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type TextRole = 'h1' | 'h2' | 'body' | 'small' | 'mono'

export type ResolvedTextStyle = {
  fontFamily: string
  fontSize: number
  /** Pixi's TextStyleFontWeight — a string union ('400', '700', 'bold', etc.). */
  fontWeight: TextStyleFontWeight
  letterSpacing: number
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function resolveTypography(pack: ContentPack): Required<TypographyConfig> {
  const t = pack.personalityTheme?.typography ?? {}
  return {
    headingStack: t.headingStack ?? 'system-ui, sans-serif',
    bodyStack: t.bodyStack ?? 'system-ui, sans-serif',
    monoStack: t.monoStack ?? 'ui-monospace, monospace',
    googleFonts: t.googleFonts ?? [],
    scale: t.scale ?? {},
    weight: t.weight ?? {},
    tracking: t.tracking ?? {},
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve a text style object for the given semantic role.
 *
 * Callers spread this over a Pixi TextStyle, then override `fontSize` and
 * `fill` as needed (those are layout/palette concerns, not typography).
 *
 * This function is synchronous and pure — it does NOT check whether fonts
 * have actually loaded. Call `loadPackFonts` first during boot.
 */
export function getTextStyle(role: TextRole, pack: ContentPack): ResolvedTextStyle {
  const t = resolveTypography(pack)

  let fontFamily: string
  let fontWeight: TextStyleFontWeight
  let letterSpacing: number
  let scaleMult: number

  switch (role) {
    case 'h1':
      fontFamily = t.headingStack
      fontWeight = String(t.weight.heading ?? 700) as TextStyleFontWeight
      letterSpacing = t.tracking.heading ?? 0
      scaleMult = t.scale.h1 ?? 1
      break
    case 'h2':
      fontFamily = t.headingStack
      fontWeight = String(t.weight.heading ?? 700) as TextStyleFontWeight
      letterSpacing = t.tracking.heading ?? 0
      scaleMult = t.scale.h2 ?? 1
      break
    case 'body':
      fontFamily = t.bodyStack
      fontWeight = String(t.weight.body ?? 400) as TextStyleFontWeight
      letterSpacing = t.tracking.body ?? 0
      scaleMult = t.scale.body ?? 1
      break
    case 'small':
      fontFamily = t.bodyStack
      fontWeight = String(t.weight.body ?? 400) as TextStyleFontWeight
      // 'small' uses caps tracking when defined (labels like SCORE, STREAK).
      letterSpacing = t.tracking.caps ?? t.tracking.body ?? 0
      scaleMult = t.scale.small ?? 1
      break
    case 'mono':
      fontFamily = t.monoStack
      fontWeight = '400' as TextStyleFontWeight
      letterSpacing = 0
      scaleMult = 1
      break
  }

  return {
    fontFamily,
    fontSize: Math.round(BASE_FONT_SIZES[role] * scaleMult),
    fontWeight,
    letterSpacing,
  }
}

/**
 * Inject a Google Fonts stylesheet for the pack's declared fonts and await
 * `document.fonts.ready` so Pixi Text objects measure correctly on first
 * render.
 *
 * No-op when `pack.personalityTheme.typography.googleFonts` is empty or
 * absent (the default for Phase 2 packs).
 *
 * Must be called BEFORE creating any Pixi Text with pack fonts — i.e. before
 * `screens.initialize()` in `boot.ts`.
 *
 * Safe to call in SSR/test environments where `document` is not defined;
 * the function returns immediately in that case.
 */
export async function loadPackFonts(pack: ContentPack): Promise<void> {
  // Guard: no-op in SSR or worker environments.
  if (typeof document === 'undefined') return

  const fonts = pack.personalityTheme?.typography?.googleFonts
  if (!fonts || fonts.length === 0) {
    // Still await document.fonts.ready so callers don't have to branch.
    await document.fonts.ready
    return
  }

  // Build a single Google Fonts URL from all declared families.
  // Format per spec: https://developers.google.com/fonts/docs/css2
  // Input: ['Fraunces:wght@400;700', 'Inter:wght@400;600']
  // Output: https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Inter:wght@400;600&display=swap
  const familyParams = fonts.map((f) => `family=${encodeURIComponent(f)}`).join('&')
  const href = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`

  // Avoid duplicate injections if called more than once with the same pack.
  // Use getAttribute() comparison rather than a CSS attribute selector so
  // that URL normalization differences across environments (jsdom, browsers)
  // don't cause false misses.
  const existing = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).find(
    (el) => el.getAttribute('href') === href,
  )
  if (existing === undefined) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }

  await document.fonts.ready
}
