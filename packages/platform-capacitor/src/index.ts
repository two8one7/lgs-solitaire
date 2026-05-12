import { Capacitor } from '@capacitor/core'
import type { IPlatform } from '@2817/platform'
import { CapacitorSaveAdapter, hydrateSaveCache } from './save'
import { CapacitorHapticsAdapter } from './haptics'
import { CapacitorLifecycleAdapter } from './lifecycle'

// Async because the save adapter must hydrate from @capacitor/preferences
// at construction time — Preferences is async but ISaveAdapter is sync,
// so the in-memory cache is populated up-front and the sync API operates
// on it. The composition root (apps/web/src/game/index.ts Phase A.5)
// awaits this and binds via .toValue() since the DI container does not
// support async factories.

export interface CreateCapacitorPlatformOptions {
	prefix?: string
}

export async function createCapacitorPlatform(
	opts: CreateCapacitorPlatformOptions = {},
): Promise<IPlatform> {
	const prefix = opts.prefix ?? ''
	const initial = await hydrateSaveCache(prefix)

	const platformName = Capacitor.getPlatform() === 'ios'
		? 'capacitor-ios' as const
		: 'capacitor-android' as const

	return {
		name: platformName,
		save: new CapacitorSaveAdapter(initial, { prefix }),
		haptics: new CapacitorHapticsAdapter(),
		lifecycle: new CapacitorLifecycleAdapter(),
	}
}
