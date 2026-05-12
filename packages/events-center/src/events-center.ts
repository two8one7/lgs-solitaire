import { createUnsubscribe } from '@2817/subscriptions'
import type { Unsubscribe } from '@2817/subscriptions'
import type { IEventData, Listener, IEventsCenter, WildcardListener } from './types'
import type { TypedId } from './typed-id'

interface PendingRemoval {
	eventId: string
	listener: Listener
}

interface DelayedEntry {
	data: IEventData
	accumulatedDelay: number
	delay: number
}

/**
 * Queued event dispatcher with double-buffering and delayed events.
 *
 * Per-frame flow:
 * 1. Systems dispatch events → queued in `queuedDispatches`
 * 2. `update(dt)` drains the queue, firing listeners
 * 3. Events dispatched by listeners go into `queuedDuringUpdate` (next frame)
 * 4. Swap buffers so deferred events become next frame's queue
 * 5. Process delayed events (accumulate dt, fire when timer expires)
 * 6. Drain pending listener removals
 */
export function createEventsCenter(): IEventsCenter {
	const events: Record<string, Listener[]> = {}
	const wildcardListeners: WildcardListener[] = []
	let queuedDispatches: IEventData[] = []
	let queuedDuringUpdate: IEventData[] = []
	const delayedDispatches: DelayedEntry[] = []
	const pendingRemovals: PendingRemoval[] = []
	let isUpdating = false

	function addListener<T extends IEventData>(
		eventId: TypedId<T>,
		listener: Listener<T>,
	): Unsubscribe {
		const key = eventId.value
		if (!events[key]) {
			events[key] = []
		}
		events[key].push(listener as Listener)
		return createUnsubscribe(() => {
			removeListener(eventId, listener)
		})
	}

	function removeListener<T extends IEventData>(
		eventId: TypedId<T>,
		listener: Listener<T>,
	): void {
		// Fix #1: Defer removals during dispatch to avoid splice-during-iteration
		if (isUpdating) {
			pendingRemovals.push({ eventId: eventId.value, listener: listener as Listener })
			return
		}

		const listeners = events[eventId.value]
		if (!listeners) return

		const idx = listeners.indexOf(listener as Listener)
		if (idx < 0) return

		// Swap-and-pop for O(1) removal
		const last = listeners.length - 1
		if (idx !== last) listeners[idx] = listeners[last]
		listeners.pop()
	}

	/**
	 * Queue an event for dispatch during the next `update()`, or fire immediately.
	 *
	 * For high-frequency events, pre-allocate and reuse event data objects:
	 * ```ts
	 * const damageData = { id: DamageEvent, amount: 0, target: null! }
	 * // Each frame, mutate and dispatch:
	 * damageData.amount = 10
	 * damageData.target = enemy
	 * eventsCenter.dispatch(damageData)
	 * ```
	 */
	function dispatch<T extends IEventData>(data: T, immediate = false): void {
		if (immediate) {
			isUpdating = true
			fireListeners(data)
			drainPendingRemovals()
			isUpdating = false
			return
		}

		if (isUpdating) {
			queuedDuringUpdate.push(data)
			return
		}

		queuedDispatches.push(data)
	}

	function dispatchDelayed<T extends IEventData>(data: T, delay: number): void {
		delayedDispatches.push({ data, accumulatedDelay: 0, delay })
	}

	function update(dt: number): void {
		isUpdating = true

		// Drain queued dispatches
		const len = queuedDispatches.length
		for (let i = 0; i < len; i++) {
			fireListeners(queuedDispatches[i])
		}
		queuedDispatches.length = 0

		// Fix #3: Swap references instead of element-by-element copy
		const temp = queuedDispatches
		queuedDispatches = queuedDuringUpdate
		queuedDuringUpdate = temp

		// Fix #2: Swap-remove for delayed dispatches (backward iteration, O(1) per removal)
		for (let i = delayedDispatches.length - 1; i >= 0; i--) {
			const entry = delayedDispatches[i]
			entry.accumulatedDelay += dt
			if (entry.accumulatedDelay >= entry.delay) {
				fireListeners(entry.data)
				// Swap-and-pop
				const last = delayedDispatches.length - 1
				if (i !== last) delayedDispatches[i] = delayedDispatches[last]
				delayedDispatches.pop()
			}
		}

		isUpdating = false

		// Fix #1: Drain deferred removals after dispatch is complete
		drainPendingRemovals()
	}

	function fireListeners(data: IEventData): void {
		const listeners = events[data.id.value]
		if (listeners) {
			const len = listeners.length
			for (let i = len - 1; i >= 0; i--) {
				listeners[i](data)
			}
		}

		// Wildcard listeners fire AFTER per-id listeners so per-id consumers
		// see events at the same time as observers (no surprise re-ordering).
		// Iterate forward so listeners added during a fire are not visited
		// in the same pass (we snapshot length).
		const wlen = wildcardListeners.length
		for (let i = 0; i < wlen; i++) {
			wildcardListeners[i](data)
		}
	}

	function drainPendingRemovals(): void {
		const len = pendingRemovals.length
		for (let i = 0; i < len; i++) {
			const removal = pendingRemovals[i]
			const listeners = events[removal.eventId]
			if (!listeners) continue

			const idx = listeners.indexOf(removal.listener)
			if (idx < 0) continue

			const last = listeners.length - 1
			if (idx !== last) listeners[idx] = listeners[last]
			listeners.pop()
		}
		pendingRemovals.length = 0
	}

	function destroy(): void {
		for (const key in events) {
			delete events[key]
		}
		wildcardListeners.length = 0
		queuedDispatches.length = 0
		queuedDuringUpdate.length = 0
		delayedDispatches.length = 0
		pendingRemovals.length = 0
	}

	function addWildcardListener(listener: WildcardListener): Unsubscribe {
		wildcardListeners.push(listener)
		return createUnsubscribe(() => {
			const idx = wildcardListeners.indexOf(listener)
			if (idx < 0) return
			const last = wildcardListeners.length - 1
			if (idx !== last) wildcardListeners[idx] = wildcardListeners[last]
			wildcardListeners.pop()
		})
	}

	return {
		addListener,
		removeListener,
		addWildcardListener,
		dispatch,
		dispatchDelayed,
		update,
		destroy,
	}
}
