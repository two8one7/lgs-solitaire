// Texture cache — module-scope SVG → Pixi Texture loader.
//
// Shared by fx-particles.ts (per-particle texture) and fx-primitives.ts
// (curtain-wipe panel texture). Resolves once per URL; subsequent calls
// return the cached Texture immediately.
//
// Fallback contract: Texture.WHITE is returned for:
//   - undefined / empty url
//   - while a load is in flight
//   - when a load has failed
// No throw. No re-try (failed URLs stay failed for the session to avoid
// hammering a bad asset path on every particle burst).

import { Assets, Texture } from 'pixi.js'

// Loaded textures, keyed by URL.
const _cache = new Map<string, Texture>()
// URLs currently loading (Promise in flight). Not stored as Promise to avoid
// test-side Promise equality issues; the Set is enough to dedupe.
const _pending = new Set<string>()

/**
 * Resolve a URL to a Pixi Texture.
 *
 * Returns Texture.WHITE when url is falsy, while loading, or if the load
 * fails. Kicks off a background load on the first call for a given URL.
 */
export function resolveTexturePath(url: string | undefined): Texture {
	if (!url) return Texture.WHITE
	const cached = _cache.get(url)
	if (cached) return cached
	if (!_pending.has(url)) {
		_pending.add(url)
		void Assets.load<Texture>(url).then(
			(tex) => {
				_cache.set(url, tex)
				_pending.delete(url)
			},
			() => {
				// Load failed — leave the URL absent from _cache so future calls
				// continue returning WHITE (not a re-try).
				_pending.delete(url)
			},
		)
	}
	return Texture.WHITE
}

/**
 * Clear the module-scope cache + pending set.
 * @internal — for unit tests only. Never call in production.
 */
export function _clearTextureCache(): void {
	_cache.clear()
	_pending.clear()
}
