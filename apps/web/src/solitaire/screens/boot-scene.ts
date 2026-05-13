/**
 * Boot scene — branded loading panel shown before title.
 *
 * Phase 3 has nothing to actually preload (pack imported, daily artifact
 * fetched in boot.ts before runtime creation). The scene exists so the
 * first frame the user sees carries publisher branding rather than a
 * black flash, and so the daily-fetch landing site is already reserved
 * for Phase 3b/4 when it gets pushed in here.
 */

import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import { parseHex } from '../render/palette'
import type { SceneServices } from './scene-services'
import { assetUrl, textStyle } from './ui'

export type BootScene = IScreen & {
	resize: (w: number, h: number) => void
}

export function createBootScene(services: SceneServices): BootScene {
	const display = new Container()
	const pack = services.pack

	const bg = new Graphics()
	const logo = new Sprite(Texture.from(assetUrl(pack.brand.logoAsset)))
	logo.anchor.set(0.5)
	logo.alpha = 0
	const loading = new Text({
		text: 'DEALING THE DAILY DECK',
		style: textStyle(pack, 'small', {
			fontSize: 12,
			fill: pack.palette.muted,
			align: 'center',
		}),
	})

	display.addChild(bg)
	display.addChild(logo)
	display.addChild(loading)

	function paintBg(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.palette.bg) })
	}

	function resize(w: number, h: number): void {
		paintBg(w, h)
		const logoW = Math.min(300, w - 48)
		logo.width = logoW
		logo.height = logoW * (80 / 300)
		logo.x = w / 2
		logo.y = h / 2 - 24
		loading.x = (w - loading.width) / 2
		loading.y = logo.y + logo.height / 2 + 28
	}

	async function enter(_manager: IScreenManager): Promise<void> {
		const { width, height } = services.getCanvasSize()
		resize(width, height)
	}

	function revealed(manager: IScreenManager): void {
		// One frame, then jump to title. Daily fetch already happened in boot.ts.
		void (async () => {
			await new Promise<void>((resolve) => setTimeout(resolve, 80))
			logo.alpha = 1
			await new Promise<void>((resolve) => setTimeout(resolve, 260))
			await manager.go('title')
		})()
	}

	function destroy(): void {
		display.destroy({ children: true })
	}

	return {
		name: 'boot',
		display,
		enter,
		revealed,
		destroy,
		resize,
	}
}
