import type { ILifecycle, LifecycleEvent } from '@2817/platform'

// Wraps document.visibilitychange. Fires `foreground` when
// visibilityState flips to `'visible'`, `background` when it flips to
// `'hidden'`. WKWebView fires this correctly on app
// background/foreground; the existing gameloop visibilitychange handler
// in packages/gameloop relies on the same browser event.

export class WebLifecycle implements ILifecycle {
	private foregroundListeners = new Set<() => void>()
	private backgroundListeners = new Set<() => void>()
	private installed = false

	addListener(event: LifecycleEvent, cb: () => void): () => void {
		this.ensureInstalled()
		const set = event === 'foreground' ? this.foregroundListeners : this.backgroundListeners
		set.add(cb)
		return () => set.delete(cb)
	}

	private ensureInstalled(): void {
		if (this.installed) return
		this.installed = true
		document.addEventListener('visibilitychange', () => {
			const set =
				document.visibilityState === 'visible'
					? this.foregroundListeners
					: this.backgroundListeners
			for (const cb of set) cb()
		})
	}
}
