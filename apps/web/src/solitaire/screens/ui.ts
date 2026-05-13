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

/**
 * Pack-driven title-scene flourish.
 *
 * Packs without a `flourish` block (e.g. Lake Nona) keep the original ambient
 * bloom-dot pattern byte-identical. Packs that declare a flourish kind paint a
 * distinct decorative frame — curtain valance + side draperies for theatrical
 * packs, masthead double-rule for editorial packs, sunrise rays for civic
 * packs — separate from card/board rendering, so it does not affect game logic.
 *
 * Carries the `scene flow` axis of the stranger-pair test: two packs whose
 * title flourish differs become materially distinguishable on first paint.
 */
export function drawFlourish(
	g: Graphics,
	w: number,
	h: number,
	pack: SolitaireContentPack,
): void {
	const flourish = pack.flourish
	const color = parseHex(flourish?.color ?? pack.palette.accentAlt)

	if (!flourish || flourish.titleAccent === 'none') {
		for (let i = 0; i < 6; i++) {
			const x = (w * (i + 1)) / 7
			const y = h * 0.16 + (i % 2) * 34
			g.circle(x, y, 18 + i * 2)
			g.fill({ color, alpha: 0.035 })
		}
		return
	}

	if (flourish.titleAccent === 'curtain-edges') {
		const edgeWidth = flourish.width ?? Math.min(w * 0.18, 220)
		const folds = 7
		for (let i = 0; i < folds; i++) {
			const t = i / (folds - 1)
			const xLeft = t * edgeWidth
			const xRight = w - t * edgeWidth
			const alpha = 0.2 - i * 0.022
			g.rect(xLeft - 2, 0, 4, h)
			g.fill({ color, alpha })
			g.rect(xRight - 2, 0, 4, h)
			g.fill({ color, alpha })
		}
		const valanceH = Math.min(72, h * 0.09)
		const scallops = 9
		for (let i = 0; i < scallops; i++) {
			const cx = (w * (i + 0.5)) / scallops
			const halfWidth = (w / scallops) * 0.55
			g.moveTo(cx - halfWidth, 0)
			g.bezierCurveTo(
				cx - halfWidth * 0.5,
				valanceH * 0.95,
				cx + halfWidth * 0.5,
				valanceH * 0.95,
				cx + halfWidth,
				0,
			)
			g.lineTo(cx - halfWidth, 0)
			g.fill({ color, alpha: 0.24 })
		}
		return
	}

	if (flourish.titleAccent === 'sunrise-rays') {
		const cx = w / 2
		const cy = h + 40
		const rays = 11
		const strokeWidth = flourish.width ?? 36
		for (let i = 0; i < rays; i++) {
			const angle = Math.PI + (Math.PI * (i + 0.5)) / rays
			const x2 = cx + Math.cos(angle) * h * 1.4
			const y2 = cy + Math.sin(angle) * h * 1.4
			g.moveTo(cx, cy)
			g.lineTo(x2, y2)
			g.stroke({ color, alpha: 0.04, width: strokeWidth })
		}
		return
	}

	if (flourish.titleAccent === 'masthead-rule') {
		const stripeY = Math.min(48, h * 0.06)
		g.rect(0, stripeY, w, 2)
		g.fill({ color, alpha: 0.65 })
		g.rect(0, stripeY + 8, w, 1)
		g.fill({ color, alpha: 0.3 })
		g.rect(0, h - stripeY - 9, w, 1)
		g.fill({ color, alpha: 0.3 })
		g.rect(0, h - stripeY - 2, w, 2)
		g.fill({ color, alpha: 0.65 })
	}
}
