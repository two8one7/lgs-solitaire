import { Container, Graphics, Text } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import { parseHex } from '../render/palette'
import type { SceneServices } from './scene-services'
import { centerText, drawPanel, textStyle } from './ui'

export type ChallengeScene = IScreen & {
	resize: (w: number, h: number) => void
}

export function createChallengeScene(services: SceneServices): ChallengeScene {
	const { pack } = services
	const display = new Container()
	display.eventMode = 'static'
	const bg = new Graphics()
	const panel = new Graphics()
	const title = new Text({
		text: pack.copy.challengeTitle,
		style: textStyle(pack, 'h1', { fontSize: 34, fill: pack.palette.text, align: 'center' }),
	})
	const body = new Text({
		text: pack.copy.challengeBody,
		style: textStyle(pack, 'body', {
			fontSize: 16,
			fill: pack.palette.muted,
			align: 'center',
			wordWrap: true,
			wordWrapWidth: 460,
		}),
	})
	const play = new Container()
	play.eventMode = 'static'
	play.cursor = 'pointer'
	const playBg = new Graphics()
	const playLabel = new Text({
		text: 'PLAY CHALLENGE',
		style: textStyle(pack, 'body', { fontSize: 15, fill: pack.palette.panel, fontWeight: '700' }),
	})
	play.addChild(playBg, playLabel)
	display.addChild(bg, panel, title, body, play)

	function resize(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.palette.bg) })
		const panelW = Math.min(540, w - 32)
		const panelH = Math.min(360, h - 48)
		const panelX = (w - panelW) / 2
		const panelY = (h - panelH) / 2
		drawPanel(panel, panelX, panelY, panelW, panelH, pack)
		centerText(title, panelX, panelW)
		title.y = panelY + 48
		body.style.wordWrapWidth = panelW - 72
		centerText(body, panelX, panelW)
		body.y = title.y + title.height + 18
		const btnW = Math.min(300, panelW - 64)
		const btnH = 52
		playBg.clear()
		playBg.roundRect(0, 0, btnW, btnH, pack.personalityTheme.shape.cornerRadius.pill)
		playBg.fill({ color: parseHex(pack.palette.accent) })
		playLabel.x = (btnW - playLabel.width) / 2
		playLabel.y = (btnH - playLabel.height) / 2
		play.x = (w - btnW) / 2
		play.y = panelY + panelH - btnH - 32
	}

	function onPointerDown(e: FederatedPointerEvent): void {
		if (e.global.x >= play.x && e.global.x <= play.x + playBg.width && e.global.y >= play.y && e.global.y <= play.y + playBg.height) {
			void services.manager().go('playing')
		}
	}

	async function enter(_manager: IScreenManager): Promise<void> {
		display.on('pointerdown', onPointerDown)
		const { width, height } = services.getCanvasSize()
		resize(width, height)
	}

	async function exit(_manager: IScreenManager): Promise<void> {
		display.off('pointerdown', onPointerDown)
	}

	function destroy(): void {
		display.destroy({ children: true })
	}

	return { name: 'challenge', display, enter, exit, destroy, resize }
}
