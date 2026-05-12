import type { IPlatform } from '@2817/platform'
import { WebSaveAdapter } from './save'
import { NoOpHaptics } from './haptics'
import { WebLifecycle } from './lifecycle'

export function createWebPlatform(): IPlatform {
	return {
		name: 'web',
		save: new WebSaveAdapter(),
		haptics: new NoOpHaptics(),
		lifecycle: new WebLifecycle(),
	}
}
