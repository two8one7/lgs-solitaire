/**
 * Contract tests for CapacitorSaveAdapter (native implementation).
 *
 * These tests OWN the contract for the native save adapter: a sync ISaveAdapter
 * surface backed by a hydrated in-memory cache, with disk writes forwarded to
 * @capacitor/preferences as fire-and-forget. Hydration is the factory's
 * responsibility — the class receives a pre-built Map in its constructor.
 *
 * Default-empty prefix means bare keys are passed to Preferences. An explicit
 * `prefix` constructor option namespaces keys when an app needs to coexist
 * with other consumers.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@capacitor/preferences', () => ({
	Preferences: {
		set: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue({ value: null }),
		remove: vi.fn().mockResolvedValue(undefined),
		keys: vi.fn().mockResolvedValue({ keys: [] }),
	},
}))

import { Preferences } from '@capacitor/preferences'
import { CapacitorSaveAdapter } from '../src/save'

describe('CapacitorSaveAdapter', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('constructor populates the cache from initialEntries', () => {
		const adapter = new CapacitorSaveAdapter(new Map([['k', 'v']]))
		expect(adapter.get('k')).toBe('v')
	})

	it('get of missing key returns null (not undefined)', () => {
		const adapter = new CapacitorSaveAdapter(new Map())
		expect(adapter.get('nope')).toBeNull()
	})

	it('set updates the cache synchronously', () => {
		const adapter = new CapacitorSaveAdapter(new Map())
		adapter.set('a', '1')
		expect(adapter.get('a')).toBe('1')
	})

	it('set returns true even though disk write is async fire-and-forget', () => {
		const adapter = new CapacitorSaveAdapter(new Map())
		const ok = adapter.set('a', '1')
		expect(ok).toBe(true)
	})

	it('set forwards to Preferences.set with the bare key under default-empty prefix', () => {
		const adapter = new CapacitorSaveAdapter(new Map())
		adapter.set('a', '1')
		expect(Preferences.set).toHaveBeenCalledWith({ key: 'a', value: '1' })
	})

	it('remove updates the cache synchronously', () => {
		const adapter = new CapacitorSaveAdapter(new Map())
		adapter.set('a', '1')
		adapter.remove('a')
		expect(adapter.get('a')).toBeNull()
	})

	it('remove forwards to Preferences.remove with the bare key under default-empty prefix', () => {
		const adapter = new CapacitorSaveAdapter(new Map())
		adapter.set('a', '1')
		adapter.remove('a')
		expect(Preferences.remove).toHaveBeenCalledWith({ key: 'a' })
	})

	it('keys() returns currently-cached keys un-prefixed', () => {
		const adapter = new CapacitorSaveAdapter(new Map())
		adapter.set('a', '1')
		adapter.set('b', '2')
		expect(adapter.keys().sort()).toEqual(['a', 'b'])
	})

	it('set failure (rejected Preferences.set Promise) is swallowed', async () => {
		const adapter = new CapacitorSaveAdapter(new Map())
		;(Preferences.set as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('quota'))

		let result: boolean | undefined
		expect(() => {
			result = adapter.set('big', 'x')
		}).not.toThrow()
		expect(result).toBe(true)
		expect(adapter.get('big')).toBe('x')

		// Let the rejected Promise settle so an unhandled rejection (if any) surfaces.
		await new Promise((r) => setTimeout(r, 10))
	})
})

describe('CapacitorSaveAdapter with explicit prefix', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('set forwards to Preferences.set with the prefixed key', () => {
		const adapter = new CapacitorSaveAdapter(new Map(), { prefix: 'bbc:' })
		adapter.set('foo', 'x')
		expect(Preferences.set).toHaveBeenCalledWith({ key: 'bbc:foo', value: 'x' })
	})

	it('remove forwards to Preferences.remove with the prefixed key', () => {
		const adapter = new CapacitorSaveAdapter(new Map(), { prefix: 'bbc:' })
		adapter.set('foo', 'x')
		adapter.remove('foo')
		expect(Preferences.remove).toHaveBeenCalledWith({ key: 'bbc:foo' })
	})

	it('the cache key remains un-prefixed', () => {
		const adapter = new CapacitorSaveAdapter(new Map(), { prefix: 'bbc:' })
		adapter.set('foo', 'x')
		expect(adapter.get('foo')).toBe('x')
	})
})
