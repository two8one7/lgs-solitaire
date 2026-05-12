import { Preferences } from '@capacitor/preferences'
import type { ISaveAdapter } from '@2817/platform'

// Bridges the sync ISaveAdapter API to async @capacitor/preferences via
// an in-memory cache hydrated at construction time. The factory
// (createCapacitorPlatform) is async and pre-hydrates this cache; once
// constructed the adapter operates synchronously, fire-and-forgetting
// disk writes. Eventually-consistent persistence is fine — this is a
// casual game, not a financial app, and Preferences keys/values are
// small (album seed + ID, score history, settings).
//
// Optional `prefix` namespaces Preferences keys when an app needs to
// coexist with other consumers; defaults to '' (no prefix).

export interface CapacitorSaveAdapterOptions {
	prefix?: string
}

export class CapacitorSaveAdapter implements ISaveAdapter {
	private cache: Map<string, string>
	private readonly prefix: string

	constructor(initialEntries: Map<string, string>, opts: CapacitorSaveAdapterOptions = {}) {
		this.cache = new Map(initialEntries)
		this.prefix = opts.prefix ?? ''
	}

	get(key: string): string | null {
		const v = this.cache.get(key)
		return v === undefined ? null : v
	}

	set(key: string, value: string): boolean {
		this.cache.set(key, value)
		void Preferences.set({ key: this.prefix + key, value }).catch((err: unknown) => {
			console.warn('[CapacitorSaveAdapter] async set failed:', err)
		})
		return true
	}

	remove(key: string): void {
		this.cache.delete(key)
		void Preferences.remove({ key: this.prefix + key }).catch((err: unknown) => {
			console.warn('[CapacitorSaveAdapter] async remove failed:', err)
		})
	}

	keys(): string[] {
		return Array.from(this.cache.keys())
	}
}

// Hydrate Preferences entries into a Map at boot. Filters by `prefix`
// and strips it from the returned keys; pass '' to load all entries.
export async function hydrateSaveCache(prefix: string = ''): Promise<Map<string, string>> {
	const out = new Map<string, string>()
	const { keys } = await Preferences.keys()
	for (const fullKey of keys) {
		if (prefix !== '' && !fullKey.startsWith(prefix)) continue
		const { value } = await Preferences.get({ key: fullKey })
		if (value !== null) {
			out.set(prefix === '' ? fullKey : fullKey.slice(prefix.length), value)
		}
	}
	return out
}
