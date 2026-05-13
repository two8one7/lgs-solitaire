/**
 * Solitaire pack + save types.
 *
 * The Zod schema in pack-loader.ts is the runtime gate; these are the static
 * shapes systems and scenes import. Mirrors the lgs-memory pattern of keeping
 * pack-related types in one file rather than fragmenting them.
 */

export interface SolitairePackBrand {
	publisherName: string
	title: string
	tagline: string
}

export interface SolitairePackPalette {
	bg: string
	feltColor: string
	cardFace: string
	cardBack: string
	textPrimary: string
	textSecondary: string
	suitRed: string
	suitBlack: string
	accent: string
}

export interface SolitaireDailyMatchConfig {
	parTimeSeconds: number
	rolloverHour: number
}

export type SuitGlyphStyle = 'classic' | 'modern'

export interface SolitaireContentPack {
	slug: string
	region: string
	timeZone: string
	brand: SolitairePackBrand
	palette: SolitairePackPalette
	cardBackAsset: string
	feltColor: string
	suitGlyphStyle: SuitGlyphStyle
	dailyMatch: SolitaireDailyMatchConfig
}

/** Per-publisher, per-date save record. */
export interface SolitaireSaveSlot {
	completedDates: Record<string, true>
	currentStreak: number
	bestStreak: number
	lastCompletedDate: string
	bestTimeMs: number
}
