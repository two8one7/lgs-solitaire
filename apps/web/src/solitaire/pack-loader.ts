/**
 * Solitaire pack loader.
 *
 * Vite statically replaces `import.meta.env.PUBLIC_LGS_PACK` only when accessed
 * as a literal member chain — destructure or computed access kills the swap.
 * Mirrors lgs-memory's pack-loader pattern.
 *
 * Pack registry is a static map: each publisher slug maps to a module that
 * exports a default SolitaireContentPack. The Zod schema validates the chosen
 * pack at boot. `lakenona` is the only entry in Phase 3; future packs slot in
 * as additional case branches.
 */

import { z } from 'zod'
import type { SolitaireContentPack } from './types'
import { lakenonaPack } from './packs/lakenona'

export class SolitairePackError extends Error {}

const SuitGlyphStyleSchema = z.enum(['classic', 'modern'])

const BrandSchema = z.object({
	publisherName: z.string().min(1),
	title: z.string().min(1),
	tagline: z.string().min(1),
})

const PaletteSchema = z.object({
	bg: z.string(),
	feltColor: z.string(),
	cardFace: z.string(),
	cardBack: z.string(),
	textPrimary: z.string(),
	textSecondary: z.string(),
	suitRed: z.string(),
	suitBlack: z.string(),
	accent: z.string(),
})

const DailyMatchSchema = z.object({
	parTimeSeconds: z.number().int().positive(),
	rolloverHour: z.number().int().min(0).max(23),
})

const SolitairePackSchema = z.object({
	slug: z.string().min(1),
	region: z.string().min(1),
	timeZone: z.string().min(1),
	brand: BrandSchema,
	palette: PaletteSchema,
	cardBackAsset: z.string().min(1),
	feltColor: z.string(),
	suitGlyphStyle: SuitGlyphStyleSchema,
	dailyMatch: DailyMatchSchema,
})

export function validateSolitairePack(raw: unknown): SolitaireContentPack {
	const result = SolitairePackSchema.safeParse(raw)
	if (!result.success) {
		throw new SolitairePackError(
			`solitaire pack failed validation: ${result.error.message}`,
		)
	}
	return result.data as SolitaireContentPack
}

function resolvePackSlug(): string {
	// Literal-member access so Vite's `define` can substitute at build time.
	const slug =
		(import.meta as unknown as { env: { PUBLIC_LGS_PACK?: string } }).env
			.PUBLIC_LGS_PACK
	return slug ?? 'lakenona'
}

function loadPackBySlug(slug: string): SolitaireContentPack {
	switch (slug) {
		case 'lakenona':
			return validateSolitairePack(lakenonaPack)
		default:
			throw new SolitairePackError(
				`unknown solitaire pack slug '${slug}' — register it in pack-loader.ts`,
			)
	}
}

/** Singleton — boot.ts imports this once and threads it through composition. */
export const solitairePack: SolitaireContentPack = loadPackBySlug(resolvePackSlug())
