/**
 * Boot scene — branded loading panel shown before title.
 *
 * Phase 3 has nothing to actually preload (pack imported, daily artifact
 * fetched in boot.ts before runtime creation). The scene exists so the
 * first frame the user sees carries publisher branding rather than a
 * black flash, and so the daily-fetch landing site is already reserved
 * for Phase 3b/4 when it gets pushed in here.
 */

import { Container, Graphics, Text } from 'pixi.js'
import type { IScreen, IScreenManager } from '@2817/screen-manager'
import { parseHex } from '../render/palette'
import type { SceneServices } from './scene-services'

export type BootScene = IScreen & {
	resize: (w: number, h: number) => void
}

export function createBootScene(services: SceneServices): BootScene {
	const display = new Container()
	const pack = services.pack

	const bg = new Graphics()
	const title = new Text({
		text: pack.brand.title,
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 28,
			fontWeight: '700',
			fill: pack.palette.textPrimary,
			align: 'center',
		},
	})
	const loading = new Text({
		text: 'Loading…',
		style: {
			fontFamily: 'system-ui, sans-serif',
			fontSize: 12,
			fontWeight: '600',
			fill: pack.palette.textSecondary,
			letterSpacing: 2,
			align: 'center',
		},
	})

	display.addChild(bg)
	display.addChild(title)
	display.addChild(loading)

	function paintBg(w: number, h: number): void {
		bg.clear()
		bg.rect(0, 0, w, h)
		bg.fill({ color: parseHex(pack.palette.bg) })
	}

	function resize(w: number, h: number): void {
		paintBg(w, h)
		title.x = (w - title.width) / 2
		title.y = h / 2 - 30
		loading.x = (w - loading.width) / 2
		loading.y = title.y + title.height + 24
	}

	async function enter(_manager: IScreenManager): Promise<void> {
		const { width, height } = services.getCanvasSize()
		resize(width, height)
	}

	function revealed(manager: IScreenManager): void {
		// One frame, then jump to title. Daily fetch already happened in boot.ts.
		void (async () => {
			await new Promise<void>((resolve) => setTimeout(resolve, 80))
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
