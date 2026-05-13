/**
 * Lake Nona stub pack — Phase 3 skeleton.
 *
 * Real publisher imagery + audio lands in Phase 5 (skin pass). Right now this
 * exists to prove the pack swap surface compiles and to give the renderer a
 * complete palette without inventing values inline.
 *
 * Palette is the GDD-default Lake Nona "green felt" baseline. The stranger-pair
 * test still applies in Phase 5; here we just need a valid pack shape.
 */

import type { SolitaireContentPack } from '../types'

export const lakenonaPack: SolitaireContentPack = {
	slug: 'lakenona',
	region: 'Lake Nona',
	timeZone: 'America/New_York',
	brand: {
		publisherName: 'Nonahood News',
		title: 'Lake Nona Solitaire',
		tagline: 'A daily deal for the Lake Nona neighborhood.',
	},
	palette: {
		bg: '#0d2a1a',
		feltColor: '#1a4d2e',
		cardFace: '#f8f4e9',
		cardBack: '#2c4a6b',
		textPrimary: '#f5f5f5',
		textSecondary: '#c8d4cb',
		suitRed: '#c43030',
		suitBlack: '#1a1a1a',
		accent: '#e9c46a',
	},
	cardBackAsset: 'solid:#2c4a6b',
	feltColor: '#1a4d2e',
	suitGlyphStyle: 'classic',
	dailyMatch: {
		parTimeSeconds: 90,
		rolloverHour: 4,
	},
}
