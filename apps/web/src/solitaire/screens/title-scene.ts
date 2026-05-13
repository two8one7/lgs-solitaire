/**
 * Title scene — publisher banner + date + streak + PLAY CTA.
 *
 * "Already solved today" → routes straight to `complete` so the player
 * sees their time + share rather than restarting the deal. There's no
 * onboarding, locked, or challenge scene in Phase 3 — those land later.
 */

import { Container, Graphics, Text } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import { parseHex } from '../render/palette'
import { CCurrentStreak, CBestStreak, CBestTimeMs } from '../components'
import type { SceneServices } from './scene-services'

export type TitleScene = IScreen & {
	resize: (w: number, h: number) => void
}

function pad2(n: number): string {
	return n.toString().padStart(2, '0')
}

function formatBestTime(ms: number): string {
	if (ms <= 0) return '—'
	const totalSeconds = Math.floor(ms / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${pad2(seconds)}`
}

function formatDateLong(yyyyMmDd: string): string {
	const parts = yyyyMmDd.split('-').map((s) => parseInt(s, 10))
	const y = parts[0]
	const m = parts[1]
	const d = parts[2]
	if (y === undefined || m === undefined || d === undefined) return yyyyMmDd
	const date = new Date(Date.UTC(y, m - 1, d))
	return date.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC',
	})
}

export function createTitleScene(services: SceneServices): TitleScene {
	const display = new Container()
	display.eventMode = 'static'

	const pack = services.pack
	const bg = new Graphics()
	display.addChild(bg)

	const panel = new Graphics()
	display.addChild(panel)

	const region = new Text({
		text: pack.region.toUpperCase(),
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 12,
			fontWeight: '700',
			fill: pack.palette.accent,
			letterSpacing: 3,
		},
	})

	const brand = new Text({
		text: pack.brand.title,
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 34,
			fontWeight: '700',
			fill: pack.palette.textPrimary,
			align: 'center',
			wordWrap: true,
			wordWrapWidth: 520,
		},
	})

	const tagline = new Text({
		text: pack.brand.tagline,
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 15,
			fontStyle: 'italic',
			fill: pack.palette.textSecondary,
			align: 'center',
			wordWrap: true,
			wordWrapWidth: 480,
		},
	})

	const dateLabel = new Text({
		text: formatDateLong(services.today),
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 14,
			fill: pack.palette.textSecondary,
		},
	})

	const streakText = new Text({
		text: 'Streak: 0',
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 14,
			fontWeight: '600',
			fill: pack.palette.textPrimary,
		},
	})

	const bestText = new Text({
		text: '',
		style: {
			fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
			fontSize: 13,
			fill: pack.palette.textSecondary,
		},
	})

	const playBtn = new Container()
	playBtn.eventMode = 'static'
	playBtn.cursor = 'pointer'
	const playBg = new Graphics()
	const playLabel = new Text({
		text: 'PLAY',
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 18,
			fontWeight: '700',
			fill: pack.palette.bg,
		},
	})
	playBtn.addChild(playBg)
	playBtn.addChild(playLabel)

	display.addChild(region)
	display.addChild(brand)
	display.addChild(tagline)
	display.addChild(dateLabel)
	display.addChild(streakText)
	display.addChild(bestText)
	display.addChild(playBtn)

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
			s.best > 0 ? `Streak: ${s.current}  ·  Best: ${s.best}` : `Streak: ${s.current}`
		bestText.text = s.bestMs > 0 ? `Best time: ${formatBestTime(s.bestMs)}` : ''
		bestText.visible = bestText.text.length > 0
	}

	function alreadySolvedToday(): boolean {
		const saved = services.store.read(pack.slug, services.today, 'daily')
		return saved !== null && saved.completed
	}

	function resolveRoute(): 'complete' | 'playing' {
		if (alreadySolvedToday()) return 'complete'
		return 'playing'
	}

	function resize(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.palette.bg) })

		const panelW = Math.min(540, w - 32)
		const panelH = Math.min(540, h - 64)
		const panelX = (w - panelW) / 2
		const panelY = (h - panelH) / 2
		panel.clear()
		panel.roundRect(panelX, panelY, panelW, panelH, 20)
		panel.fill({ color: parseHex(pack.palette.feltColor), alpha: 0.55 })
		panel.roundRect(panelX, panelY, panelW, panelH, 20)
		panel.stroke({ color: parseHex(pack.palette.accent), width: 2, alpha: 0.35 })

		const innerLeft = panelX + 24
		const innerWidth = panelW - 48

		brand.style.wordWrapWidth = innerWidth
		tagline.style.wordWrapWidth = innerWidth - 16

		let cursorY = panelY + 36

		region.x = (w - region.width) / 2
		region.y = cursorY
		cursorY = region.y + region.height + 6

		brand.x = innerLeft + (innerWidth - brand.width) / 2
		brand.y = cursorY
		cursorY = brand.y + brand.height + 8

		if (tagline.text.length > 0) {
			tagline.x = innerLeft + (innerWidth - tagline.width) / 2
			tagline.y = cursorY
			tagline.visible = true
			cursorY = tagline.y + tagline.height + 12
		} else {
			tagline.visible = false
		}

		dateLabel.x = (w - dateLabel.width) / 2
		dateLabel.y = cursorY
		cursorY = dateLabel.y + dateLabel.height + 16

		streakText.x = (w - streakText.width) / 2
		streakText.y = cursorY
		cursorY = streakText.y + streakText.height + 4

		if (bestText.visible) {
			bestText.x = (w - bestText.width) / 2
			bestText.y = cursorY
			cursorY = bestText.y + bestText.height + 4
		}

		const btnW = Math.min(360, innerWidth)
		const btnH = 56
		playBg.clear()
		playBg.roundRect(0, 0, btnW, btnH, 28)
		playBg.fill({ color: parseHex(pack.palette.accent) })
		playLabel.x = (btnW - playLabel.width) / 2
		playLabel.y = (btnH - playLabel.height) / 2
		playBtn.x = (w - btnW) / 2
		playBtn.y = panelY + panelH - btnH - 28
	}

	function onPointerDown(e: FederatedPointerEvent): void {
		const x = e.global.x
		const y = e.global.y
		const btnW = playBg.width
		const btnH = playBg.height
		if (
			x >= playBtn.x &&
			x <= playBtn.x + btnW &&
			y >= playBtn.y &&
			y <= playBtn.y + btnH
		) {
			void services.manager().go(resolveRoute())
		}
	}

	async function enter(_manager: IScreenManager): Promise<void> {
		display.on('pointerdown', onPointerDown)
		const { width, height } = services.getCanvasSize()
		resize(width, height)
		refreshStats()
	}

	async function exit(_manager: IScreenManager): Promise<void> {
		display.off('pointerdown', onPointerDown)
	}

	function destroy(): void {
		display.destroy({ children: true })
	}

	return {
		name: 'title',
		display,
		enter,
		exit,
		destroy,
		resize,
	}
}
