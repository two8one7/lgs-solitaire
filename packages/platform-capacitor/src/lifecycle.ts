import { App } from '@capacitor/app'
import type { ILifecycle, LifecycleEvent } from '@2817/platform'

// Native backup for the existing document.visibilitychange handler.
// Both fire on iOS — appStateChange via Capacitor and visibilitychange
// in WKWebView — and the gameloop's prevTime-reset is idempotent, so
// double-firing is safe. This adapter exists so future WebKit changes
// to the visibility-event contract don't silently break lifecycle.

export class CapacitorLifecycleAdapter implements ILifecycle {
	private foregroundListeners = new Set<() => void>()
	private backgroundListeners = new Set<() => void>()

	constructor() {
		void App.addListener('appStateChange', ({ isActive }) => {
			const set = isActive ? this.foregroundListeners : this.backgroundListeners
			for (const cb of set) cb()
		})
	}

	addListener(event: LifecycleEvent, cb: () => void): () => void {
		const set = event === 'foreground' ? this.foregroundListeners : this.backgroundListeners
		set.add(cb)
		return () => set.delete(cb)
	}
}
