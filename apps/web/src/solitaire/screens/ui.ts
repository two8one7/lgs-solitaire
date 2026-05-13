import { Graphics, Text } from 'pixi.js'
import { getTextStyle } from '@lgs/render-personality'
import type { ContentPack } from '@lgs/content-pack'
import type { SolitaireContentPack } from '../types'
import { parseHex } from '../render/palette'

export function assetUrl(path: string): string {
	return path.startsWith('/') ? path : `/${path}`
}

export function renderPersonalityPack(pack: SolitaireContentPack): ContentPack {
	return {
		schemaVersion: pack.schemaVersion,
		slug: pack.slug,
		publisherName: pack.brand.publisherName,
		regionName: pack.region,
		locale: pack.locale,
		timeZone: pack.timeZone,
		brand: pack.brand,
		palette: pack.palette,
		theme: pack.theme,
		dailyQuiz: {
			seedPrefix: pack.solitaire.seedPrefix,
			questionCount: 1,
			rolloverHour: pack.solitaire.rolloverHour,
			timerSeconds: pack.solitaire.parTimeSeconds,
		},
		questionPipeline: {
			rss_url: '',
			seed_questions_path: '',
			question_categories: [],
			freshFromRssTarget: 0,
			evergreenSeedTarget: 0,
		},
		share: pack.share,
		leaderboard: { mode: 'off' },
		seedQuestions: [],
		juice: pack.juice,
		layout: pack.layout,
		personalityTheme: pack.personalityTheme,
		audio: { events: pack.audio.events, mix: pack.audio.mix },
		copy: pack.copy,
	}
}

export async function loadDeclaredFontVariants(pack: SolitaireContentPack): Promise<void> {
	if (typeof document === 'undefined') return
	const fonts = pack.personalityTheme.typography.googleFonts
	for (let i = 0; i < fonts.length; i++) {
		const spec = fonts[i]!
		const family = spec.split(':')[0]!.replace(/\+/g, ' ')
		const weightPart = spec.match(/wght@([^:]+)/)?.[1]
		const weights = weightPart ? weightPart.split(';') : ['400']
		for (let w = 0; w < weights.length; w++) {
			await document.fonts.load(`${weights[w]} 1em "${family}"`)
		}
	}
	await document.fonts.ready
}

export function textStyle(
	pack: SolitaireContentPack,
	role: 'h1' | 'h2' | 'body' | 'small' | 'mono',
	overrides: Record<string, unknown>,
): Record<string, unknown> {
	return {
		...getTextStyle(role, renderPersonalityPack(pack)),
		padding: 56,
		...overrides,
	}
}

export function drawPanel(
	g: Graphics,
	x: number,
	y: number,
	w: number,
	h: number,
	pack: SolitaireContentPack,
): void {
	const radius = pack.personalityTheme.shape.cornerRadius.lg
	g.clear()
	g.roundRect(x, y, w, h, radius)
	g.fill({ color: parseHex(pack.palette.panel), alpha: pack.personalityTheme.surface.panelAlpha })
	g.roundRect(x, y, w, h, radius)
	g.stroke({ color: parseHex(pack.palette.accentAlt), width: 1.5, alpha: 0.26 })
	g.moveTo(x + radius, y + 1)
	g.lineTo(x + w - radius, y + 1)
	g.stroke({ color: 0xffffff, width: 1, alpha: 0.34 })
}

export function centerText(text: Text, x: number, width: number): void {
	text.x = x + (width - text.width) / 2
}
