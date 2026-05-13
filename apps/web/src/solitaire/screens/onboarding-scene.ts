import { Container, Graphics, Text } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import { parseHex } from '../render/palette'
import type { SceneServices } from './scene-services'
import { centerText, drawPanel, textStyle } from './ui'

export type OnboardingScene = IScreen & {
	resize: (w: number, h: number) => void
}

function onboardedKey(slug: string): string {
	return `lgs-solitaire:onboarded:${slug}`
}

export function createOnboardingScene(services: SceneServices): OnboardingScene {
	const { pack } = services
	const display = new Container()
	display.eventMode = 'static'
	const bg = new Graphics()
	const panel = new Graphics()
	const title = new Text({
		text: pack.copy.onboardingTitle,
		style: textStyle(pack, 'h2', {
			fontSize: 28,
			fill: pack.palette.text,
			align: 'center',
			wordWrap: true,
			wordWrapWidth: 520,
		}),
	})
	const cards = pack.copy.onboardingCards.map(
		(copy, i) =>
			new Text({
				text: `${i + 1}. ${copy}`,
				style: textStyle(pack, 'body', {
					fontSize: 16,
					fill: pack.palette.text,
					wordWrap: true,
					wordWrapWidth: 460,
				}),
			}),
	)
	const button = new Container()
	button.eventMode = 'static'
	button.cursor = 'pointer'
	const buttonBg = new Graphics()
	const buttonLabel = new Text({
		text: pack.copy.playButton.toUpperCase(),
		style: textStyle(pack, 'body', { fontSize: 15, fill: pack.palette.panel, fontWeight: '700' }),
	})
	button.addChild(buttonBg, buttonLabel)
	display.addChild(bg, panel, title, ...cards, button)

	function resize(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.palette.bg) })
		const panelW = Math.min(560, w - 32)
		const panelH = Math.min(480, h - 48)
		const panelX = (w - panelW) / 2
		const panelY = (h - panelH) / 2
		drawPanel(panel, panelX, panelY, panelW, panelH, pack)
		title.style.wordWrapWidth = panelW - 56
		centerText(title, panelX, panelW)
		title.y = panelY + 34
		let y = title.y + title.height + 28
		for (let i = 0; i < cards.length; i++) {
			const card = cards[i]!
			card.style.wordWrapWidth = panelW - 72
			card.x = panelX + 36
			card.y = y
			y += card.height + 18
		}
		const btnW = Math.min(340, panelW - 64)
		const btnH = 52
		buttonBg.clear()
		buttonBg.roundRect(0, 0, btnW, btnH, pack.personalityTheme.shape.cornerRadius.pill)
		buttonBg.fill({ color: parseHex(pack.palette.accent) })
		buttonLabel.x = (btnW - buttonLabel.width) / 2
		buttonLabel.y = (btnH - buttonLabel.height) / 2
		button.x = (w - btnW) / 2
		button.y = panelY + panelH - btnH - 28
	}

	function onPointerDown(e: FederatedPointerEvent): void {
		const x = e.global.x
		const y = e.global.y
		if (x >= button.x && x <= button.x + buttonBg.width && y >= button.y && y <= button.y + buttonBg.height) {
			window.localStorage.setItem(onboardedKey(pack.slug), '1')
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

	return { name: 'onboarding', display, enter, exit, destroy, resize }
}
