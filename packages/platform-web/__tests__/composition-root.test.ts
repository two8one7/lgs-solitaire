/**
 * Smoke test for the composition-root shape.
 *
 * Validates that `createWebPlatform()` returns an object exposing
 * `name === 'web'` plus the three adapters (`save`, `haptics`, `lifecycle`)
 * with the expected method surface.
 *
 * RED today: `createWebPlatform()` throws, so every shape assertion fails
 * before it can run.
 */
import { describe, it, expect } from 'vitest'
import { createWebPlatform } from '../src/index'

describe('createWebPlatform', () => {
	it('returns an IPlatform with name="web" and the three adapters', () => {
		const platform = createWebPlatform()
		expect(platform.name).toBe('web')
		expect(typeof platform.save?.get).toBe('function')
		expect(typeof platform.save?.set).toBe('function')
		expect(typeof platform.save?.remove).toBe('function')
		expect(typeof platform.save?.keys).toBe('function')
		expect(typeof platform.haptics?.impact).toBe('function')
		expect(typeof platform.haptics?.notification).toBe('function')
		expect(typeof platform.haptics?.selection).toBe('function')
		expect(typeof platform.lifecycle?.addListener).toBe('function')
	})
})
