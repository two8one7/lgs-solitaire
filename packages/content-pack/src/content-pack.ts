/**
 * @lgs/content-pack — schema, validator, migration, helpers.
 *
 * Schema v2 adds four optional personality blocks: juice, layout,
 * personalityTheme, audio. Call migrate(pack) to fill in defaults and
 * produce a guaranteed-v2 pack. Old v1 packs validate without modification.
 *
 * This package owns the universal contract. Per-game pack registries,
 * loader env-var reads, and singleton initialization live in each game's
 * runtime (e.g. `apps/web/src/trivia/pack-loader.ts`).
 */

import type {
	QuestionRecord,
	QuestionCategory,
	QuestionDifficulty,
	DailyQuizPackData,
} from './types'

// --- Primitive shared types ------------------------------------------------

/**
 * Named easing functions understood by the personality render pipeline.
 * New names can be added here when new curves land in fx-primitives.ts.
 */
export type EasingName =
	| 'linear'
	| 'easeOutCubic'
	| 'easeInCubic'
	| 'easeInOutCubic'
	| 'easeInQuad'
	| 'easeOutQuad'
	| 'easeInOutQuad'
	| 'easeInQuart'
	| 'easeOutQuart'
	| 'easeInOutQuart'
	| 'easeInOutQuint'
	| 'easeOutBack'
	| 'easeInOutSine'
	| 'bounce'

// --- Types (v1 compatible) ----------------------------------------

export type BrandBlock = {
	title: string
	shortName: string
	tagline?: string
	logoAsset?: string
}

/**
 * Pack-driven UI copy strings. All fields are optional — resolveCopy() fills
 * in safe English defaults so scenes never need to handle undefined.
 */
export type CopyBlock = {
	completeTitle?: string
	completeFooter?: string
	scoreLabel?: string
	shareLabel?: string
	shareCopiedLabel?: string
	playButton?: string
	howToPlayLink?: string
	streakLabel?: string
}

export type PaletteBlock = {
	bg: string
	panel: string
	text: string
	muted: string
	accent: string
	accentAlt: string
	correct: string
	incorrect: string
	neutral: string
	success: string
}

/**
 * Legacy descriptive theme block (v1). The renderer does not read these
 * strings — they are preserved for human context only. The machine-consumed
 * personality theme lives in `personalityTheme` (v2).
 */
export type ThemeBlock = {
	motif: string
	surface: string
	uiTone: string
	backgroundArt?: string
}

export type DailyQuizConfig = {
	seedPrefix: string
	questionCount: number
	rolloverHour: number
	timerSeconds: number
}

export type QuestionCategoryConfig = {
	category: QuestionCategory
	countPerDay: number
}

export type QuestionPipelineConfig = {
	rss_url: string
	seed_questions_path: string
	question_categories: QuestionCategoryConfig[]
	freshFromRssTarget: number
	evergreenSeedTarget: number
}

export type ShareConfig = {
	template: string
	hashTag?: string
}

export type LeaderboardConfig = {
	mode: 'local' | 'firestore' | 'off'
	collectionPath?: string
}

export type AssetsBlock = {
	logo?: string
	favicon?: string
	background?: string
	questionCardFrame?: string
	answerButtonSpritesheet?: string
}

// --- Schema v2: personality blocks -----------------------------------------
// All sections are OPTIONAL. Defaults are injected by migrate().

// § 1.1 juice

export type ParticleKind = 'ring' | 'confetti' | 'spark' | 'bloom' | 'dust'
export type ParticleSpread = 'radial' | 'upward' | 'drift'
export type ParticleShape = 'circle' | 'rect' | 'star' | 'petal' | 'flake'
export type BlendMode = 'normal' | 'add' | 'screen'

export type ParticleConfig = {
	kind?: ParticleKind
	count?: number
	lifetimeMs?: [number, number]
	speed?: [number, number]
	spread?: ParticleSpread
	gravity?: number
	size?: [number, number]
	shape?: ParticleShape
	colors?: string[]
	blend?: BlendMode
	fadeCurve?: EasingName
	texturePath?: string
}

export type GlowConfig = {
	color?: string
	alpha?: number
	blur?: number
	pulseMs?: number
}

export type TransitionConfig = {
	kind?: 'slide' | 'fade' | 'curtain' | 'curtain-wipe' | 'irisWipe'
	ms?: number
	ease?: EasingName
	texturePath?: string
}

export type HoverPressConfig = {
	scale?: number
	ms?: number
	ease?: EasingName
}

export type JuiceBlock = {
	particles?: {
		correct?: ParticleConfig
		incorrect?: ParticleConfig
		ambient?: ParticleConfig
	}
	glows?: {
		selectedAnswer?: GlowConfig
		correctReveal?: GlowConfig
	}
	transitions?: {
		questionEnter?: TransitionConfig
		questionExit?: TransitionConfig
		answerHoverIn?: HoverPressConfig
		answerPress?: HoverPressConfig
	}
	shake?: {
		incorrect?: { amplitude?: number; ms?: number; axis?: 'horizontal' | 'vertical' | 'both' }
	}
}

// § 1.2 layout

export type SlotConfig = {
	anchor?: string
	height?: number
	padding?: [number, number]
	maxWidth?: number
	shape?: '2x2' | '1x4' | '4x1'
	gap?: number
}

export type BackgroundConfig = {
	kind?: 'solid' | 'gradient' | 'vignette' | 'textureTile' | 'motif'
	stops?: string[]
	motifAsset?: string
}

export type LayoutBlock = {
	composition?: 'stacked-vertical' | 'centered-editorial' | 'masthead-classic' | 'gallery'
	slots?: {
		header?: SlotConfig
		questionBlock?: SlotConfig
		answerGrid?: SlotConfig
		timerBar?: SlotConfig
		footer?: SlotConfig
	}
	background?: BackgroundConfig
	responsive?: {
		narrowBreakpoint?: number
		narrowOverrides?: Record<string, unknown>
	}
}

// § 1.3 personalityTheme

export type TypographyConfig = {
	headingStack?: string
	bodyStack?: string
	monoStack?: string
	googleFonts?: string[]
	scale?: { h1?: number; h2?: number; body?: number; small?: number }
	weight?: { heading?: number; body?: number; emphasis?: number }
	tracking?: { heading?: number; body?: number; caps?: number }
}

export type ShapeConfig = {
	cornerRadius?: { sm?: number; md?: number; lg?: number; pill?: number }
	strokeWidth?: { thin?: number; regular?: number; bold?: number }
	primitive?: 'rounded' | 'sharp' | 'organic'
	scale?: number
}

export type MotionConfig = {
	durationMultiplier?: number
	easing?: {
		entrance?: EasingName
		exit?: EasingName
		feedback?: EasingName
		transition?: EasingName
		ambient?: EasingName
	}
}

export type MotifConfig = {
	assets?: Record<string, string>
	uiTone?: string[]
}

export type SurfaceConfig = {
	panelFill?: string
	panelAlpha?: number
	panelBlur?: number
	vignette?: boolean
	noiseTexture?: boolean
}

export type PersonalityTheme = {
	typography?: TypographyConfig
	shape?: ShapeConfig
	motion?: MotionConfig
	motif?: MotifConfig
	surface?: SurfaceConfig
}

// § 1.4 audio

export type AudioEventConfig = {
	sample?: string | null
	volume?: number
	pitchVariance?: number
	loop?: boolean
} | null

export type AudioBlock = {
	events?: {
		'answer.correct'?: AudioEventConfig
		'answer.incorrect'?: AudioEventConfig
		'ui.hover'?: AudioEventConfig
		'ui.press'?: AudioEventConfig
		'question.reveal'?: AudioEventConfig
		'round.complete'?: AudioEventConfig
		[key: string]: AudioEventConfig | undefined
	}
	music?: {
		title?: AudioEventConfig
		gameplay?: AudioEventConfig
		complete?: AudioEventConfig
	}
	mix?: {
		master?: number
		music?: number
		sfx?: number
	}
}

// --- ContentPack ----------------------------------

export type ContentPack = {
	schemaVersion?: number
	slug: string
	publisherName: string
	regionName: string
	locale: string
	timeZone: string
	brand: BrandBlock
	palette: PaletteBlock
	theme: ThemeBlock
	dailyQuiz: DailyQuizConfig
	questionPipeline: QuestionPipelineConfig
	share: ShareConfig
	leaderboard: LeaderboardConfig
	assets?: AssetsBlock
	seedQuestions: QuestionRecord[]
	juice?: JuiceBlock
	layout?: LayoutBlock
	personalityTheme?: PersonalityTheme
	audio?: AudioBlock
	copy?: CopyBlock
	composition?: {
		title?: 'centered' | 'masthead-classic'
	}
}

// --- Validator -------------------------------------------------------------

export class ContentPackError extends Error {
	constructor(message: string) {
		super(`[ContentPack] ${message}`)
		this.name = 'ContentPackError'
	}
}

function assertString(val: unknown, field: string): string {
	if (typeof val !== 'string' || val.length === 0) {
		throw new ContentPackError(`${field} must be a non-empty string`)
	}
	return val
}

function assertStringOpt(val: unknown, field: string): string | undefined {
	if (val === undefined || val === null) return undefined
	return assertString(val, field)
}

function assertInt(val: unknown, field: string, min: number, max: number): number {
	if (typeof val !== 'number' || !Number.isInteger(val) || val < min || val > max) {
		throw new ContentPackError(`${field} must be an integer in [${min}, ${max}]`)
	}
	return val
}

const VALID_CATEGORIES: readonly QuestionCategory[] = [
	'history_geography',
	'businesses_schools',
	'sports',
	'current_events',
	'local_culture',
	'ballet_basics',
	'technique',
	'body_health',
	'programs_features',
	'culture_history',
]

const VALID_DIFFICULTIES: readonly QuestionDifficulty[] = ['easy', 'medium', 'hard']

export function validateQuestion(raw: unknown, path: string): QuestionRecord {
	if (typeof raw !== 'object' || raw === null) {
		throw new ContentPackError(`${path} must be an object`)
	}
	const r = raw as Record<string, unknown>
	const id = assertString(r['id'], `${path}.id`)
	const text = assertString(r['text'], `${path}.text`)
	const opts = r['options']
	if (!Array.isArray(opts) || opts.length !== 4) {
		throw new ContentPackError(`${path}.options must be an array of 4 strings`)
	}
	for (let i = 0; i < 4; i++) {
		if (typeof opts[i] !== 'string' || opts[i].length === 0) {
			throw new ContentPackError(`${path}.options[${i}] must be a non-empty string`)
		}
	}
	const ci = r['correctIndex']
	if (typeof ci !== 'number' || !Number.isInteger(ci) || ci < 0 || ci > 3) {
		throw new ContentPackError(`${path}.correctIndex must be 0..3`)
	}
	const cat = assertString(r['category'], `${path}.category`)
	if (!VALID_CATEGORIES.includes(cat as QuestionCategory)) {
		throw new ContentPackError(`${path}.category must be one of ${VALID_CATEGORIES.join(', ')}`)
	}
	const diff = assertString(r['difficulty'], `${path}.difficulty`)
	if (!VALID_DIFFICULTIES.includes(diff as QuestionDifficulty)) {
		throw new ContentPackError(`${path}.difficulty must be one of ${VALID_DIFFICULTIES.join(', ')}`)
	}
	const explanation = assertString(r['explanation'], `${path}.explanation`)
	const seed = r['seed']
	if (typeof seed !== 'number' || !Number.isFinite(seed)) {
		throw new ContentPackError(`${path}.seed must be a finite number`)
	}
	return {
		id,
		text,
		options: [opts[0], opts[1], opts[2], opts[3]] as [string, string, string, string],
		correctIndex: ci as 0 | 1 | 2 | 3,
		category: cat as QuestionCategory,
		difficulty: diff as QuestionDifficulty,
		explanation,
		seed,
	}
}

export function validateContentPack(raw: unknown): ContentPack {
	if (typeof raw !== 'object' || raw === null) {
		throw new ContentPackError('pack must be an object')
	}
	const r = raw as Record<string, unknown>

	const slug = assertString(r['slug'], 'slug')
	if (!/^[a-z0-9-]+$/.test(slug)) {
		throw new ContentPackError('slug must match ^[a-z0-9-]+$')
	}

	const brand = r['brand']
	if (typeof brand !== 'object' || brand === null) {
		throw new ContentPackError('brand must be an object')
	}
	const b = brand as Record<string, unknown>

	const palette = r['palette']
	if (typeof palette !== 'object' || palette === null) {
		throw new ContentPackError('palette must be an object')
	}
	const p = palette as Record<string, unknown>
	const paletteKeys = [
		'bg', 'panel', 'text', 'muted', 'accent', 'accentAlt',
		'correct', 'incorrect', 'neutral', 'success',
	] as const
	for (const key of paletteKeys) {
		assertString(p[key], `palette.${key}`)
	}

	const theme = r['theme']
	if (typeof theme !== 'object' || theme === null) {
		throw new ContentPackError('theme must be an object')
	}
	const t = theme as Record<string, unknown>

	const dailyQuiz = r['dailyQuiz']
	if (typeof dailyQuiz !== 'object' || dailyQuiz === null) {
		throw new ContentPackError('dailyQuiz must be an object')
	}
	const dq = dailyQuiz as Record<string, unknown>
	const dailyQuestionCount = assertInt(dq['questionCount'], 'dailyQuiz.questionCount', 1, 100)

	const questionPipeline = r['questionPipeline']
	if (typeof questionPipeline !== 'object' || questionPipeline === null) {
		throw new ContentPackError('questionPipeline must be an object')
	}
	const qp = questionPipeline as Record<string, unknown>
	const cats = qp['question_categories']
	if (!Array.isArray(cats) || cats.length === 0) {
		throw new ContentPackError('questionPipeline.question_categories must be a non-empty array')
	}
	const catList: QuestionCategoryConfig[] = []
	for (let i = 0; i < cats.length; i++) {
		const c = cats[i]
		if (typeof c !== 'object' || c === null) {
			throw new ContentPackError(`questionPipeline.question_categories[${i}] must be an object`)
		}
		const co = c as Record<string, unknown>
		const cat = assertString(co['category'], `questionPipeline.question_categories[${i}].category`)
		if (!VALID_CATEGORIES.includes(cat as QuestionCategory)) {
			throw new ContentPackError(
				`questionPipeline.question_categories[${i}].category must be one of ${VALID_CATEGORIES.join(', ')}`,
			)
		}
		catList.push({
			category: cat as QuestionCategory,
			countPerDay: assertInt(co['countPerDay'], `questionPipeline.question_categories[${i}].countPerDay`, 0, 100),
		})
	}

	const share = r['share']
	if (typeof share !== 'object' || share === null) {
		throw new ContentPackError('share must be an object')
	}
	const sh = share as Record<string, unknown>

	const leaderboard = r['leaderboard']
	if (typeof leaderboard !== 'object' || leaderboard === null) {
		throw new ContentPackError('leaderboard must be an object')
	}
	const lb = leaderboard as Record<string, unknown>
	const lbMode = lb['mode']
	if (lbMode !== 'local' && lbMode !== 'firestore' && lbMode !== 'off') {
		throw new ContentPackError('leaderboard.mode must be "local", "firestore", or "off"')
	}

	const seedQRaw = r['seedQuestions']
	if (!Array.isArray(seedQRaw) || seedQRaw.length < dailyQuestionCount) {
		throw new ContentPackError(
			`seedQuestions must be an array of at least ${dailyQuestionCount} questions`,
		)
	}
	const seedQuestions: QuestionRecord[] = []
	for (let i = 0; i < seedQRaw.length; i++) {
		seedQuestions.push(validateQuestion(seedQRaw[i], `seedQuestions[${i}]`))
	}

	const schemaVersion = typeof r['schemaVersion'] === 'number' ? r['schemaVersion'] : undefined

	return {
		schemaVersion,
		slug,
		publisherName: assertString(r['publisherName'], 'publisherName'),
		regionName: assertString(r['regionName'], 'regionName'),
		locale: typeof r['locale'] === 'string' ? r['locale'] : 'en-US',
		timeZone: typeof r['timeZone'] === 'string' ? r['timeZone'] : 'America/New_York',
		brand: {
			title: assertString(b['title'], 'brand.title'),
			shortName: assertString(b['shortName'], 'brand.shortName'),
			tagline: assertStringOpt(b['tagline'], 'brand.tagline'),
			logoAsset: assertStringOpt(b['logoAsset'], 'brand.logoAsset'),
		},
		palette: {
			bg: p['bg'] as string,
			panel: p['panel'] as string,
			text: p['text'] as string,
			muted: p['muted'] as string,
			accent: p['accent'] as string,
			accentAlt: p['accentAlt'] as string,
			correct: p['correct'] as string,
			incorrect: p['incorrect'] as string,
			neutral: p['neutral'] as string,
			success: p['success'] as string,
		},
		theme: {
			motif: assertString(t['motif'], 'theme.motif'),
			surface: assertString(t['surface'], 'theme.surface'),
			uiTone: assertString(t['uiTone'], 'theme.uiTone'),
			backgroundArt: assertStringOpt(t['backgroundArt'], 'theme.backgroundArt'),
		},
		dailyQuiz: {
			seedPrefix: assertString(dq['seedPrefix'], 'dailyQuiz.seedPrefix'),
			questionCount: dailyQuestionCount,
			rolloverHour: assertInt(dq['rolloverHour'], 'dailyQuiz.rolloverHour', 0, 23),
			timerSeconds: assertInt(dq['timerSeconds'], 'dailyQuiz.timerSeconds', 1, 600),
		},
		questionPipeline: {
			rss_url: assertString(qp['rss_url'], 'questionPipeline.rss_url'),
			seed_questions_path: assertString(qp['seed_questions_path'], 'questionPipeline.seed_questions_path'),
			question_categories: catList,
			freshFromRssTarget: assertInt(qp['freshFromRssTarget'] ?? 70, 'questionPipeline.freshFromRssTarget', 0, 1000),
			evergreenSeedTarget: assertInt(qp['evergreenSeedTarget'] ?? 30, 'questionPipeline.evergreenSeedTarget', 0, 1000),
		},
		share: {
			template: assertString(sh['template'], 'share.template'),
			hashTag: assertStringOpt(sh['hashTag'], 'share.hashTag'),
		},
		leaderboard: {
			mode: lbMode,
			collectionPath: assertStringOpt(lb['collectionPath'], 'leaderboard.collectionPath'),
		},
		assets: r['assets'] as AssetsBlock | undefined,
		seedQuestions,
		juice: (r['juice'] ?? undefined) as JuiceBlock | undefined,
		layout: (r['layout'] ?? undefined) as LayoutBlock | undefined,
		personalityTheme: (r['personalityTheme'] ?? undefined) as PersonalityTheme | undefined,
		audio: (r['audio'] ?? undefined) as AudioBlock | undefined,
		copy: (r['copy'] ?? undefined) as CopyBlock | undefined,
		composition: (r['composition'] ?? undefined) as ContentPack['composition'],
	}
}

// --- resolveCopy(pack) -------------------------------------------------------

const DEFAULT_COPY: Required<CopyBlock> = {
	completeTitle: 'Quiz complete!',
	completeFooter: 'Come back tomorrow for a new quiz.',
	scoreLabel: 'Score',
	shareLabel: 'Share',
	shareCopiedLabel: 'Copied!',
	playButton: "Play Today's Trivia",
	howToPlayLink: 'How to play',
	streakLabel: 'Streak: {n}',
}

export function resolveCopy(pack: ContentPack): Required<CopyBlock> {
	const incoming = pack.copy as Record<string, unknown> | undefined
	if (incoming != null) {
		const known = new Set<string>(Object.keys(DEFAULT_COPY))
		for (const key of Object.keys(incoming)) {
			if (!known.has(key)) {
				console.warn(`[ContentPack] copy.${key} is not a known copy key — ignored, using default`)
			}
		}
	}
	const c = pack.copy ?? {}
	return {
		completeTitle: typeof c.completeTitle === 'string' ? c.completeTitle : DEFAULT_COPY.completeTitle,
		completeFooter: typeof c.completeFooter === 'string' ? c.completeFooter : DEFAULT_COPY.completeFooter,
		scoreLabel: typeof c.scoreLabel === 'string' ? c.scoreLabel : DEFAULT_COPY.scoreLabel,
		shareLabel: typeof c.shareLabel === 'string' ? c.shareLabel : DEFAULT_COPY.shareLabel,
		shareCopiedLabel: typeof c.shareCopiedLabel === 'string' ? c.shareCopiedLabel : DEFAULT_COPY.shareCopiedLabel,
		playButton: typeof c.playButton === 'string' ? c.playButton : DEFAULT_COPY.playButton,
		howToPlayLink: typeof c.howToPlayLink === 'string' ? c.howToPlayLink : DEFAULT_COPY.howToPlayLink,
		streakLabel: typeof c.streakLabel === 'string' ? c.streakLabel : DEFAULT_COPY.streakLabel,
	}
}

// --- migrate(pack) ----------------------------------------------------------

/** Default juice: no particles, no glows, fades only, no shake. */
const DEFAULT_JUICE: Required<JuiceBlock> = {
	particles: {},
	glows: {},
	transitions: {
		questionEnter: { kind: 'fade', ms: 300, ease: 'easeOutCubic' },
		questionExit: { kind: 'fade', ms: 200, ease: 'easeOutCubic' },
		answerHoverIn: { scale: 1.04, ms: 140, ease: 'easeOutCubic' },
		answerPress: { scale: 0.96, ms: 80, ease: 'easeOutCubic' },
	},
	shake: {},
}

/** Default layout: stacked-vertical, 2x2 answer grid, solid background. */
const DEFAULT_LAYOUT: LayoutBlock = {
	composition: 'stacked-vertical',
	slots: {
		answerGrid: { shape: '2x2' },
	},
	background: { kind: 'solid' },
}

/**
 * Default personality theme: system-ui fonts, durationMultiplier 1.0,
 * default surface (panel-fill, no vignette, no noise).
 *
 * shape.cornerRadius/strokeWidth/primitive and motion.easing are
 * intentionally NOT pre-filled — call sites own those defaults so
 * customDefaults preserve byte-identity for packs whose JSON omits them.
 */
const DEFAULT_PERSONALITY_THEME: PersonalityTheme = {
	typography: {
		headingStack: 'system-ui, sans-serif',
		bodyStack: 'system-ui, sans-serif',
		monoStack: 'ui-monospace, monospace',
	},
	shape: {},
	motion: {
		durationMultiplier: 1.0,
	},
	motif: {},
	surface: {
		panelFill: 'panel',
		panelAlpha: 1.0,
		panelBlur: 0,
		vignette: false,
		noiseTexture: false,
	},
}

/** Default audio: every event silent, music null, mix at standard levels. */
const DEFAULT_AUDIO: AudioBlock = {
	events: {
		'answer.correct': null,
		'answer.incorrect': null,
		'ui.hover': null,
		'ui.press': null,
		'question.reveal': null,
		'round.complete': null,
	},
	music: {
		title: null,
		gameplay: null,
		complete: null,
	},
	mix: { master: 1.0, music: 0.5, sfx: 1.0 },
}

/**
 * Upgrade a pack to schemaVersion 2, injecting defaults for any missing
 * personality-block fields. Explicit pack values are NEVER clobbered.
 *
 * Guarantees:
 * - migrate(v1Pack).schemaVersion === 2
 * - migrate(v2Pack) leaves all explicit values intact
 * - migrate(migrate(pack)) is deep-equal to migrate(pack) (idempotent)
 */
export function migrate(pack: ContentPack): ContentPack & { schemaVersion: 2 } {
	const juice: JuiceBlock = {
		particles: pack.juice?.particles ?? DEFAULT_JUICE.particles,
		glows: pack.juice?.glows ?? DEFAULT_JUICE.glows,
		transitions: {
			questionEnter: pack.juice?.transitions?.questionEnter ?? DEFAULT_JUICE.transitions.questionEnter,
			questionExit: pack.juice?.transitions?.questionExit ?? DEFAULT_JUICE.transitions.questionExit,
			answerHoverIn: pack.juice?.transitions?.answerHoverIn ?? DEFAULT_JUICE.transitions.answerHoverIn,
			answerPress: pack.juice?.transitions?.answerPress ?? DEFAULT_JUICE.transitions.answerPress,
		},
		shake: pack.juice?.shake ?? DEFAULT_JUICE.shake,
	}

	const layout: LayoutBlock = {
		composition: pack.layout?.composition ?? DEFAULT_LAYOUT.composition,
		slots: {
			header: pack.layout?.slots?.header,
			questionBlock: pack.layout?.slots?.questionBlock,
			answerGrid: {
				shape: pack.layout?.slots?.answerGrid?.shape ?? '2x2',
				...pack.layout?.slots?.answerGrid,
			},
			timerBar: pack.layout?.slots?.timerBar,
			footer: pack.layout?.slots?.footer,
		},
		background: {
			kind: pack.layout?.background?.kind ?? 'solid',
			stops: pack.layout?.background?.stops,
			motifAsset: pack.layout?.background?.motifAsset,
		},
		responsive: pack.layout?.responsive,
	}

	const inc = pack.personalityTheme
	const incMotion = inc?.motion
	const incEasing = incMotion?.easing
	const defTheme = DEFAULT_PERSONALITY_THEME

	const personalityTheme: PersonalityTheme = {
		typography: {
			headingStack: inc?.typography?.headingStack ?? defTheme.typography!.headingStack,
			bodyStack: inc?.typography?.bodyStack ?? defTheme.typography!.bodyStack,
			monoStack: inc?.typography?.monoStack ?? defTheme.typography!.monoStack,
			googleFonts: inc?.typography?.googleFonts,
			scale: inc?.typography?.scale,
			weight: inc?.typography?.weight,
			tracking: inc?.typography?.tracking,
		},
		shape: {
			cornerRadius: inc?.shape?.cornerRadius,
			strokeWidth: inc?.shape?.strokeWidth,
			primitive: inc?.shape?.primitive,
			scale: inc?.shape?.scale,
		},
		motion: {
			durationMultiplier: incMotion?.durationMultiplier ?? defTheme.motion!.durationMultiplier,
			easing: incEasing,
		},
		motif: inc?.motif ?? defTheme.motif,
		surface: {
			panelFill: inc?.surface?.panelFill ?? defTheme.surface!.panelFill,
			panelAlpha: inc?.surface?.panelAlpha ?? defTheme.surface!.panelAlpha,
			panelBlur: inc?.surface?.panelBlur ?? defTheme.surface!.panelBlur,
			vignette: inc?.surface?.vignette ?? defTheme.surface!.vignette,
			noiseTexture: inc?.surface?.noiseTexture ?? defTheme.surface!.noiseTexture,
		},
	}

	const incAudio = pack.audio
	const audio: AudioBlock = {
		events: {
			'answer.correct': incAudio?.events?.['answer.correct'] !== undefined
				? incAudio.events['answer.correct']
				: null,
			'answer.incorrect': incAudio?.events?.['answer.incorrect'] !== undefined
				? incAudio.events['answer.incorrect']
				: null,
			'ui.hover': incAudio?.events?.['ui.hover'] !== undefined
				? incAudio.events['ui.hover']
				: null,
			'ui.press': incAudio?.events?.['ui.press'] !== undefined
				? incAudio.events['ui.press']
				: null,
			'question.reveal': incAudio?.events?.['question.reveal'] !== undefined
				? incAudio.events['question.reveal']
				: null,
			'round.complete': incAudio?.events?.['round.complete'] !== undefined
				? incAudio.events['round.complete']
				: null,
		},
		music: {
			title: incAudio?.music?.title !== undefined ? incAudio.music.title : null,
			gameplay: incAudio?.music?.gameplay !== undefined ? incAudio.music.gameplay : null,
			complete: incAudio?.music?.complete !== undefined ? incAudio.music.complete : null,
		},
		mix: {
			master: incAudio?.mix?.master ?? DEFAULT_AUDIO.mix!.master,
			music: incAudio?.mix?.music ?? DEFAULT_AUDIO.mix!.music,
			sfx: incAudio?.mix?.sfx ?? DEFAULT_AUDIO.mix!.sfx,
		},
	}

	return {
		...pack,
		schemaVersion: 2,
		juice,
		layout,
		personalityTheme,
		audio,
		composition: pack.composition,
	}
}

// --- buildDailyPack ---------------------------------------------------------

/**
 * Hash a string to a 32-bit unsigned int.
 * cyrb53 variant — fast, well-distributed, deterministic across engines.
 */
function hashStringToU32(s: string): number {
	let h1 = 0xdeadbeef ^ 0
	let h2 = 0x41c6ce57 ^ 0
	for (let i = 0; i < s.length; i++) {
		const ch = s.charCodeAt(i)
		h1 = Math.imul(h1 ^ ch, 2654435761)
		h2 = Math.imul(h2 ^ ch, 1597334677)
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
	return (h2 >>> 0) ^ (h1 >>> 0)
}

/** mulberry32 — small deterministic PRNG, [0,1). */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0
	return function () {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/** Fisher-Yates shuffle using an injected RNG. Returns a new array. */
function shuffleWithRng<T>(arr: ReadonlyArray<T>, rng: () => number): T[] {
	const out = arr.slice()
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		const tmp = out[i]
		out[i] = out[j]
		out[j] = tmp
	}
	return out
}

/**
 * Build the runtime DailyQuizPackData from a content pack + a target date.
 *
 * Daily rotation: seedQuestions are deterministically shuffled using
 * `dailyQuiz.seedPrefix + ':' + date` as the RNG seed, then the first
 * `questionCount` are taken. Same pack + same date → same questions
 * across devices. Different date → different shuffle, so packs with
 * more seedQuestions than questionCount rotate question subsets daily.
 *
 * Edge: when seedQuestions.length ≤ questionCount the daily set is the
 * full pool reordered — variety requires more seed content.
 *
 * Uses baked seedQuestions; a daily-pipeline path swaps this for a manifest read.
 */
export function buildDailyPack(pack: ContentPack, date: string): DailyQuizPackData {
	const questionCount = Math.min(pack.dailyQuiz.questionCount, pack.seedQuestions.length)
	const seed = hashStringToU32(`${pack.dailyQuiz.seedPrefix}:${date}`)
	const rng = mulberry32(seed)
	const shuffled = shuffleWithRng(pack.seedQuestions, rng)
	return {
		slug: pack.slug,
		publisherName: pack.publisherName,
		regionName: pack.regionName,
		date,
		timerSeconds: pack.dailyQuiz.timerSeconds,
		rolloverHour: pack.dailyQuiz.rolloverHour,
		questions: shuffled.slice(0, questionCount),
	}
}
