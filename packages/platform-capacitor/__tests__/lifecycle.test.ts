/**
 * Contract tests for CapacitorLifecycleAdapter (native implementation).
 *
 * The adapter registers a single 'appStateChange' listener with @capacitor/app
 * on construction and dispatches { isActive: true } -> 'foreground' listeners,
 * { isActive: false } -> 'background' listeners.
 *
 * RED today: ../src/lifecycle does not exist. Tests go GREEN once Sprint 1
 * lands the real CapacitorLifecycleAdapter class.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

let stateChangeCallback: ((s: { isActive: boolean }) => void) | null = null

vi.mock('@capacitor/app', () => ({
	App: {
		addListener: vi.fn().mockImplementation((event: string, cb: (s: { isActive: boolean }) => void) => {
			if (event === 'appStateChange') stateChangeCallback = cb
			return Promise.resolve({ remove: vi.fn().mockResolvedValue(undefined) })
		}),
	},
}))

import { App } from '@capacitor/app'
import { CapacitorLifecycleAdapter } from '../src/lifecycle'

describe('CapacitorLifecycleAdapter', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		stateChangeCallback = null
	})

	it('constructor registers a single appStateChange listener with App', () => {
		new CapacitorLifecycleAdapter()
		expect(App.addListener).toHaveBeenCalledTimes(1)
		expect(App.addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function))
	})

	it('isActive: true fires foreground listeners', () => {
		const lifecycle = new CapacitorLifecycleAdapter()
		const cb = vi.fn()
		lifecycle.addListener('foreground', cb)
		stateChangeCallback?.({ isActive: true })
		expect(cb).toHaveBeenCalledTimes(1)
	})

	it('isActive: false fires background listeners', () => {
		const lifecycle = new CapacitorLifecycleAdapter()
		const cb = vi.fn()
		lifecycle.addListener('background', cb)
		stateChangeCallback?.({ isActive: false })
		expect(cb).toHaveBeenCalledTimes(1)
	})

	it('isActive: true does NOT fire background listeners', () => {
		const lifecycle = new CapacitorLifecycleAdapter()
		const fg = vi.fn()
		const bg = vi.fn()
		lifecycle.addListener('foreground', fg)
		lifecycle.addListener('background', bg)
		stateChangeCallback?.({ isActive: true })
		expect(fg).toHaveBeenCalledTimes(1)
		expect(bg).not.toHaveBeenCalled()
	})

	it('the unsubscribe function returned by addListener detaches the listener', () => {
		const lifecycle = new CapacitorLifecycleAdapter()
		const cb = vi.fn()
		const unsub = lifecycle.addListener('foreground', cb)
		unsub()
		stateChangeCallback?.({ isActive: true })
		expect(cb).not.toHaveBeenCalled()
	})

	it('multiple listeners on the same event all fire', () => {
		const lifecycle = new CapacitorLifecycleAdapter()
		const a = vi.fn()
		const b = vi.fn()
		lifecycle.addListener('foreground', a)
		lifecycle.addListener('foreground', b)
		stateChangeCallback?.({ isActive: true })
		expect(a).toHaveBeenCalledTimes(1)
		expect(b).toHaveBeenCalledTimes(1)
	})
})
