/**
 * Complete scene — shown after the player wins (all 52 to foundations).
 *
 * Phase 3 keeps this minimal: time, par delta, streak, and a TITLE button.
 * Share button assembles a static template + writes to clipboard with a
 * small toast (no native dialogs — Pixi-only).
 */

import { Container, Graphics, Text } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import { parseHex } from '../render/palette'
import {
	CPlayerTimeMs,
	CTimeDeltaMs,
	CCurrentStreak,
	CBestStreak,
	CBestTimeMs,
} from '../components'
import type { SceneServices } from './scene-services'

export type CompleteScene = IScreen & {
	resize: (w: number, h: number) => void
}

function pad2(n: number): string {
	return n.toString().padStart(2, '0')
}

function formatMs(ms: number): string {
	const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${pad2(seconds)}`
}

function formatDeltaSeconds(deltaMs: number): string {
	const sign = deltaMs < 0 ? '−' : deltaMs > 0 ? '+' : '±'
	const absSecs = Math.round(Math.abs(deltaMs) / 1000)
	return `${sign}${absSecs}s`
}

export function createCompleteScene(services: SceneServices): CompleteScene {
	const display = new Container()
	display.eventMode = 'static'
	const pack = services.pack
	const bg = new Graphics()
	display.addChild(bg)

	const panel = new Graphics()
	display.addChild(panel)

	const heading = new Text({
		text: 'Solved!',
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 38,
			fontWeight: '700',
			fill: pack.palette.accent,
		},
	})

	const timeLabel = new Text({
		text: '',
		style: {
			fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
			fontSize: 36,
			fontWeight: '700',
			fill: pack.palette.textPrimary,
		},
	})

	const parLabel = new Text({
		text: '',
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 18,
			fontWeight: '600',
			fill: pack.palette.textSecondary,
		},
	})

	const recordBadge = new Text({
		text: 'NEW BEST TIME',
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 12,
			fontWeight: '700',
			fill: pack.palette.accent,
			letterSpacing: 2,
		},
	})
	recordBadge.visible = false

	const streakLabel = new Text({
		text: '',
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 16,
			fontWeight: '600',
			fill: pack.palette.textPrimary,
		},
	})

	const shareBtn = new Container()
	shareBtn.eventMode = 'static'
	shareBtn.cursor = 'pointer'
	const shareBg = new Graphics()
	const shareLabel = new Text({
		text: 'SHARE',
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 16,
			fontWeight: '700',
			fill: pack.palette.bg,
		},
	})
	shareBtn.addChild(shareBg)
	shareBtn.addChild(shareLabel)

	const homeBtn = new Container()
	homeBtn.eventMode = 'static'
	homeBtn.cursor = 'pointer'
	const homeBg = new Graphics()
	const homeLabel = new Text({
		text: 'TITLE',
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 13,
			fontWeight: '700',
			fill: pack.palette.textSecondary,
		},
	})
	homeBtn.addChild(homeBg)
	homeBtn.addChild(homeLabel)

	const toast = new Text({
		text: 'Copied to clipboard',
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 13,
			fontWeight: '600',
			fill: pack.palette.accent,
		},
	})
	toast.visible = false

	display.addChild(heading)
	display.addChild(timeLabel)
	display.addChild(parLabel)
	display.addChild(recordBadge)
	display.addChild(streakLabel)
	display.addChild(shareBtn)
	display.addChild(homeBtn)
	display.addChild(toast)

	type Summary = {
		playerTimeMs: number
		timeDeltaMs: number
		currentStreak: number
		bestStreak: number
		bestMs: number
	}

	function readSummary(): Summary {
		const sc = services.runtime.entities.scoreCalc
		const st = services.runtime.entities.streakTracker
		return {
			playerTimeMs: Number(CPlayerTimeMs.value[sc.worldIndex][sc.index]) || 0,
			timeDeltaMs: Number(CTimeDeltaMs.value[sc.worldIndex][sc.index]) || 0,
			currentStreak: Number(CCurrentStreak.value[st.worldIndex][st.index]) || 0,
			bestStreak: Number(CBestStreak.value[st.worldIndex][st.index]) || 0,
			bestMs: Number(CBestTimeMs.value[sc.worldIndex][sc.index]) || 0,
		}
	}

	function refresh(): void {
		const s = readSummary()
		timeLabel.text = formatMs(s.playerTimeMs)
		parLabel.text = `${formatDeltaSeconds(s.timeDeltaMs)} vs par`
		parLabel.style.fill =
			s.timeDeltaMs < 0 ? pack.palette.accent : pack.palette.textSecondary

		streakLabel.text =
			s.bestStreak > 0
				? `Streak: ${s.currentStreak}  ·  Best: ${s.bestStreak}`
				: `Streak: ${s.currentStreak}`

		// Best-time badge: shown when current run equals the best (just set it).
		recordBadge.visible = s.bestMs > 0 && Math.abs(s.bestMs - s.playerTimeMs) < 5
	}

	let toastTimer: ReturnType<typeof setTimeout> | null = null
	function showToast(text: string): void {
		toast.text = text
		toast.visible = true
		const { width } = services.getCanvasSize()
		toast.x = (width - toast.width) / 2
		toast.y = shareBtn.y + shareBg.height + 12
		if (toastTimer !== null) clearTimeout(toastTimer)
		toastTimer = setTimeout(() => {
			toast.visible = false
			toastTimer = null
		}, 1800)
	}

	async function doShare(): Promise<void> {
		const s = readSummary()
		const message =
			`${pack.brand.publisherName} Daily Solitaire — ${formatMs(s.playerTimeMs)} ` +
			`(${formatDeltaSeconds(s.timeDeltaMs)} vs par) · streak ${s.currentStreak}`

		const nav = window.navigator as Navigator & {
			share?: (data: { text: string; url?: string }) => Promise<void>
		}
		if (typeof nav.share === 'function') {
			try {
				await nav.share({ text: message, url: window.location.href })
				return
			} catch {
				// User cancelled or share unavailable; fall through to clipboard.
			}
		}
		try {
			await window.navigator.clipboard.writeText(message)
			showToast('Copied to clipboard')
		} catch {
			showToast('Copy failed')
		}
	}

	function resize(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.palette.bg) })

		const panelW = Math.min(520, w - 32)
		const panelH = Math.min(520, h - 48)
		const panelX = (w - panelW) / 2
		const panelY = (h - panelH) / 2
		panel.clear()
		panel.roundRect(panelX, panelY, panelW, panelH, 20)
		panel.fill({ color: parseHex(pack.palette.feltColor), alpha: 0.55 })
		panel.roundRect(panelX, panelY, panelW, panelH, 20)
		panel.stroke({ color: parseHex(pack.palette.accent), width: 2, alpha: 0.35 })

		let cursorY = panelY + 40

		heading.x = (w - heading.width) / 2
		heading.y = cursorY
		cursorY = heading.y + heading.height + 28

		timeLabel.x = (w - timeLabel.width) / 2
		timeLabel.y = cursorY
		cursorY = timeLabel.y + timeLabel.height + 8

		parLabel.x = (w - parLabel.width) / 2
		parLabel.y = cursorY
		cursorY = parLabel.y + parLabel.height + 12

		if (recordBadge.visible) {
			recordBadge.x = (w - recordBadge.width) / 2
			recordBadge.y = cursorY
			cursorY = recordBadge.y + recordBadge.height + 12
		}

		streakLabel.x = (w - streakLabel.width) / 2
		streakLabel.y = cursorY
		cursorY = streakLabel.y + streakLabel.height + 36

		const shareW = Math.min(360, panelW - 48)
		const shareH = 52
		shareBg.clear()
		shareBg.roundRect(0, 0, shareW, shareH, 26)
		shareBg.fill({ color: parseHex(pack.palette.accent) })
		shareLabel.x = (shareW - shareLabel.width) / 2
		shareLabel.y = (shareH - shareLabel.height) / 2
		shareBtn.x = (w - shareW) / 2
		shareBtn.y = cursorY
		cursorY = shareBtn.y + shareH + 14

		const hBtnW = 160
		const hBtnH = 36
		homeBg.clear()
		homeBg.roundRect(0, 0, hBtnW, hBtnH, 18)
		homeBg.stroke({ color: parseHex(pack.palette.textSecondary), width: 1.5, alpha: 0.5 })
		homeLabel.x = (hBtnW - homeLabel.width) / 2
		homeLabel.y = (hBtnH - homeLabel.height) / 2
		homeBtn.x = (w - hBtnW) / 2
		homeBtn.y = cursorY

		toast.x = (w - toast.width) / 2
		toast.y = panelY + panelH - 20
	}

	function hitTest(btn: Container, bgGfx: Graphics, x: number, y: number): boolean {
		return (
			x >= btn.x &&
			x <= btn.x + bgGfx.width &&
			y >= btn.y &&
			y <= btn.y + bgGfx.height
		)
	}

	function onPointerDown(e: FederatedPointerEvent): void {
		const x = e.global.x
		const y = e.global.y
		if (hitTest(shareBtn, shareBg, x, y)) {
			void doShare()
			return
		}
		if (hitTest(homeBtn, homeBg, x, y)) {
			void services.manager().go('title')
		}
	}

	async function enter(_manager: IScreenManager): Promise<void> {
		display.on('pointerdown', onPointerDown)
		refresh()
		const { width, height } = services.getCanvasSize()
		resize(width, height)
	}

	async function exit(_manager: IScreenManager): Promise<void> {
		display.off('pointerdown', onPointerDown)
		if (toastTimer !== null) {
			clearTimeout(toastTimer)
			toastTimer = null
		}
		toast.visible = false
	}

	function destroy(): void {
		display.destroy({ children: true })
	}

	return {
		name: 'complete',
		display,
		enter,
		exit,
		destroy,
		resize,
	}
}
