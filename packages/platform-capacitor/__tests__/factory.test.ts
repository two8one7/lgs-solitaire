/**
 * Smoke tests for the async createCapacitorPlatform() factory.
 *
 * Hydration contract: on construction the factory loads ALL Preferences keys
 * by default (empty prefix) and seeds the save adapter's cache verbatim. An
 * explicit `prefix` option filters Preferences keys to those that begin with
 * the prefix, and strips the prefix from the cached key.
 * Capacitor.getPlatform() decides whether name is 'capacitor-ios' or
 * 'capacitor-android'.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@capacitor/preferences', () => ({
	Preferences: {
		keys: vi.fn().mockResolvedValue({ keys: ['hello', 'world'] }),
		get: vi.fn().mockImplementation(({ key }: { key: string }) => {
			if (key === 'hello') return Promise.resolve({ value: 'h' })
			if (key === 'world') return Promise.resolve({ value: 'w' })
			return Promise.resolve({ value: null })
		}),
		set: vi.fn().mockResolvedValue(undefined),
		remove: vi.fn().mockResolvedValue(undefined),
	},
}))
vi.mock('@capacitor/haptics', () => ({
	Haptics: {
		impact: vi.fn(),
		notification: vi.fn(),
		selectionStart: vi.fn(),
		selectionEnd: vi.fn(),
	},
	ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
	NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}))
vi.mock('@capacitor/app', () => ({
	App: {
		addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
	},
}))
vi.mock('@capacitor/core', () => ({
	Capacitor: {
		getPlatform: vi.fn().mockReturnValue('ios'),
	},
}))

import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import { createCapacitorPlatform } from '../src/index'

describe('createCapacitorPlatform()', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		;(Capacitor.getPlatform as ReturnType<typeof vi.fn>).mockReturnValue('ios')
		;(Preferences.keys as ReturnType<typeof vi.fn>).mockResolvedValue({
			keys: ['hello', 'world'],
		})
		;(Preferences.get as ReturnType<typeof vi.fn>).mockImplementation(({ key }: { key: string }) => {
			if (key === 'hello') return Promise.resolve({ value: 'h' })
			if (key === 'world') return Promise.resolve({ value: 'w' })
			return Promise.resolve({ value: null })
		})
	})

	it('returns an IPlatform with name, save, haptics, lifecycle', async () => {
		const platform = await createCapacitorPlatform()
		expect(platform.name).toBeDefined()
		expect(platform.save).toBeDefined()
		expect(platform.haptics).toBeDefined()
		expect(platform.lifecycle).toBeDefined()
	})

	it('name === "capacitor-ios" when Capacitor.getPlatform() returns "ios"', async () => {
		;(Capacitor.getPlatform as ReturnType<typeof vi.fn>).mockReturnValue('ios')
		const platform = await createCapacitorPlatform()
		expect(platform.name).toBe('capacitor-ios')
	})

	it('name === "capacitor-android" when Capacitor.getPlatform() returns "android"', async () => {
		;(Capacitor.getPlatform as ReturnType<typeof vi.fn>).mockReturnValue('android')
		const platform = await createCapacitorPlatform()
		expect(platform.name).toBe('capacitor-android')
	})

	it('save adapter is hydrated with all Preferences keys under default-empty prefix', async () => {
		const platform = await createCapacitorPlatform()
		expect(platform.save.keys().sort()).toEqual(['hello', 'world'])
	})

	it('Preferences.keys and Preferences.get are called during construction', async () => {
		await createCapacitorPlatform()
		expect(Preferences.keys).toHaveBeenCalled()
		expect(Preferences.get).toHaveBeenCalled()
	})

	it('createCapacitorPlatform({ prefix: "bbc:" }) filters Preferences keys and strips the prefix during hydration', async () => {
		;(Preferences.keys as ReturnType<typeof vi.fn>).mockResolvedValue({
			keys: ['bbc:hello', 'bbc:world', 'unrelated'],
		})
		;(Preferences.get as ReturnType<typeof vi.fn>).mockImplementation(({ key }: { key: string }) => {
			if (key === 'bbc:hello') return Promise.resolve({ value: 'h' })
			if (key === 'bbc:world') return Promise.resolve({ value: 'w' })
			return Promise.resolve({ value: null })
		})

		const platform = await createCapacitorPlatform({ prefix: 'bbc:' })
		expect(platform.save.keys().sort()).toEqual(['hello', 'world'])
	})
})
