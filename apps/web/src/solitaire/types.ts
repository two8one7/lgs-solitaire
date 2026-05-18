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
	shortName: string
	tagline: string
	logoAsset: string
}

export interface SolitairePackPalette {
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
	cardFace: string
	cardBack: string
	suitRed: string
	suitBlack: string
}

export type SolitaireVariant = 'klondike-1'
export type SolitairePipGlyphSet = 'classic' | 'editorial' | 'custom'

export interface SolitaireBlock {
	seedPrefix: string
	enabledVariants: [SolitaireVariant]
	rolloverHour: number
	parTimeSeconds: number
	cardBack: { texture: string; palette?: string[] }
	feltColor: string
	feltTexture?: string
	pipGlyphSet: SolitairePipGlyphSet
	suitPalette: { red: string; black: string; accent?: string }
	table: {
		edgeStyle: 'none' | 'thin' | 'inlaid' | 'masthead'
		shadow: 'soft' | 'crisp' | 'none'
	}
	dealCorpusVersion: string
}

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

export interface SolitaireJuiceBlock {
	particles: {
		correct: ParticleConfig
		incorrect?: ParticleConfig
		ambient?: ParticleConfig
	}
	glows: {
		selectedAnswer: GlowConfig
		correctReveal: GlowConfig
	}
	transitions: {
		questionEnter: TransitionConfig
		questionExit?: TransitionConfig
		answerHoverIn: HoverPressConfig
		answerPress: HoverPressConfig
	}
	shake: {
		incorrect: { amplitude: number; ms: number; axis: 'horizontal' | 'vertical' | 'both' }
	}
}

export interface ParticleConfig {
	kind?: 'ring' | 'confetti' | 'spark' | 'bloom' | 'dust'
	count?: number
	lifetimeMs?: [number, number]
	speed?: [number, number]
	spread?: 'radial' | 'upward' | 'drift'
	gravity?: number
	size?: [number, number]
	shape?: 'circle' | 'rect' | 'star' | 'petal' | 'flake'
	colors?: string[]
	blend?: 'normal' | 'add' | 'screen'
	fadeCurve?: EasingName
	texturePath?: string
}

export interface GlowConfig {
	color?: string
	alpha?: number
	blur?: number
	pulseMs?: number
}

export interface TransitionConfig {
	kind?: 'slide' | 'fade' | 'curtain' | 'curtain-wipe' | 'irisWipe'
	ms?: number
	ease?: EasingName
	texturePath?: string
}

export interface HoverPressConfig {
	scale?: number
	ms?: number
	ease?: EasingName
}

export interface SolitaireLayoutBlock {
	composition: 'stacked-vertical' | 'centered-editorial' | 'masthead-classic' | 'gallery'
	background: { kind: 'solid' | 'gradient' | 'vignette' | 'textureTile' | 'motif'; motifAsset?: string; stops?: string[] }
	slots: {
		header: { height: number; padding: [number, number]; maxWidth?: number }
		questionBlock: { height: number; padding: [number, number]; maxWidth?: number }
		answerGrid: { maxWidth: number; gap: number }
		timerBar: { height: number; maxWidth: number }
		footer: { height: number }
	}
	responsive?: {
		narrowBreakpoint?: number
		narrowOverrides?: Record<string, unknown>
	}
}

export interface SolitairePersonalityTheme {
	typography: {
		headingStack: string
		bodyStack: string
		monoStack: string
		googleFonts: string[]
		scale: { h1: number; h2: number; body: number; small: number }
		weight: { heading: number; body: number; emphasis: number }
		tracking: { heading: number; body: number; caps: number }
	}
	shape: {
		cornerRadius: { sm: number; md: number; lg: number; pill: number }
		strokeWidth: { thin: number; regular: number; bold: number }
		primitive: 'rounded' | 'sharp' | 'organic'
		scale: number
	}
	motion: {
		durationMultiplier: number
		easing: {
			entrance: EasingName
			exit: EasingName
			feedback: EasingName
			transition: EasingName
			ambient: EasingName
		}
	}
	surface: {
		panelFill: string
		panelAlpha: number
		vignette: boolean
		noiseTexture: boolean
	}
}

export type SolitaireAudioEvent =
	| 'ui.hover'
	| 'ui.press'
	| 'card.flip'
	| 'card.pick-up'
	| 'card.place-valid'
	| 'card.place-invalid'
	| 'card.stock-draw'
	| 'card.stock-reset'
	| 'foundation.complete'
	| 'autocomplete.start'
	| 'autocomplete.card'
	| 'round.complete'
	| 'ambient.title'

export interface SolitaireAudioTrack {
	sample: string | null
	volume: number
	pitchVariance?: number
	loop?: boolean
}

export interface SolitaireAudioBlock {
	events: Record<SolitaireAudioEvent, SolitaireAudioTrack>
	mix: { master: number; music: number; sfx: number }
}

export interface SolitaireCopyBlock {
	playButton: string
	completeTitle: string
	completeFooter: string
	scoreLabel: string
	shareLabel: string
	shareCopiedLabel: string
	streakLabel: string
	onboardingTitle: string
	onboardingCards: [string, string, string]
	lockedTitle: string
	lockedCta: string
	challengeTitle: string
	challengeBody: string
}

export interface SolitaireShareBlock {
	template: string
	hashTag?: string
}

/**
 * Optional decorative motif block driving scene-flow distinction.
 *
 * Packs that omit `flourish` get the original Lake Nona behavior byte-identical:
 * title scene draws ambient bloom dots; no extra ornaments. Packs that specify a
 * motif paint pack-distinct frame decoration (curtain edges for ballet, masthead
 * rule for editorial, etc.) — separate from card/board rendering, so it doesn't
 * affect game logic.
 *
 * `titleAccent` picks the title-scene flourish kind. `cornerOrnaments` toggles
 * tiny corner accents on panels (matches editorial vs theatrical taste).
 */
export type SolitaireFlourishKind =
	| 'none'
	| 'curtain-edges'
	| 'sunrise-rays'
	| 'masthead-rule'

export interface SolitaireFlourishBlock {
	titleAccent: SolitaireFlourishKind
	cornerOrnaments: boolean
	color?: string
	width?: number
}

export interface WinConfettiConfig {
	colors: string[]
	count: number
	spread: 'radial' | 'upward'
}

export interface SolitaireContentPack {
	schemaVersion: number
	slug: string
	region: string
	locale: string
	timeZone: string
	brand: SolitairePackBrand
	palette: SolitairePackPalette
	theme: {
		motif: string
		surface: string
		uiTone: string
		backgroundArt: string
	}
	solitaire: SolitaireBlock
	layout: SolitaireLayoutBlock
	personalityTheme: SolitairePersonalityTheme
	juice: SolitaireJuiceBlock
	audio: SolitaireAudioBlock
	copy: SolitaireCopyBlock
	share: SolitaireShareBlock
	winConfetti: WinConfettiConfig
	flourish?: SolitaireFlourishBlock
	/** Per-pack public asset paths (favicon, etc.). */
	assets?: SolitairePackAssets
}

export interface SolitairePackAssets {
	favicon?: string
}

/** Per-publisher, per-date save record. */
export interface SolitaireSaveSlot {
	completedDates: Record<string, true>
	currentStreak: number
	bestStreak: number
	lastCompletedDate: string
	bestTimeMs: number
}
