/**
 * Contract tests for ISaveAdapter (web implementation).
 *
 * These tests OWN the contract: the local `ISaveAdapter` interface declared
 * here is the source of truth for the shape Sprint 1 must author in
 * `@2817/platform`. If Sprint 1's interface drifts, these tests catch it.
 *
 * Default-empty prefix means raw `localStorage` access with no key-mangling.
 * An explicit `prefix` constructor option namespaces keys when an app needs
 * to coexist with other consumers on the same origin.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createWebPlatform } from '../src/index'
import { WebSaveAdapter } from '../src/save'

interface ISaveAdapter {
	get(key: string): string | null
	set(key: string, value: string): boolean
	remove(key: string): void
	keys(): string[]
}

function getSave(): ISaveAdapter {
	const platform = createWebPlatform() as unknown as { save: ISaveAdapter }
	return platform.save
}

describe('ISaveAdapter (web)', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		localStorage.clear()
	})

	it('set then get round-trips a value', () => {
		const save = getSave()
		const ok = save.set('foo', 'bar')
		expect(ok).toBe(true)
		expect(save.get('foo')).toBe('bar')
	})

	it('get of missing key returns null (not undefined)', () => {
		const save = getSave()
		const value = save.get('does-not-exist')
		expect(value).toBeNull()
	})

	it('remove clears the value', () => {
		const save = getSave()
		save.set('k', 'v')
		save.remove('k')
		expect(save.get('k')).toBeNull()
	})

	it('keys() returns currently-saved keys', () => {
		const save = getSave()
		expect(save.keys()).toEqual([])
		save.set('a', '1')
		save.set('b', '2')
		expect([...save.keys()].sort()).toEqual(['a', 'b'])
	})

	it('values survive a fresh adapter instance against the same storage', () => {
		const first = getSave()
		first.set('persist', 'yes')

		const second = getSave()
		expect(second.get('persist')).toBe('yes')
	})

	it('keys() with default-empty prefix returns all localStorage keys (no filtering)', () => {
		localStorage.setItem('unrelated', 'x')
		const save = getSave()
		save.set('mine', '1')
		expect(save.keys().sort()).toEqual(['mine', 'unrelated'])
	})

	it('quota-exceeded is caught and returns false (does not throw)', () => {
		const save = getSave()
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			const err = new Error('QuotaExceededError') as Error & { name: string }
			err.name = 'QuotaExceededError'
			throw err
		})

		let result: boolean | undefined
		expect(() => {
			result = save.set('big', 'x')
		}).not.toThrow()
		expect(result).toBe(false)

		spy.mockRestore()
	})
})

describe('WebSaveAdapter with explicit prefix', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	afterEach(() => {
		localStorage.clear()
	})

	it('set writes to the prefixed key in localStorage', () => {
		const save = new WebSaveAdapter({ prefix: 'bbc:' })
		save.set('foo', 'bar')
		expect(localStorage.getItem('bbc:foo')).toBe('bar')
	})

	it('get reads from the prefixed key in localStorage', () => {
		localStorage.setItem('bbc:foo', 'x')
		const save = new WebSaveAdapter({ prefix: 'bbc:' })
		expect(save.get('foo')).toBe('x')
	})

	it('remove removes the prefixed key from localStorage', () => {
		localStorage.setItem('bbc:foo', 'x')
		const save = new WebSaveAdapter({ prefix: 'bbc:' })
		save.remove('foo')
		expect(localStorage.getItem('bbc:foo')).toBeNull()
	})

	it('keys() strips the prefix and filters non-prefixed keys', () => {
		localStorage.setItem('bbc:foo', '1')
		localStorage.setItem('bbc:bar', '2')
		localStorage.setItem('unrelated', 'x')
		const save = new WebSaveAdapter({ prefix: 'bbc:' })
		expect(save.keys().sort()).toEqual(['bar', 'foo'])
	})
})
