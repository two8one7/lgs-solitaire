import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import { parseHex } from '../render/palette'
import { CBestStreak, CBestTimeMs, CCurrentStreak } from '../components'
import type { SceneServices } from './scene-services'
import { assetUrl, centerText, drawPanel, textStyle } from './ui'

export type TitleScene = IScreen & {
	resize: (w: number, h: number) => void
}

function pad2(n: number): string {
	return n.toString().padStart(2, '0')
}

function formatBestTime(ms: number): string {
	if (ms <= 0) return '—'
	const totalSeconds = Math.floor(ms / 1000)
	return `${Math.floor(totalSeconds / 60)}:${pad2(totalSeconds % 60)}`
}

function formatDateLong(yyyyMmDd: string): string {
	const parts = yyyyMmDd.split('-').map((s) => parseInt(s, 10))
	const y = parts[0]
	const m = parts[1]
	const d = parts[2]
	if (y === undefined || m === undefined || d === undefined) return yyyyMmDd
	return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	})
}

function onboardedKey(slug: string): string {
	return `lgs-solitaire:onboarded:${slug}`
}

export function createTitleScene(services: SceneServices): TitleScene {
	const { pack } = services
	const display = new Container()
	display.eventMode = 'static'

	const bg = new Graphics()
	const ambient = new Graphics()
	const panel = new Graphics()
	const logo = new Sprite(Texture.from(assetUrl(pack.brand.logoAsset)))
	logo.anchor.set(0.5)
	// publisherMark removed (lgs-solitaire#6): Lake Nona's logo SVG already bakes
	// the publication name in. A future pack whose logo lacks publisher name will
	// need a pack-config flag rather than a uniform top-stack.

	const region = new Text({
		text: pack.region.toUpperCase(),
		style: textStyle(pack, 'small', { fontSize: 12, fill: pack.palette.accent, letterSpacing: 2 }),
	})
	const title = new Text({
		text: pack.brand.title,
		style: textStyle(pack, 'h1', {
			fontSize: 38,
			fill: pack.palette.text,
			align: 'center',
			wordWrap: true,
			wordWrapWidth: 520,
		}),
	})
	const tagline = new Text({
		text: pack.brand.tagline,
		style: textStyle(pack, 'body', {
			fontSize: 16,
			fill: pack.palette.muted,
			align: 'center',
			wordWrap: true,
			wordWrapWidth: 500,
		}),
	})
	const dateLabel = new Text({
		text: formatDateLong(services.today),
		style: textStyle(pack, 'small', { fontSize: 13, fill: pack.palette.muted }),
	})
	const streakText = new Text({
		text: '',
		style: textStyle(pack, 'body', { fontSize: 15, fill: pack.palette.text }),
	})
	const bestText = new Text({
		text: '',
		style: textStyle(pack, 'mono', { fontSize: 13, fill: pack.palette.muted }),
	})

	const playBtn = new Container()
	playBtn.eventMode = 'static'
	playBtn.cursor = 'pointer'
	const playBg = new Graphics()
	const playLabel = new Text({
		text: pack.copy.playButton.toUpperCase(),
		style: textStyle(pack, 'body', {
			fontSize: 16,
			fontWeight: '700',
			fill: pack.palette.panel,
			letterSpacing: 1.2,
		}),
	})
	playBtn.addChild(playBg, playLabel)

	display.addChild(bg, ambient, panel, logo, region, title, tagline, dateLabel, streakText, bestText, playBtn)

	function readStats(): { current: number; best: number; bestMs: number } {
		const st = services.runtime.entities.streakTracker
		const sc = services.runtime.entities.scoreCalc
		return {
			current: Number(CCurrentStreak.value[st.worldIndex][st.index]) || 0,
			best: Number(CBestStreak.value[st.worldIndex][st.index]) || 0,
			bestMs: Number(CBestTimeMs.value[sc.worldIndex][sc.index]) || 0,
		}
	}

	function refreshStats(): void {
		const s = readStats()
		streakText.text =
			s.best > 0
				? `${pack.copy.streakLabel}: ${s.current}  ·  Best: ${s.best}`
				: `${pack.copy.streakLabel}: ${s.current}`
		bestText.text = s.bestMs > 0 ? `Best time ${formatBestTime(s.bestMs)}` : ''
		bestText.visible = bestText.text.length > 0
	}

	function alreadySolvedToday(): boolean {
		if (services.mode === 'challenge') return false
		const saved = services.store.read(pack.slug, services.today, 'daily')
		return saved !== null && saved.completed
	}

	function resolveRoute(): 'locked' | 'onboarding' | 'playing' | 'challenge' {
		if (services.mode === 'challenge') return 'challenge'
		if (alreadySolvedToday()) return 'locked'
		if (window.localStorage.getItem(onboardedKey(pack.slug)) !== '1') return 'onboarding'
		return 'playing'
	}

	function resize(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.palette.bg) })
		ambient.clear()
		const particleColor = parseHex(pack.palette.accentAlt)
		for (let i = 0; i < 6; i++) {
			const x = (w * (i + 1)) / 7
			const y = h * 0.16 + (i % 2) * 34
			ambient.circle(x, y, 18 + i * 2)
			ambient.fill({ color: particleColor, alpha: 0.035 })
		}

		const panelW = Math.min(560, w - 32)
		const panelH = Math.min(560, h - 48)
		const panelX = (w - panelW) / 2
		const panelY = (h - panelH) / 2
		drawPanel(panel, panelX, panelY, panelW, panelH, pack)

		logo.width = Math.min(260, panelW - 96)
		logo.height = logo.width * (80 / 300)
		logo.x = w / 2
		logo.y = panelY + 60

		let cursorY = logo.y + logo.height / 2 + 20
		centerText(region, panelX, panelW)
		region.y = cursorY
		cursorY += region.height + 6

		title.style.wordWrapWidth = panelW - 60
		centerText(title, panelX, panelW)
		title.y = cursorY
		cursorY += title.height + 8

		tagline.style.wordWrapWidth = panelW - 70
		centerText(tagline, panelX, panelW)
		tagline.y = cursorY
		cursorY += tagline.height + 12

		centerText(dateLabel, panelX, panelW)
		dateLabel.y = cursorY
		cursorY += dateLabel.height + 20

		centerText(streakText, panelX, panelW)
		streakText.y = cursorY
		cursorY += streakText.height + 4
		bestText.visible = bestText.text.length > 0
		if (bestText.visible) {
			centerText(bestText, panelX, panelW)
			bestText.y = cursorY
		}

		const btnW = Math.min(360, panelW - 64)
		const btnH = 56
		playBg.clear()
		playBg.roundRect(0, 0, btnW, btnH, pack.personalityTheme.shape.cornerRadius.pill)
		playBg.fill({ color: parseHex(pack.palette.accent) })
		playLabel.x = (btnW - playLabel.width) / 2
		playLabel.y = (btnH - playLabel.height) / 2
		playBtn.x = (w - btnW) / 2
		playBtn.y = panelY + panelH - btnH - 30
	}

	function onPointerDown(e: FederatedPointerEvent): void {
		const x = e.global.x
		const y = e.global.y
		if (x >= playBtn.x && x <= playBtn.x + playBg.width && y >= playBtn.y && y <= playBtn.y + playBg.height) {
			void services.manager().go(resolveRoute())
		}
	}

	async function enter(_manager: IScreenManager): Promise<void> {
		display.on('pointerdown', onPointerDown)
		services.audio.startAmbient()
		refreshStats()
		const { width, height } = services.getCanvasSize()
		resize(width, height)
	}

	async function exit(_manager: IScreenManager): Promise<void> {
		display.off('pointerdown', onPointerDown)
		services.audio.stopAmbient()
	}

	function destroy(): void {
		display.destroy({ children: true })
	}

	return { name: 'title', display, enter, exit, destroy, resize }
}
