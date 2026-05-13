import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import {
	CBestStreak,
	CBestTimeMs,
	CCurrentStreak,
	CPlayerTimeMs,
	CTimeDeltaMs,
} from '../components'
import { parseHex } from '../render/palette'
import type { SceneServices } from './scene-services'
import { assetUrl, centerText, drawPanel, textStyle } from './ui'

export type CompleteScene = IScreen & {
	resize: (w: number, h: number) => void
}

function pad2(n: number): string {
	return n.toString().padStart(2, '0')
}

function formatMs(ms: number): string {
	const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
	return `${Math.floor(totalSeconds / 60)}:${pad2(totalSeconds % 60)}`
}

function formatDeltaSeconds(deltaMs: number): string {
	const sign = deltaMs < 0 ? '-' : deltaMs > 0 ? '+' : '+/-'
	return `${sign}${Math.round(Math.abs(deltaMs) / 1000)}s`
}

export function createCompleteScene(services: SceneServices): CompleteScene {
	const { pack } = services
	const display = new Container()
	display.eventMode = 'static'
	const bg = new Graphics()
	const confetti = new Graphics()
	const panel = new Graphics()
	const logo = new Sprite(Texture.from(assetUrl(pack.brand.logoAsset)))
	logo.anchor.set(0.5)
	const publisherMark = new Text({
		text: pack.brand.publisherName,
		style: textStyle(pack, 'h2', { fontSize: 18, fill: pack.palette.accent, fontWeight: '800' }),
	})
	const heading = new Text({
		text: pack.copy.completeTitle,
		style: textStyle(pack, 'h2', { fontSize: 28, fill: pack.palette.text, align: 'center', wordWrap: true, wordWrapWidth: 500 }),
	})
	const timeLabel = new Text({
		text: '',
		style: textStyle(pack, 'mono', { fontSize: 38, fill: pack.palette.text, fontWeight: '700' }),
	})
	const parLabel = new Text({
		text: '',
		style: textStyle(pack, 'body', { fontSize: 17, fill: pack.palette.muted, fontWeight: '700' }),
	})
	const recordBadge = new Text({
		text: 'NEW BEST TIME',
		style: textStyle(pack, 'small', { fontSize: 12, fill: pack.palette.accentAlt, fontWeight: '700', letterSpacing: 2 }),
	})
	const streakLabel = new Text({
		text: '',
		style: textStyle(pack, 'body', { fontSize: 16, fill: pack.palette.text }),
	})
	const footer = new Text({
		text: pack.copy.completeFooter,
		style: textStyle(pack, 'small', { fontSize: 13, fill: pack.palette.muted, align: 'center' }),
	})
	const shareBtn = new Container()
	shareBtn.eventMode = 'static'
	shareBtn.cursor = 'pointer'
	const shareBg = new Graphics()
	const shareLabel = new Text({
		text: pack.copy.shareLabel.toUpperCase(),
		style: textStyle(pack, 'body', { fontSize: 15, fill: pack.palette.panel, fontWeight: '700' }),
	})
	shareBtn.addChild(shareBg, shareLabel)
	const challengeBtn = new Container()
	challengeBtn.eventMode = 'static'
	challengeBtn.cursor = 'pointer'
	const challengeBg = new Graphics()
	const challengeLabel = new Text({
		text: 'TRY CHALLENGE',
		style: textStyle(pack, 'small', { fontSize: 12, fill: pack.palette.text, fontWeight: '700' }),
	})
	challengeBtn.addChild(challengeBg, challengeLabel)
	const titleBtn = new Container()
	titleBtn.eventMode = 'static'
	titleBtn.cursor = 'pointer'
	const titleBg = new Graphics()
	const titleLabel = new Text({
		text: 'TITLE',
		style: textStyle(pack, 'small', { fontSize: 12, fill: pack.palette.text, fontWeight: '700' }),
	})
	titleBtn.addChild(titleBg, titleLabel)
	const toast = new Text({
		text: '',
		style: textStyle(pack, 'small', { fontSize: 13, fill: pack.palette.accent, fontWeight: '700' }),
	})
	toast.visible = false
	display.addChild(bg, confetti, panel, logo, publisherMark, heading, timeLabel, parLabel, recordBadge, streakLabel, footer, shareBtn, challengeBtn, titleBtn, toast)

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
		const delta = formatDeltaSeconds(s.timeDeltaMs)
		parLabel.text = `${pack.copy.scoreLabel}: ${delta} vs par`
		parLabel.style.fill = s.timeDeltaMs < 0 ? pack.palette.success : pack.palette.muted
		streakLabel.text =
			s.bestStreak > 0
				? `${pack.copy.streakLabel}: ${s.currentStreak}  ·  Best: ${s.bestStreak}`
				: `${pack.copy.streakLabel}: ${s.currentStreak}`
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

	function shareMessage(): string {
		const s = readSummary()
		return pack.share.template
			.replace('{time}', formatMs(s.playerTimeMs))
			.replace('{parDelta}', `${formatDeltaSeconds(s.timeDeltaMs)} vs par`)
			.replace('{streak}', String(s.currentStreak))
	}

	async function doShare(): Promise<void> {
		const message = `${shareMessage()} ${pack.share.hashTag ?? ''}`.trim()
		const nav = window.navigator as Navigator & {
			share?: (data: { text: string; url?: string }) => Promise<void>
		}
		if (typeof nav.share === 'function') {
			try {
				await nav.share({ text: message, url: window.location.href })
				return
			} catch {
				// User cancellation falls back to copy.
			}
		}
		try {
			await window.navigator.clipboard.writeText(message)
			showToast(pack.copy.shareCopiedLabel)
		} catch {
			showToast('Copy failed')
		}
	}

	function paintConfetti(w: number, h: number): void {
		confetti.clear()
		const colors = pack.winConfetti.colors
		for (let i = 0; i < pack.winConfetti.count; i++) {
			const color = parseHex(colors[i % colors.length]!)
			const x = (i * 47) % Math.max(1, w)
			const y = ((i * 83) % Math.max(1, h)) * 0.68
			confetti.rect(x, y, 5 + (i % 3) * 2, 9 + (i % 4))
			confetti.fill({ color, alpha: 0.18 + (i % 5) * 0.025 })
		}
	}

	function resize(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.palette.bg) })
		paintConfetti(w, h)
		const panelW = Math.min(560, w - 32)
		const panelH = Math.min(600, h - 44)
		const panelX = (w - panelW) / 2
		const panelY = (h - panelH) / 2
		drawPanel(panel, panelX, panelY, panelW, panelH, pack)
		logo.width = Math.min(230, panelW - 100)
		logo.height = logo.width * (80 / 300)
		logo.x = w / 2
		logo.y = panelY + 52
		centerText(publisherMark, panelX, panelW)
		publisherMark.y = panelY + 35
		heading.style.wordWrapWidth = panelW - 64
		centerText(heading, panelX, panelW)
		heading.y = logo.y + logo.height / 2 + 22
		centerText(timeLabel, panelX, panelW)
		timeLabel.y = heading.y + heading.height + 20
		centerText(parLabel, panelX, panelW)
		parLabel.y = timeLabel.y + timeLabel.height + 8
		let y = parLabel.y + parLabel.height + 12
		recordBadge.visible = recordBadge.visible
		if (recordBadge.visible) {
			centerText(recordBadge, panelX, panelW)
			recordBadge.y = y
			y += recordBadge.height + 12
		}
		centerText(streakLabel, panelX, panelW)
		streakLabel.y = y
		y += streakLabel.height + 24
		centerText(footer, panelX, panelW)
		footer.y = y
		const shareW = Math.min(360, panelW - 64)
		const shareH = 52
		shareBg.clear()
		shareBg.roundRect(0, 0, shareW, shareH, pack.personalityTheme.shape.cornerRadius.pill)
		shareBg.fill({ color: parseHex(pack.palette.accent) })
		shareLabel.x = (shareW - shareLabel.width) / 2
		shareLabel.y = (shareH - shareLabel.height) / 2
		shareBtn.x = (w - shareW) / 2
		shareBtn.y = panelY + panelH - 126
		const smallW = 152
		const smallH = 38
		challengeBg.clear()
		challengeBg.roundRect(0, 0, smallW, smallH, pack.personalityTheme.shape.cornerRadius.pill)
		challengeBg.stroke({ color: parseHex(pack.palette.accent), width: 1.5, alpha: 0.45 })
		challengeLabel.x = (smallW - challengeLabel.width) / 2
		challengeLabel.y = (smallH - challengeLabel.height) / 2
		challengeBtn.x = w / 2 - smallW - 6
		challengeBtn.y = panelY + panelH - 58
		titleBg.clear()
		titleBg.roundRect(0, 0, smallW, smallH, pack.personalityTheme.shape.cornerRadius.pill)
		titleBg.stroke({ color: parseHex(pack.palette.muted), width: 1.5, alpha: 0.45 })
		titleLabel.x = (smallW - titleLabel.width) / 2
		titleLabel.y = (smallH - titleLabel.height) / 2
		titleBtn.x = w / 2 + 6
		titleBtn.y = challengeBtn.y
		toast.x = (w - toast.width) / 2
		toast.y = shareBtn.y + shareH + 10
	}

	function hit(btn: Container, g: Graphics, x: number, y: number): boolean {
		return x >= btn.x && x <= btn.x + g.width && y >= btn.y && y <= btn.y + g.height
	}

	function onPointerDown(e: FederatedPointerEvent): void {
		const x = e.global.x
		const y = e.global.y
		if (hit(shareBtn, shareBg, x, y)) {
			void doShare()
			return
		}
		if (hit(challengeBtn, challengeBg, x, y)) {
			window.location.href = `${window.location.pathname}?mode=challenge`
			return
		}
		if (hit(titleBtn, titleBg, x, y)) {
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

	return { name: 'complete', display, enter, exit, destroy, resize }
}
