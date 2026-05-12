/**
 * Contract tests for ILifecycle (web implementation).
 *
 * Web variant bridges `document.visibilitychange` into `'foreground'` /
 * `'background'` events. `addListener` returns an unsubscribe function.
 *
 * RED today: `createWebPlatform()` throws.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createWebPlatform } from '../src/index'

type LifecycleEvent = 'foreground' | 'background'
interface ILifecycle {
	addListener(event: LifecycleEvent, cb: () => void): () => void
}

function getLifecycle(): ILifecycle {
	const platform = createWebPlatform() as unknown as { lifecycle: ILifecycle }
	return platform.lifecycle
}

function setVisibility(state: 'hidden' | 'visible') {
	Object.defineProperty(document, 'visibilityState', {
		value: state,
		configurable: true,
	})
}

function fireVisibilityChange() {
	document.dispatchEvent(new Event('visibilitychange'))
}

describe('ILifecycle (web)', () => {
	let originalVisibility: PropertyDescriptor | undefined

	beforeEach(() => {
		originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')
	})

	afterEach(() => {
		// Restore the original visibilityState descriptor (or delete the override).
		if (originalVisibility) {
			Object.defineProperty(document, 'visibilityState', originalVisibility)
		} else {
			// jsdom default is a getter on the prototype; deleting our own override
			// puts us back to that.
			delete (document as unknown as { visibilityState?: unknown }).visibilityState
		}
	})

	it('background listener fires on visibilitychange to hidden', () => {
		const lifecycle = getLifecycle()
		const cb = vi.fn()
		lifecycle.addListener('background', cb)

		setVisibility('hidden')
		fireVisibilityChange()

		expect(cb).toHaveBeenCalled()
	})

	it('foreground listener fires on visibilitychange to visible', () => {
		const lifecycle = getLifecycle()
		const cb = vi.fn()
		lifecycle.addListener('foreground', cb)

		setVisibility('visible')
		fireVisibilityChange()

		expect(cb).toHaveBeenCalled()
	})

	it('the unsubscribe function returned by addListener detaches the listener', () => {
		const lifecycle = getLifecycle()
		const cb = vi.fn()
		const unsubscribe = lifecycle.addListener('background', cb)

		unsubscribe()

		setVisibility('hidden')
		fireVisibilityChange()

		expect(cb).not.toHaveBeenCalled()
	})

	it('multiple listeners on the same event all fire', () => {
		const lifecycle = getLifecycle()
		const cb1 = vi.fn()
		const cb2 = vi.fn()
		lifecycle.addListener('background', cb1)
		lifecycle.addListener('background', cb2)

		setVisibility('hidden')
		fireVisibilityChange()

		expect(cb1).toHaveBeenCalled()
		expect(cb2).toHaveBeenCalled()
	})
})
