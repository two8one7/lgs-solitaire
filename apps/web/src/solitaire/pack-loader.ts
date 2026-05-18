/**
 * Solitaire pack loader.
 *
 * The Phase 4 pack contract makes publisher personality explicit:
 * Solitaire-specific table/card fields live in `solitaire`, and motion,
 * typography, particles, audio, copy, and share behavior stay pack-authored.
 */

import { z } from 'zod'
import type { SolitaireContentPack, SolitaireAudioTrack } from './types'
import { lakenonaPack } from './packs/lakenona'
import { brochePack } from './packs/broche'

export class SolitairePackError extends Error {}

const EasingNameSchema = z.enum([
	'linear',
	'easeOutCubic',
	'easeInCubic',
	'easeInOutCubic',
	'easeInQuad',
	'easeOutQuad',
	'easeInOutQuad',
	'easeInQuart',
	'easeOutQuart',
	'easeInOutQuart',
	'easeInOutQuint',
	'easeOutBack',
	'easeInOutSine',
	'bounce',
])

const BrandSchema = z.object({
	publisherName: z.string().min(1),
	title: z.string().min(1),
	shortName: z.string().min(1),
	tagline: z.string().min(1),
	logoAsset: z.string().min(1),
})

const PaletteSchema = z.object({
	bg: z.string(),
	panel: z.string(),
	text: z.string(),
	muted: z.string(),
	accent: z.string(),
	accentAlt: z.string(),
	correct: z.string(),
	incorrect: z.string(),
	neutral: z.string(),
	success: z.string(),
	cardFace: z.string(),
	cardBack: z.string(),
	suitRed: z.string(),
	suitBlack: z.string(),
})

const SolitaireBlockSchema = z.object({
	seedPrefix: z.string().min(1),
	enabledVariants: z.tuple([z.literal('klondike-1')]),
	rolloverHour: z.number().int().min(0).max(23),
	parTimeSeconds: z.number().int().positive(),
	cardBack: z.object({
		texture: z.string().min(1),
		palette: z.array(z.string()).optional(),
	}),
	feltColor: z.string(),
	feltTexture: z.string().min(1).optional(),
	pipGlyphSet: z.enum(['classic', 'editorial', 'custom']),
	suitPalette: z.object({
		red: z.string(),
		black: z.string(),
		accent: z.string().optional(),
	}),
	table: z.object({
		edgeStyle: z.enum(['none', 'thin', 'inlaid', 'masthead']),
		shadow: z.enum(['soft', 'crisp', 'none']),
	}),
	dealCorpusVersion: z.string().min(1),
})

const ParticleConfigSchema = z.object({
	kind: z.enum(['ring', 'confetti', 'spark', 'bloom', 'dust']).optional(),
	count: z.number().int().nonnegative().optional(),
	lifetimeMs: z.tuple([z.number(), z.number()]).optional(),
	speed: z.tuple([z.number(), z.number()]).optional(),
	spread: z.enum(['radial', 'upward', 'drift']).optional(),
	gravity: z.number().optional(),
	size: z.tuple([z.number(), z.number()]).optional(),
	shape: z.enum(['circle', 'rect', 'star', 'petal', 'flake']).optional(),
	colors: z.array(z.string()).optional(),
	blend: z.enum(['normal', 'add', 'screen']).optional(),
	fadeCurve: EasingNameSchema.optional(),
	texturePath: z.string().optional(),
})

const GlowConfigSchema = z.object({
	color: z.string().optional(),
	alpha: z.number().optional(),
	blur: z.number().optional(),
	pulseMs: z.number().optional(),
})

const TransitionConfigSchema = z.object({
	kind: z.enum(['slide', 'fade', 'curtain', 'curtain-wipe', 'irisWipe']).optional(),
	ms: z.number().optional(),
	ease: EasingNameSchema.optional(),
	texturePath: z.string().optional(),
})

const HoverPressConfigSchema = z.object({
	scale: z.number().optional(),
	ms: z.number().optional(),
	ease: EasingNameSchema.optional(),
})

const JuiceSchema = z.object({
	particles: z.object({
		correct: ParticleConfigSchema,
		incorrect: ParticleConfigSchema.optional(),
		ambient: ParticleConfigSchema.optional(),
	}),
	glows: z.object({
		selectedAnswer: GlowConfigSchema,
		correctReveal: GlowConfigSchema,
	}),
	transitions: z.object({
		questionEnter: TransitionConfigSchema,
		questionExit: TransitionConfigSchema.optional(),
		answerHoverIn: HoverPressConfigSchema,
		answerPress: HoverPressConfigSchema,
	}),
	shake: z.object({
		incorrect: z.object({
			amplitude: z.number(),
			ms: z.number(),
			axis: z.enum(['horizontal', 'vertical', 'both']),
		}),
	}),
})

const AudioTrackSchema = z.object({
	sample: z.string().nullable(),
	volume: z.number().min(0),
	pitchVariance: z.number().optional(),
	loop: z.boolean().optional(),
})

const AudioSchema = z.object({
	events: z.object({
		'ui.hover': AudioTrackSchema,
		'ui.press': AudioTrackSchema,
		'card.flip': AudioTrackSchema,
		'card.pick-up': AudioTrackSchema,
		'card.place-valid': AudioTrackSchema,
		'card.place-invalid': AudioTrackSchema,
		'card.stock-draw': AudioTrackSchema,
		'card.stock-reset': AudioTrackSchema,
		'foundation.complete': AudioTrackSchema,
		'autocomplete.start': AudioTrackSchema,
		'autocomplete.card': AudioTrackSchema,
		'round.complete': AudioTrackSchema,
		'ambient.title': AudioTrackSchema,
	}),
	mix: z.object({
		master: z.number().min(0),
		music: z.number().min(0),
		sfx: z.number().min(0),
	}),
})

const LayoutSchema = z.object({
	composition: z.enum(['stacked-vertical', 'centered-editorial', 'masthead-classic', 'gallery']),
	background: z.object({
		kind: z.enum(['solid', 'gradient', 'vignette', 'textureTile', 'motif']),
		motifAsset: z.string().optional(),
		stops: z.array(z.string()).optional(),
	}),
	slots: z.object({
		header: z.object({
			height: z.number(),
			padding: z.tuple([z.number(), z.number()]),
			maxWidth: z.number().optional(),
		}),
		questionBlock: z.object({
			height: z.number(),
			padding: z.tuple([z.number(), z.number()]),
			maxWidth: z.number().optional(),
		}),
		answerGrid: z.object({ maxWidth: z.number(), gap: z.number() }),
		timerBar: z.object({ height: z.number(), maxWidth: z.number() }),
		footer: z.object({ height: z.number() }),
	}),
	responsive: z
		.object({
			narrowBreakpoint: z.number().optional(),
			narrowOverrides: z.record(z.unknown()).optional(),
		})
		.optional(),
})

const PersonalityThemeSchema = z.object({
	typography: z.object({
		headingStack: z.string(),
		bodyStack: z.string(),
		monoStack: z.string(),
		googleFonts: z.array(z.string()),
		scale: z.object({
			h1: z.number(),
			h2: z.number(),
			body: z.number(),
			small: z.number(),
		}),
		weight: z.object({
			heading: z.number(),
			body: z.number(),
			emphasis: z.number(),
		}),
		tracking: z.object({
			heading: z.number(),
			body: z.number(),
			caps: z.number(),
		}),
	}),
	shape: z.object({
		cornerRadius: z.object({
			sm: z.number(),
			md: z.number(),
			lg: z.number(),
			pill: z.number(),
		}),
		strokeWidth: z.object({
			thin: z.number(),
			regular: z.number(),
			bold: z.number(),
		}),
		primitive: z.enum(['rounded', 'sharp', 'organic']),
		scale: z.number(),
	}),
	motion: z.object({
		durationMultiplier: z.number(),
		easing: z.object({
			entrance: EasingNameSchema,
			exit: EasingNameSchema,
			feedback: EasingNameSchema,
			transition: EasingNameSchema,
			ambient: EasingNameSchema,
		}),
	}),
	surface: z.object({
		panelFill: z.string(),
		panelAlpha: z.number(),
		vignette: z.boolean(),
		noiseTexture: z.boolean(),
	}),
})

const CopySchema = z.object({
	playButton: z.string().min(1),
	completeTitle: z.string().min(1),
	completeFooter: z.string().min(1),
	scoreLabel: z.string().min(1),
	shareLabel: z.string().min(1),
	shareCopiedLabel: z.string().min(1),
	streakLabel: z.string().min(1),
	onboardingTitle: z.string().min(1),
	onboardingCards: z.tuple([z.string(), z.string(), z.string()]),
	lockedTitle: z.string().min(1),
	lockedCta: z.string().min(1),
	challengeTitle: z.string().min(1),
	challengeBody: z.string().min(1),
})

const SolitairePackSchema = z.object({
	schemaVersion: z.number().int().min(2),
	slug: z.string().min(1),
	region: z.string().min(1),
	locale: z.string().min(1),
	timeZone: z.string().min(1),
	brand: BrandSchema,
	palette: PaletteSchema,
	theme: z.object({
		motif: z.string(),
		surface: z.string(),
		uiTone: z.string(),
		backgroundArt: z.string(),
	}),
	solitaire: SolitaireBlockSchema,
	layout: LayoutSchema,
	personalityTheme: PersonalityThemeSchema,
	juice: JuiceSchema,
	audio: AudioSchema,
	copy: CopySchema,
	share: z.object({
		template: z.string().min(1),
		hashTag: z.string().optional(),
	}),
	winConfetti: z.object({
		colors: z.array(z.string()).min(1),
		count: z.number().int().positive(),
		spread: z.enum(['radial', 'upward']),
	}),
	flourish: z
		.object({
			titleAccent: z.enum(['none', 'curtain-edges', 'sunrise-rays', 'masthead-rule']),
			cornerOrnaments: z.boolean(),
			color: z.string().optional(),
			width: z.number().optional(),
		})
		.optional(),
	assets: z.object({ favicon: z.string().optional() }).optional(),
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

// ─── Cache-bust helpers ───────────────────────────────────────────────────────

/**
 * Append `?v=<sha>` (or `&v=<sha>` if the URL already has query params) to a
 * single asset URL. No-ops when sha is empty so dev mode works without a SHA.
 */
export function withCacheBust(url: string, sha: string): string {
	if (!sha) return url
	const sep = url.includes('?') ? '&' : '?'
	return `${url}${sep}v=${encodeURIComponent(sha)}`
}

/**
 * Rewrite every pack asset URL field with a cache-bust suffix so that a
 * Firebase 1-year-immutable 404 response can never stay pinned in browser
 * cache across deploys.
 *
 * Template-literal asset paths (e.g. `${ROOT}/cards/foo.svg`) defeat a
 * build-time Vite transform because the regex can only match literal string
 * values. This runtime helper runs after Zod parse and walks the validated
 * object directly — no regex, no missed fields.
 *
 * Schema layer (Zod) stays clean — this transform runs after parse, not before.
 */
export function applyPackCacheBust(pack: SolitaireContentPack, sha: string): SolitaireContentPack {
	if (!sha) return pack

	const bustOrNull = (url: string | null): string | null =>
		url != null ? withCacheBust(url, sha) : null

	const bustTrack = (track: SolitaireAudioTrack): SolitaireAudioTrack => ({
		...track,
		sample: bustOrNull(track.sample),
	})

	// Walk all 13 audio events
	const audioEvents = pack.audio.events
	const bustedEvents = Object.fromEntries(
		(Object.keys(audioEvents) as (keyof typeof audioEvents)[]).map(event => [
			event,
			bustTrack(audioEvents[event]),
		]),
	) as typeof audioEvents

	return {
		...pack,
		brand: {
			...pack.brand,
			logoAsset: withCacheBust(pack.brand.logoAsset, sha),
		},
		theme: {
			...pack.theme,
			backgroundArt: withCacheBust(pack.theme.backgroundArt, sha),
		},
		solitaire: {
			...pack.solitaire,
			cardBack: {
				...pack.solitaire.cardBack,
				texture: withCacheBust(pack.solitaire.cardBack.texture, sha),
			},
			...(pack.solitaire.feltTexture != null
				? { feltTexture: withCacheBust(pack.solitaire.feltTexture, sha) }
				: {}),
		},
		layout: {
			...pack.layout,
			background: {
				...pack.layout.background,
				...(pack.layout.background.motifAsset != null
					? { motifAsset: withCacheBust(pack.layout.background.motifAsset, sha) }
					: {}),
			},
		},
		juice: {
			...pack.juice,
			particles: {
				correct: {
					...pack.juice.particles.correct,
					...(pack.juice.particles.correct.texturePath != null
						? { texturePath: withCacheBust(pack.juice.particles.correct.texturePath, sha) }
						: {}),
				},
				...(pack.juice.particles.incorrect != null
					? {
							incorrect: {
								...pack.juice.particles.incorrect,
								...(pack.juice.particles.incorrect.texturePath != null
									? { texturePath: withCacheBust(pack.juice.particles.incorrect.texturePath, sha) }
									: {}),
							},
						}
					: {}),
				...(pack.juice.particles.ambient != null
					? {
							ambient: {
								...pack.juice.particles.ambient,
								...(pack.juice.particles.ambient.texturePath != null
									? { texturePath: withCacheBust(pack.juice.particles.ambient.texturePath, sha) }
									: {}),
							},
						}
					: {}),
			},
			transitions: {
				...pack.juice.transitions,
				questionEnter: {
					...pack.juice.transitions.questionEnter,
					...(pack.juice.transitions.questionEnter.texturePath != null
						? { texturePath: withCacheBust(pack.juice.transitions.questionEnter.texturePath, sha) }
						: {}),
				},
				...(pack.juice.transitions.questionExit != null
					? {
							questionExit: {
								...pack.juice.transitions.questionExit,
								...(pack.juice.transitions.questionExit.texturePath != null
									? { texturePath: withCacheBust(pack.juice.transitions.questionExit.texturePath, sha) }
									: {}),
							},
						}
					: {}),
			},
		},
		audio: {
			...pack.audio,
			events: bustedEvents,
		},
	}
}

// ─── Pack registry + singleton ────────────────────────────────────────────────

function resolvePackSlug(): string {
	// Literal-member access so Vite's `define` can substitute at build time.
	const slug =
		(import.meta as unknown as { env: { PUBLIC_LGS_PACK?: string } }).env
			.PUBLIC_LGS_PACK
	return slug ?? 'lakenona'
}

function loadPackBySlug(slug: string): SolitaireContentPack {
	// Keep these accesses literal — the casts do not break Vite's static
	// replacement because Vite walks the AST member chain.
	const sha: string =
		((import.meta as unknown as { env: { PUBLIC_BUILD_SHA?: string } }).env.PUBLIC_BUILD_SHA) ?? ''
	switch (slug) {
		case 'lakenona':
			return applyPackCacheBust(validateSolitairePack(lakenonaPack), sha)
		case 'broche':
			return applyPackCacheBust(validateSolitairePack(brochePack), sha)
		default:
			throw new SolitairePackError(
				`unknown solitaire pack slug '${slug}' — register it in pack-loader.ts`,
			)
	}
}

/** Singleton — boot.ts imports this once and threads it through composition. */
export const solitairePack: SolitaireContentPack = loadPackBySlug(resolvePackSlug())
