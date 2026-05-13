/**
 * card-visual — shared helper that builds + paints a Pixi Container for one
 * Solitaire card.
 *
 * Publisher-grade visuals: a rounded rect, rank+suit text in the corners,
 * a large center glyph for face-up cards, and a pack-provided card-back
 * texture for face-down cards.
 *
 * Render systems own placement; this module owns "what one card looks like".
 *
 * Pixi v8 conventions used:
 *   - Graphics.roundRect/fill/stroke (no beginFill/endFill).
 *   - Text(): style fields are numeric colors (parsed by palette.ts).
 *   - container.eventMode = 'static' is set by the parent render system that
 *     wants taps; this helper stays event-agnostic.
 */

import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { type SolitaireCard, type Suit } from '../logic/types'
import { cardLabel, isRedSuit, suitGlyph } from '../logic/deck'
import type { RenderPalette } from './palette'

export type CardVisual = {
	container: Container
	bg: Graphics
	frame: Graphics
	cornerTL: Text
	cornerBR: Text
	centerGlyph: Text
	backSprite: Sprite
	width: number
	height: number
	/** Apply the latest card data + size; re-renders graphics + text in place. */
	apply: (card: SolitaireCard | null, width: number, height: number, opts?: ApplyOpts) => void
}

export type ApplyOpts = {
	highlighted?: boolean
	dim?: boolean
	radius?: number
	cardBackTexture?: string
	glowColor?: number
	glowAlpha?: number
}

const CORNER_FONT = 'Georgia, "Times New Roman", serif'

export function createCardVisual(palette: RenderPalette): CardVisual {
	const container = new Container()

	const bg = new Graphics()
	bg.eventMode = 'none'
	container.addChild(bg)

	const frame = new Graphics()
	frame.eventMode = 'none'
	container.addChild(frame)

	const backSprite = new Sprite(Texture.EMPTY)
	backSprite.eventMode = 'none'
	backSprite.visible = false
	container.addChild(backSprite)

	const cornerTL = new Text({
		text: '',
		style: {
			fill: palette.textPrimary,
			fontFamily: CORNER_FONT,
			fontSize: 14,
			fontWeight: '700',
		},
	})
	cornerTL.anchor.set(0, 0)
	container.addChild(cornerTL)

	const cornerBR = new Text({
		text: '',
		style: {
			fill: palette.textPrimary,
			fontFamily: CORNER_FONT,
			fontSize: 14,
			fontWeight: '700',
		},
	})
	cornerBR.anchor.set(1, 1)
	container.addChild(cornerBR)

	const centerGlyph = new Text({
		text: '',
		style: {
			fill: palette.textPrimary,
			fontFamily: CORNER_FONT,
			fontSize: 26,
			fontWeight: '700',
		},
	})
	centerGlyph.anchor.set(0.5)
	container.addChild(centerGlyph)

	function apply(
		card: SolitaireCard | null,
		width: number,
		height: number,
		opts?: ApplyOpts,
	): void {
		bg.clear()
		frame.clear()
		const radius = opts?.radius ?? Math.max(4, Math.round(Math.min(width, height) * 0.09))
		const highlighted = opts?.highlighted ?? false
		const dim = opts?.dim ?? false

		if (card === null) {
			// Empty slot — translucent tile + dashed-look frame.
			backSprite.visible = false
			bg.roundRect(0, 0, width, height, radius)
			bg.fill({ color: palette.felt, alpha: 0.55 })
			frame.roundRect(0.5, 0.5, width - 1, height - 1, radius)
			frame.stroke({ color: palette.textSecondary, width: 2, alpha: 0.5 })
			cornerTL.text = ''
			cornerBR.text = ''
			centerGlyph.text = ''
			container.alpha = 1
			return
		}

		if (!card.faceUp) {
			// Face-down — back color + inset stripe.
			bg.roundRect(0, 0, width, height, radius)
			bg.fill({ color: palette.cardBack })
			if (opts?.cardBackTexture) {
				backSprite.texture = Texture.from(`/${opts.cardBackTexture}`)
				backSprite.visible = true
				backSprite.x = 0
				backSprite.y = 0
				backSprite.width = width
				backSprite.height = height
			} else {
				backSprite.visible = false
				const inset = Math.max(4, Math.round(radius * 0.7))
				frame.roundRect(inset, inset, width - inset * 2, height - inset * 2, Math.max(2, radius - inset))
				frame.stroke({ color: palette.accent, width: 2, alpha: 0.65 })
			}
			cornerTL.text = ''
			cornerBR.text = ''
			centerGlyph.text = ''
			container.alpha = dim ? 0.7 : 1
			return
		}

		// Face-up — card face + corner indices + center glyph.
		bg.roundRect(0, 0, width, height, radius)
		bg.fill({ color: palette.cardFace })
		backSprite.visible = false

		const frameColor = highlighted ? (opts?.glowColor ?? palette.accent) : palette.textSecondary
		const frameWidth = highlighted ? 3 : 1.5
		const frameAlpha = highlighted ? (opts?.glowAlpha ?? 0.95) : 0.55
		frame.roundRect(0.5, 0.5, width - 1, height - 1, radius)
		frame.stroke({ color: frameColor, width: frameWidth, alpha: frameAlpha })

		const suit = card.suit as Suit
		const inkColor = isRedSuit(suit) ? palette.suitRed : palette.suitBlack
		const label = cardLabel(card)
		const rank = label.slice(0, label.length - 1)
		const glyph = suitGlyph(suit)
		const cornerText = `${rank}\n${glyph}`

		// Corner index sizing scales with card width; keep readable down to 40px.
		const cornerFontSize = Math.max(11, Math.round(width * 0.18))
		cornerTL.style.fontSize = cornerFontSize
		cornerTL.style.fill = inkColor
		cornerTL.text = cornerText
		cornerTL.x = Math.max(4, Math.round(width * 0.08))
		cornerTL.y = Math.max(4, Math.round(height * 0.05))

		cornerBR.style.fontSize = cornerFontSize
		cornerBR.style.fill = inkColor
		cornerBR.text = cornerText
		cornerBR.x = width - Math.max(4, Math.round(width * 0.08))
		cornerBR.y = height - Math.max(4, Math.round(height * 0.05))

		centerGlyph.style.fontSize = Math.max(18, Math.round(width * 0.42))
		centerGlyph.style.fill = inkColor
		centerGlyph.text = glyph
		centerGlyph.x = width / 2
		centerGlyph.y = height / 2

		container.alpha = dim ? 0.6 : 1
	}

	return {
		container,
		bg,
		frame,
		cornerTL,
		cornerBR,
		centerGlyph,
		backSprite,
		width: 0,
		height: 0,
		apply,
	}
}
