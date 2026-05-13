/**
 * Broche Ballet Phase 5 pack.
 *
 * Second publisher skin and the stranger-pair test case against Lake Nona.
 * Where Lake Nona is bright civic teal/gold with rounded modern geometry and
 * brisk sunrise-gold motion, Broche is wine-and-rose theatrical: deep cabernet
 * felt, antique-gold ornament, slow easeInOutSine motion, Playfair Display
 * serif headlines, organic primitives, vignetted velvet surfaces, and a
 * curtain-edge title flourish. The two packs must not read as variations of
 * one game when seen side-by-side; they must read as two different companies'
 * games that happen to be the same daily Klondike.
 */

import type { SolitaireContentPack } from '../types'

export const brochePack: SolitaireContentPack = {
	schemaVersion: 2,
	slug: 'broche',
	region: 'Winter Park Studio',
	locale: 'en-US',
	timeZone: 'America/New_York',
	brand: {
		publisherName: 'Broche Ballet',
		title: 'Broche Ballet Solitaire',
		shortName: 'Broche Solitaire',
		tagline: "Tonight's deck for the company.",
		logoAsset: 'packs/broche/branding/logo.svg',
	},
	palette: {
		bg: '#1B0E14',
		panel: '#2A1822',
		text: '#F4E6D8',
		muted: '#A98C9B',
		accent: '#C9A66B',
		accentAlt: '#B23A6E',
		correct: '#C9A66B',
		incorrect: '#9C2A38',
		neutral: '#3D2632',
		success: '#C9A66B',
		cardFace: '#FBF2E4',
		cardBack: '#5C1A2B',
		suitRed: '#9C2A38',
		suitBlack: '#1B0E14',
	},
	theme: {
		motif: 'stage curtain, gilded barre ornament, satin ribbon, candlelight',
		surface: 'deep wine velvet table under a single warm spotlight',
		uiTone: 'theatrical, hushed, programme-elegant',
		backgroundArt: 'packs/broche/art/solitaire-background.svg',
	},
	solitaire: {
		seedPrefix: 'lgs-solitaire:broche',
		enabledVariants: ['klondike-1'],
		rolloverHour: 19,
		parTimeSeconds: 120,
		cardBack: {
			texture: 'packs/broche/cards/card-back.svg',
			palette: ['#5C1A2B', '#C9A66B', '#F4E6D8'],
		},
		feltColor: '#3A0E1A',
		feltTexture: 'packs/broche/art/solitaire-background.svg',
		pipGlyphSet: 'editorial',
		suitPalette: {
			red: '#9C2A38',
			black: '#1B0E14',
			accent: '#C9A66B',
		},
		table: {
			edgeStyle: 'thin',
			shadow: 'crisp',
		},
		dealCorpusVersion: 'star-spangled-solitaire-v1',
	},
	layout: {
		composition: 'stacked-vertical',
		background: {
			kind: 'gradient',
			stops: ['#2A0F1A', '#1B0E14', '#0C060A'],
		},
		slots: {
			header: { height: 84, padding: [16, 24], maxWidth: 880 },
			questionBlock: { height: 124, padding: [14, 18], maxWidth: 880 },
			answerGrid: { maxWidth: 940, gap: 14 },
			timerBar: { height: 30, maxWidth: 880 },
			footer: { height: 52 },
		},
		responsive: {
			narrowBreakpoint: 640,
			narrowOverrides: { composition: 'stacked-vertical', cardScale: 0.78 },
		},
	},
	personalityTheme: {
		typography: {
			headingStack: 'Playfair Display, Georgia, serif',
			bodyStack: 'Lora, Georgia, serif',
			monoStack: 'IBM Plex Mono, ui-monospace, monospace',
			googleFonts: [
				'Playfair+Display:wght@500;700;800',
				'Lora:wght@400;500;600;700',
				'IBM+Plex+Mono:wght@400;600',
			],
			scale: { h1: 1.18, h2: 1.04, body: 1, small: 0.96 },
			weight: { heading: 700, body: 400, emphasis: 600 },
			tracking: { heading: 0.4, body: 0.2, caps: 3.2 },
		},
		shape: {
			cornerRadius: { sm: 4, md: 8, lg: 14, pill: 9999 },
			strokeWidth: { thin: 1, regular: 1.5, bold: 2.5 },
			primitive: 'organic',
			scale: 1.05,
		},
		motion: {
			durationMultiplier: 1.4,
			easing: {
				entrance: 'easeInOutCubic',
				exit: 'easeInOutSine',
				feedback: 'easeInOutSine',
				transition: 'easeInOutQuart',
				ambient: 'easeInOutSine',
			},
		},
		surface: {
			panelFill: '#2A1822',
			panelAlpha: 0.88,
			vignette: true,
			noiseTexture: true,
		},
	},
	juice: {
		particles: {
			correct: {
				kind: 'bloom',
				count: 22,
				lifetimeMs: [900, 1500],
				speed: [30, 90],
				spread: 'upward',
				gravity: 18,
				size: [4, 10],
				shape: 'petal',
				colors: ['accentAlt', 'accent', '#F4E6D8'],
				blend: 'screen',
				fadeCurve: 'easeInOutSine',
			},
			incorrect: {
				kind: 'dust',
				count: 6,
				lifetimeMs: [240, 420],
				speed: [10, 40],
				spread: 'radial',
				gravity: 12,
				size: [2, 4],
				colors: ['incorrect', 'muted'],
				blend: 'normal',
				fadeCurve: 'easeOutCubic',
			},
			ambient: {
				kind: 'bloom',
				count: 6,
				lifetimeMs: [2400, 3600],
				speed: [2, 8],
				spread: 'drift',
				gravity: 0,
				size: [8, 22],
				shape: 'petal',
				colors: ['accentAlt', 'accent'],
				blend: 'screen',
				fadeCurve: 'easeInOutSine',
			},
		},
		glows: {
			selectedAnswer: { color: 'accentAlt', alpha: 0.34, blur: 18, pulseMs: 1800 },
			correctReveal: { color: 'accent', alpha: 0.46, blur: 22, pulseMs: 1200 },
		},
		transitions: {
			questionEnter: { kind: 'curtain', ms: 520, ease: 'easeInOutCubic' },
			questionExit: { kind: 'fade', ms: 360, ease: 'easeInOutSine' },
			answerHoverIn: { scale: 1.012, ms: 240, ease: 'easeInOutSine' },
			answerPress: { scale: 0.992, ms: 280, ease: 'easeInOutSine' },
		},
		shake: {
			incorrect: { amplitude: 3, ms: 220, axis: 'horizontal' },
		},
	},
	audio: {
		events: {
			'ui.hover': { sample: 'packs/broche/audio/ui-hover.wav', volume: 0.14 },
			'ui.press': { sample: 'packs/broche/audio/ui-press.wav', volume: 0.3 },
			'card.flip': { sample: 'packs/broche/audio/card-flip.wav', volume: 0.46, pitchVariance: 0.05 },
			'card.pick-up': { sample: 'packs/broche/audio/card-pickup.wav', volume: 0.38 },
			'card.place-valid': { sample: 'packs/broche/audio/place-valid.wav', volume: 0.46, pitchVariance: 0.04 },
			'card.place-invalid': { sample: 'packs/broche/audio/place-invalid.wav', volume: 0.38 },
			'card.stock-draw': { sample: 'packs/broche/audio/stock-draw.wav', volume: 0.36 },
			'card.stock-reset': { sample: 'packs/broche/audio/stock-reset.wav', volume: 0.4 },
			'foundation.complete': { sample: 'packs/broche/audio/foundation-complete.wav', volume: 0.6 },
			'autocomplete.start': { sample: 'packs/broche/audio/autocomplete-card.wav', volume: 0.24 },
			'autocomplete.card': { sample: 'packs/broche/audio/autocomplete-card.wav', volume: 0.32 },
			'round.complete': { sample: 'packs/broche/audio/win.wav', volume: 0.72 },
			'ambient.title': { sample: 'packs/broche/audio/ambient.wav', volume: 0.22, loop: true },
		},
		mix: { master: 1, music: 0.78, sfx: 0.92 },
	},
	copy: {
		playButton: 'Take the stage',
		completeTitle: 'Curtain call — you cleared tonight\u2019s programme',
		completeFooter: 'Tomorrow\u2019s performance lifts at curtain.',
		scoreLabel: 'Tempo delta',
		shareLabel: 'Share encore',
		shareCopiedLabel: 'Programme copied',
		streakLabel: 'Performance streak',
		onboardingTitle: 'Welcome backstage',
		onboardingCards: [
			'Descend the tableau in alternating colors, each rank one below the last.',
			'Send each suit\u2019s ace to the wings, then crown each pile through king.',
			'Clear the company once a night to keep your performance streak alive.',
		],
		lockedTitle: 'Tonight\u2019s performance is complete',
		lockedCta: 'Return to lobby',
		challengeTitle: 'Encore deck',
		challengeBody: 'A second performance, same hall — no streak risk, same elegant table.',
	},
	share: {
		template: 'Cleared tonight\u2019s Broche Ballet Solitaire in {time}, {parDelta}. Encore streak: {streak}.',
		hashTag: '#BrocheBalletSolitaire',
	},
	winConfetti: {
		colors: ['#C9A66B', '#B23A6E', '#F4E6D8', '#5C1A2B'],
		count: 76,
		spread: 'upward',
	},
	flourish: {
		titleAccent: 'curtain-edges',
		cornerOrnaments: true,
		color: '#C9A66B',
		width: 200,
	},
}
