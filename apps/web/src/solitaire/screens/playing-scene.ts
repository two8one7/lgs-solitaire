/**
 * Playing scene — the keystone gameplay scene for Klondike Draw-1.
 *
 * Owns the tableau, foundation, stock-waste, and HUD render layers. Each
 * frame:
 *   - runtime.tick(dt) drives every logic system (timer, auto-complete,
 *     win-check, streak-update, save).
 *   - tableau / foundation / stock-waste / hud redraw from live ECS state.
 *   - When CCompletedFlag lands on the Board entity, route to 'complete'.
 *
 * Input is event-driven: render systems dispatch LocationTap / StockTap
 * onto the eventsCenter; input-system + stock-cycle listen for them.
 */

import { Container, Graphics, Sprite, Text, Texture, type TextStyleFontWeight } from 'pixi.js'
import { createQuery } from '@2817/ecs'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import type { SceneServices } from './scene-services'
import { parseHex, toRenderPalette } from '../render/palette'
import {
	createTableauRender,
	createFoundationRender,
	createStockWasteRender,
	createHudRender,
} from '../render'
import type { RenderContext } from '../render'
import { CCompletedFlag } from '../components'
import {
	DailyCompleteEventId,
	FoundationCompletedEventId,
	MoveExecutedEventId,
	type DailyCompleteEventData,
	type FoundationCompletedEventData,
	type MoveExecutedEventData,
} from '../events'
import { assetUrl } from './ui'
import { fadeIn, playWinPulse } from '../render-personality/juice'

export type PlayingScene = IScreen & {
	resize: (w: number, h: number) => void
}

export function createPlayingScene(services: SceneServices): PlayingScene {
	const { runtime, pack } = services
	const display = new Container()
	display.eventMode = 'static'

	const bg = new Graphics()
	const felt = new Sprite(Texture.from(assetUrl(pack.solitaire.feltTexture ?? pack.theme.backgroundArt)))
	felt.alpha = 0.34
	display.addChild(bg)
	display.addChild(felt)

	const renderPalette = toRenderPalette(pack.palette)

	const ctx: RenderContext = {
		world: runtime.world,
		eventsCenter: runtime.eventsCenter,
		pack,
		palette: renderPalette,
		getLayout: services.getLayout,
		entities: runtime.entities,
	}

	const tableau = createTableauRender({ parent: display, context: ctx })
	const foundations = createFoundationRender({ parent: display, context: ctx })
	const stockWaste = createStockWasteRender({ parent: display, context: ctx })
	const hud = createHudRender({ parent: display, context: ctx })
	const fxLayer = new Container()
	display.addChild(fxLayer)

	// One-shot completion query — fires once the Board picks up CCompletedFlag.
	const completedQ = createQuery(runtime.world, { with: [CCompletedFlag] })

	let completedRouted = false
	type Particle = { g: Graphics; vx: number; vy: number; gravity: number; age: number; life: number }
	const particles: Particle[] = []

	// Header brand text — wraps the pack's shortName for the title fadeIn moment.
	// Lives on its own Container so the fadeIn animation owns alpha/scale.
	const brandWrap = new Container()
	brandWrap.eventMode = 'none'
	display.addChild(brandWrap)
	const headingWeight = String(pack.personalityTheme.typography.weight.heading) as TextStyleFontWeight
	const brandText = new Text({
		text: pack.brand.shortName,
		style: {
			fill: parseHex(pack.palette.text),
			fontFamily: pack.personalityTheme.typography.headingStack,
			fontSize: 22,
			fontWeight: headingWeight,
			letterSpacing: pack.personalityTheme.typography.tracking.heading,
		},
	})
	brandText.anchor.set(0.5, 0)
	brandWrap.addChild(brandText)

	function colorFromPack(name: string | undefined): number {
		if (!name) return parseHex(pack.palette.accentAlt)
		const palette: Record<string, string> = {
			bg: pack.palette.bg,
			panel: pack.palette.panel,
			text: pack.palette.text,
			muted: pack.palette.muted,
			accent: pack.palette.accent,
			accentAlt: pack.palette.accentAlt,
			correct: pack.palette.correct,
			incorrect: pack.palette.incorrect,
			neutral: pack.palette.neutral,
			success: pack.palette.success,
			cardFace: pack.palette.cardFace,
			cardBack: pack.palette.cardBack,
			suitRed: pack.palette.suitRed,
			suitBlack: pack.palette.suitBlack,
		}
		return parseHex(palette[name] ?? name)
	}

	function emitPackParticles(kind: 'correct' | 'ambient', x: number, y: number): void {
		const spec = pack.juice.particles[kind]
		if (!spec) return
		const count = spec.count ?? 0
		const lifetime = spec.lifetimeMs ?? [400, 700]
		const speed = spec.speed ?? [40, 120]
		const size = spec.size ?? [3, 7]
		const colors = spec.colors ?? ['accentAlt']
		for (let i = 0; i < count; i++) {
			const g = new Graphics()
			const c = colorFromPack(colors[i % colors.length])
			const r = size[0] + Math.random() * (size[1] - size[0])
			g.circle(0, 0, r)
			g.fill({ color: c, alpha: 0.9 })
			g.x = x
			g.y = y
			fxLayer.addChild(g)
			const launch = spec.spread === 'upward'
				? -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.7)
				: Math.random() * Math.PI * 2
			const s = speed[0] + Math.random() * (speed[1] - speed[0])
			particles.push({
				g,
				vx: Math.cos(launch) * s,
				vy: Math.sin(launch) * s,
				gravity: spec.gravity ?? 0,
				age: 0,
				life: (lifetime[0] + Math.random() * (lifetime[1] - lifetime[0])) / 1000,
			})
		}
	}

	function updateParticles(dt: number): void {
		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i]!
			p.age += dt
			if (p.age >= p.life) {
				p.g.destroy()
				particles.splice(i, 1)
				continue
			}
			p.vy += p.gravity * dt
			p.g.x += p.vx * dt
			p.g.y += p.vy * dt
			p.g.alpha = Math.max(0, 1 - p.age / p.life)
		}
	}

	const unsubMove = runtime.eventsCenter.addListener<MoveExecutedEventData>(
		MoveExecutedEventId,
		() => {
			const { width, height } = services.getCanvasSize()
			emitPackParticles('correct', width / 2, height * 0.34)
		},
	)
	const unsubFoundation = runtime.eventsCenter.addListener<FoundationCompletedEventData>(
		FoundationCompletedEventId,
		(data) => {
			const layout = services.getLayout()
			const rect = layout.foundationRects[data.suit] ?? layout.foundationRects[0]
			emitPackParticles('correct', rect.x + rect.width / 2, rect.y + rect.height / 2)
		},
	)
	// Moment 6 — pulse the brand text on the win moment. Shake on rejected
	// moves now lives per-card in tableau-render / stock-waste-render, so the
	// global display-shake is gone.
	const unsubComplete = runtime.eventsCenter.addListener<DailyCompleteEventData>(
		DailyCompleteEventId,
		() => {
			const { width, height } = services.getCanvasSize()
			emitPackParticles('correct', width / 2, height * 0.42)
			void playWinPulse(brandWrap, pack)
		},
	)

	function paintBg(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.solitaire.feltColor) })
		felt.width = w
		felt.height = h
		// Position brand text in the header band — center top with a small
		// inset so it sits inside the header slot like the canonical packs.
		brandWrap.x = w / 2
		brandWrap.y = 12
	}

	function renderAll(): void {
		tableau.render()
		foundations.render()
		stockWaste.render()
		hud.render()
	}

	function resize(w: number, h: number): void {
		paintBg(w, h)
		renderAll()
	}

	function update(dt: number): void {
		runtime.tick(dt)
		updateParticles(dt)
		renderAll()

		if (!completedRouted && completedQ().length > 0) {
			completedRouted = true
			// Brief hold so the final move settles before the complete scene takes over.
			setTimeout(() => {
				void services.manager().go('complete')
			}, 900)
		}
	}

	async function enter(_manager: IScreenManager): Promise<void> {
		const { width, height } = services.getCanvasSize()
		resize(width, height)
		// Moment 1 — title brand fadeIn. Runs the pack's entrance easing over
		// roughly two pop-windows so the brand settles before the deal starts.
		void fadeIn(brandWrap, {
			fromAlpha: 0,
			toAlpha: 1,
			fromScale: 0.94,
			toScale: 1,
			baseMs: 520,
			eventClass: 'entrance',
			pack,
		})
		// Moment 2 — staggered tableau deal entrance. Render has populated the
		// CardVisual grid by the time this runs (resize → renderAll above).
		tableau.playDealEntrance()
	}

	async function exit(_manager: IScreenManager): Promise<void> {
		// No-op: render systems own their event handlers on their own containers.
	}

	function destroy(): void {
		unsubMove?.()
		unsubFoundation?.()
		unsubComplete?.()
		tableau.destroy?.()
		foundations.destroy?.()
		stockWaste.destroy?.()
		display.destroy({ children: true })
	}

	return {
		name: 'playing',
		display,
		enter,
		exit,
		update,
		destroy,
		resize,
	}
}
