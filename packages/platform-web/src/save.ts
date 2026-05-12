import type { ISaveAdapter } from '@2817/platform'

// localStorage-backed save adapter. Optional `prefix` namespaces keys
// when an app needs to coexist with other code on the same origin;
// defaults to '' (no prefix). keys() returns un-prefixed keys when a
// prefix is set, and ALL localStorage keys when prefix is empty —
// callers that need filtered keys should pass a prefix.

export interface WebSaveAdapterOptions {
	prefix?: string
}

export class WebSaveAdapter implements ISaveAdapter {
	private readonly prefix: string

	constructor(opts: WebSaveAdapterOptions = {}) {
		this.prefix = opts.prefix ?? ''
	}

	get(key: string): string | null {
		return localStorage.getItem(this.prefix + key)
	}

	set(key: string, value: string): boolean {
		try {
			localStorage.setItem(this.prefix + key, value)
			return true
		} catch (err) {
			// QuotaExceededError, SecurityError (private mode), etc.
			console.warn('[WebSaveAdapter] set failed:', err)
			return false
		}
	}

	remove(key: string): void {
		localStorage.removeItem(this.prefix + key)
	}

	keys(): string[] {
		const out: string[] = []
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i)
			if (k == null) continue
			if (this.prefix === '') {
				out.push(k)
			} else if (k.startsWith(this.prefix)) {
				out.push(k.slice(this.prefix.length))
			}
		}
		return out
	}
}
