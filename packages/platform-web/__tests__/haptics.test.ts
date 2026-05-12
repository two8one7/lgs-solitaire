/**
 * Contract tests for IHaptics (web implementation).
 *
 * The web variant is a no-op: it must accept every documented call without
 * throwing. Native platforms (Capacitor) will route the same calls to real
 * haptic APIs.
 *
 * RED today: `createWebPlatform()` throws, so even reaching `.haptics` fails.
 */
import { describe, it, expect } from 'vitest'
import { createWebPlatform } from '../src/index'

interface IHaptics {
	impact(style: 'light' | 'medium' | 'heavy'): void
	notification(type: 'success' | 'warning' | 'error'): void
	selection(): void
}

function getHaptics(): IHaptics {
	const platform = createWebPlatform() as unknown as { haptics: IHaptics }
	return platform.haptics
}

describe('IHaptics (web)', () => {
	it('impact() accepts light, medium, heavy without throwing', () => {
		const haptics = getHaptics()
		expect(() => haptics.impact('light')).not.toThrow()
		expect(() => haptics.impact('medium')).not.toThrow()
		expect(() => haptics.impact('heavy')).not.toThrow()
	})

	it('notification() accepts success, warning, error without throwing', () => {
		const haptics = getHaptics()
		expect(() => haptics.notification('success')).not.toThrow()
		expect(() => haptics.notification('warning')).not.toThrow()
		expect(() => haptics.notification('error')).not.toThrow()
	})

	it('selection() does not throw', () => {
		const haptics = getHaptics()
		expect(() => haptics.selection()).not.toThrow()
	})
})
