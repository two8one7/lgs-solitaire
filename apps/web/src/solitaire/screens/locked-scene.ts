import { Container, Graphics, Text } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import { CBestStreak, CBestTimeMs, CCurrentStreak } from '../components'
import { parseHex } from '../render/palette'
import type { SceneServices } from './scene-services'
import { centerText, drawPanel, textStyle } from './ui'

export type LockedScene = IScreen & {
	resize: (w: number, h: number) => void
}

function pad2(n: number): string {
	return n.toString().padStart(2, '0')
}

function formatTime(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000))
	return `${Math.floor(total / 60)}:${pad2(total % 60)}`
}

function nextRolloverCountdown(timeZone: string, rolloverHour: number): string {
	const now = new Date()
	const local = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	}).formatToParts(now)
	const part = (type: string): number => Number(local.find((p) => p.type === type)?.value ?? 0)
	const localAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
	let target = Date.UTC(part('year'), part('month') - 1, part('day'), rolloverHour, 0, 0)
	if (localAsUtc >= target) target += 24 * 60 * 60 * 1000
	const diff = Math.max(0, target - localAsUtc)
	const h = Math.floor(diff / 3600000)
	const m = Math.floor((diff % 3600000) / 60000)
	return `${h}h ${pad2(m)}m`
}

export function createLockedScene(services: SceneServices): LockedScene {
	const { pack } = services
	const display = new Container()
	display.eventMode = 'static'
	const bg = new Graphics()
	const panel = new Graphics()
	const title = new Text({
		text: pack.copy.lockedTitle,
		style: textStyle(pack, 'h2', { fontSize: 28, fill: pack.palette.text, align: 'center', wordWrap: true, wordWrapWidth: 500 }),
	})
	const countdown = new Text({
		text: '',
		style: textStyle(pack, 'mono', { fontSize: 28, fill: pack.palette.accent }),
	})
	const stats = new Text({
		text: '',
		style: textStyle(pack, 'body', { fontSize: 16, fill: pack.palette.text, align: 'center' }),
	})
	const button = new Container()
	button.eventMode = 'static'
	button.cursor = 'pointer'
	const buttonBg = new Graphics()
	const buttonLabel = new Text({
		text: pack.copy.lockedCta.toUpperCase(),
		style: textStyle(pack, 'body', { fontSize: 14, fill: pack.palette.panel, fontWeight: '700' }),
	})
	button.addChild(buttonBg, buttonLabel)
	display.addChild(bg, panel, title, countdown, stats, button)

	function refresh(): void {
		const st = services.runtime.entities.streakTracker
		const sc = services.runtime.entities.scoreCalc
		const current = Number(CCurrentStreak.value[st.worldIndex][st.index]) || 0
		const best = Number(CBestStreak.value[st.worldIndex][st.index]) || 0
		const bestMs = Number(CBestTimeMs.value[sc.worldIndex][sc.index]) || 0
		countdown.text = nextRolloverCountdown(pack.timeZone, pack.solitaire.rolloverHour)
		stats.text = `${pack.copy.streakLabel}: ${current}  ·  Best streak: ${best}  ·  Best time: ${formatTime(bestMs)}`
	}

	function resize(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.palette.bg) })
		const panelW = Math.min(560, w - 32)
		const panelH = Math.min(420, h - 48)
		const panelX = (w - panelW) / 2
		const panelY = (h - panelH) / 2
		drawPanel(panel, panelX, panelY, panelW, panelH, pack)
		title.style.wordWrapWidth = panelW - 56
		centerText(title, panelX, panelW)
		title.y = panelY + 44
		centerText(countdown, panelX, panelW)
		countdown.y = title.y + title.height + 34
		stats.style.wordWrapWidth = panelW - 64
		centerText(stats, panelX, panelW)
		stats.y = countdown.y + countdown.height + 24
		const btnW = Math.min(260, panelW - 64)
		const btnH = 48
		buttonBg.clear()
		buttonBg.roundRect(0, 0, btnW, btnH, pack.personalityTheme.shape.cornerRadius.pill)
		buttonBg.fill({ color: parseHex(pack.palette.accent) })
		buttonLabel.x = (btnW - buttonLabel.width) / 2
		buttonLabel.y = (btnH - buttonLabel.height) / 2
		button.x = (w - btnW) / 2
		button.y = panelY + panelH - btnH - 28
	}

	function onPointerDown(e: FederatedPointerEvent): void {
		if (e.global.x >= button.x && e.global.x <= button.x + buttonBg.width && e.global.y >= button.y && e.global.y <= button.y + buttonBg.height) {
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
	}

	function destroy(): void {
		display.destroy({ children: true })
	}

	return { name: 'locked', display, enter, exit, destroy, resize }
}
