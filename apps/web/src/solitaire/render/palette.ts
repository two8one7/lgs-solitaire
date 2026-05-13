/**
 * Render palette — converts the pack's `#rrggbb` strings to Pixi 0xrrggbb.
 *
 * Pixi v8 Graphics + TextStyle accept numeric colors. Parse once at scene
 * construction and cache so hot paths don't re-parse on every redraw.
 */

import type { SolitairePackPalette } from '../types'

export type RenderPalette = {
	bg: number
	felt: number
	panel: number
	cardFace: number
	cardBack: number
	textPrimary: number
	textSecondary: number
	suitRed: number
	suitBlack: number
	accent: number
	accentAlt: number
	correct: number
	incorrect: number
	neutral: number
	success: number
	[key: string]: number
}

/** Parse a `#rrggbb` (or `#rgb`) string to 0xrrggbb. */
export function parseHex(input: string): number {
	const s = input.trim().replace(/^#/, '')
	if (s.length === 3) {
		const r = s[0]!
		const g = s[1]!
		const b = s[2]!
		return parseInt(`${r}${r}${g}${g}${b}${b}`, 16)
	}
	if (s.length === 6) {
		return parseInt(s, 16)
	}
	return 0x000000
}

export function toRenderPalette(p: SolitairePackPalette): RenderPalette {
	return {
		bg: parseHex(p.bg),
		felt: parseHex(p.cardBack),
		panel: parseHex(p.panel),
		cardFace: parseHex(p.cardFace),
		cardBack: parseHex(p.cardBack),
		textPrimary: parseHex(p.text),
		textSecondary: parseHex(p.muted),
		suitRed: parseHex(p.suitRed),
		suitBlack: parseHex(p.suitBlack),
		accent: parseHex(p.accent),
		accentAlt: parseHex(p.accentAlt),
		correct: parseHex(p.correct),
		incorrect: parseHex(p.incorrect),
		neutral: parseHex(p.neutral),
		success: parseHex(p.success),
	}
}
