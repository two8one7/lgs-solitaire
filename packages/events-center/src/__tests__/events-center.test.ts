import { describe, it, expect, vi } from 'vitest'
import { createEventsCenter } from '../events-center'
import { createTypedId } from '../typed-id'
import { createSubscriptions } from '@2817/subscriptions'
import type { IEventData } from '../types'

const DT = 1 / 60

function updateFrames(ec: ReturnType<typeof createEventsCenter>, frames: number) {
	for (let i = 0; i < frames; i++) ec.update(DT)
}

interface CoinCollected extends IEventData {
	coins: number
}

interface EnemyKilled extends IEventData {
	enemy: string
}

function makeCoinEvent(coins: number): CoinCollected {
	return { id: CoinEvent, coins }
}

const CoinEvent = createTypedId<CoinCollected>()
const EnemyEvent = createTypedId<EnemyKilled>()

describe('createEventsCenter', () => {
	describe('addListener / dispatch', () => {
		it('delivers queued events during update', () => {
			const ec = createEventsCenter()
			const received: CoinCollected[] = []
			ec.addListener(CoinEvent, (data) => received.push(data))

			ec.dispatch(makeCoinEvent(5))
			expect(received).toHaveLength(0)

			ec.update(DT)
			expect(received).toHaveLength(1)
			expect(received[0].coins).toBe(5)
		})

		it('delivers immediate dispatch without update', () => {
			const ec = createEventsCenter()
			const received: CoinCollected[] = []
			ec.addListener(CoinEvent, (data) => received.push(data))

			ec.dispatch(makeCoinEvent(3), true)
			expect(received).toHaveLength(1)
			expect(received[0].coins).toBe(3)
		})

		it('delivers correct data to listener', () => {
			const ec = createEventsCenter()
			const received: CoinCollected[] = []
			ec.addListener(CoinEvent, (data) => received.push(data))

			const event = makeCoinEvent(42)
			ec.dispatch(event)
			ec.update(DT)
			expect(received[0]).toBe(event)
		})

		it('fires multiple listeners for same event', () => {
			const ec = createEventsCenter()
			const a = vi.fn()
			const b = vi.fn()
			ec.addListener(CoinEvent, a)
			ec.addListener(CoinEvent, b)

			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
			expect(a).toHaveBeenCalledOnce()
			expect(b).toHaveBeenCalledOnce()
		})

		it('keeps events independent', () => {
			const ec = createEventsCenter()
			const coinListener = vi.fn()
			const enemyListener = vi.fn()
			ec.addListener(CoinEvent, coinListener)
			ec.addListener(EnemyEvent, enemyListener)

			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
			expect(coinListener).toHaveBeenCalledOnce()
			expect(enemyListener).not.toHaveBeenCalled()
		})

		it('auto-creates listener array for unregistered events', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			// No explicit registration needed
			ec.addListener(CoinEvent, listener)
			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
			expect(listener).toHaveBeenCalledOnce()
		})

		it('returns Unsubscribe function', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			const unsub = ec.addListener(CoinEvent, listener)

			unsub()
			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
			expect(listener).not.toHaveBeenCalled()
		})

		it('no-ops dispatch for events with no listeners', () => {
			const ec = createEventsCenter()
			// Should not throw
			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
		})
	})

	describe('removeListener', () => {
		it('prevents future dispatch to removed listener', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			ec.addListener(CoinEvent, listener)

			ec.removeListener(CoinEvent, listener)
			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
			expect(listener).not.toHaveBeenCalled()
		})

		it('no-ops for unknown event id', () => {
			const ec = createEventsCenter()
			const unknownId = createTypedId<IEventData>()
			// Should not throw
			ec.removeListener(unknownId, vi.fn())
		})

		it('no-ops for listener not in list', () => {
			const ec = createEventsCenter()
			ec.addListener(CoinEvent, vi.fn())
			// Different function reference — should not throw
			ec.removeListener(CoinEvent, vi.fn())
		})

		it('Unsubscribe is idempotent', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			const unsub = ec.addListener(CoinEvent, listener)

			unsub()
			unsub() // second call should be no-op
			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
			expect(listener).not.toHaveBeenCalled()
		})
	})

	describe('deferred removal (Fix #1)', () => {
		it('defers removal during dispatch to end of frame', () => {
			const ec = createEventsCenter()
			const listenerA = vi.fn()
			const listenerB = vi.fn()
			ec.addListener(CoinEvent, listenerA)
			ec.addListener(CoinEvent, listenerB)

			// During dispatch, listener A removes listener B
			listenerA.mockImplementation(() => {
				ec.removeListener(CoinEvent, listenerB)
			})

			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)

			// Both should have fired this frame (removal deferred)
			expect(listenerA).toHaveBeenCalledOnce()
			expect(listenerB).toHaveBeenCalledOnce()

			// Next frame, B should not fire (removal applied)
			listenerA.mockClear()
			listenerB.mockClear()
			ec.dispatch(makeCoinEvent(2))
			ec.update(DT)
			expect(listenerA).toHaveBeenCalledOnce()
			expect(listenerB).not.toHaveBeenCalled()
		})

		it('handles self-removing listener', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			const unsub = ec.addListener(CoinEvent, listener)

			listener.mockImplementation(() => {
				unsub()
			})

			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
			expect(listener).toHaveBeenCalledOnce()

			// Should not fire on next update
			listener.mockClear()
			ec.dispatch(makeCoinEvent(2))
			ec.update(DT)
			expect(listener).not.toHaveBeenCalled()
		})

		it('drains pending removals after immediate dispatch', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			const unsub = ec.addListener(CoinEvent, listener)

			listener.mockImplementation(() => unsub())
			ec.dispatch(makeCoinEvent(1), true)
			expect(listener).toHaveBeenCalledOnce()

			// Removal was applied after immediate dispatch
			listener.mockClear()
			ec.dispatch(makeCoinEvent(2), true)
			expect(listener).not.toHaveBeenCalled()
		})
	})

	describe('double buffer (Fix #3)', () => {
		it('defers events from inside listeners to next frame', () => {
			const ec = createEventsCenter()
			const received: number[] = []

			ec.addListener(CoinEvent, (data) => {
				received.push(data.coins)
				if (data.coins === 1) {
					ec.dispatch(makeCoinEvent(2))
				}
			})

			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
			// Only event 1 should have been delivered this frame
			expect(received).toEqual([1])

			// Event 2 delivered next frame
			ec.update(DT)
			expect(received).toEqual([1, 2])
		})

		it('does not cause infinite loops', () => {
			const ec = createEventsCenter()
			let count = 0

			ec.addListener(CoinEvent, () => {
				count++
				// Always re-dispatch — would infinite loop without double buffering
				ec.dispatch(makeCoinEvent(count))
			})

			ec.dispatch(makeCoinEvent(0))
			ec.update(DT)
			expect(count).toBe(1)

			ec.update(DT)
			expect(count).toBe(2)

			ec.update(DT)
			expect(count).toBe(3)
		})

		it('handles multiple deferred events correctly', () => {
			const ec = createEventsCenter()
			const received: number[] = []

			ec.addListener(CoinEvent, (data) => {
				received.push(data.coins)
				if (data.coins === 0) {
					ec.dispatch(makeCoinEvent(1))
					ec.dispatch(makeCoinEvent(2))
				}
			})

			ec.dispatch(makeCoinEvent(0))
			ec.update(DT)
			expect(received).toEqual([0])

			ec.update(DT)
			expect(received).toEqual([0, 1, 2])
		})
	})

	describe('delayed dispatch', () => {
		it('fires after delay elapses', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			ec.addListener(CoinEvent, listener)

			ec.dispatchDelayed(makeCoinEvent(10), 30 * DT)

			// 15 frames — not yet
			updateFrames(ec, 15)
			expect(listener).not.toHaveBeenCalled()

			// 10 more (25 total) — still not
			updateFrames(ec, 10)
			expect(listener).not.toHaveBeenCalled()

			// 6 more (31 total, exceeds 30*DT accounting for fp)
			updateFrames(ec, 6)
			expect(listener).toHaveBeenCalledOnce()
			expect(listener).toHaveBeenCalledWith(expect.objectContaining({ coins: 10 }))
		})

		it('fires exactly once', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			ec.addListener(CoinEvent, listener)

			ec.dispatchDelayed(makeCoinEvent(1), 5 * DT)
			updateFrames(ec, 6)
			expect(listener).toHaveBeenCalledOnce()

			updateFrames(ec, 6)
			expect(listener).toHaveBeenCalledOnce() // still just once
		})

		it('handles multiple delayed events independently', () => {
			const ec = createEventsCenter()
			const received: number[] = []
			ec.addListener(CoinEvent, (data) => received.push(data.coins))

			ec.dispatchDelayed(makeCoinEvent(1), 5 * DT)
			ec.dispatchDelayed(makeCoinEvent(2), 15 * DT)
			ec.dispatchDelayed(makeCoinEvent(3), 10 * DT)

			// After 6 frames: first fires (delay 5*DT)
			updateFrames(ec, 6)
			expect(received).toEqual([1])

			// After 5 more (11 total): third fires (delay 10*DT)
			updateFrames(ec, 5)
			expect(received).toEqual([1, 3])

			// After 5 more (16 total): second fires (delay 15*DT)
			updateFrames(ec, 5)
			expect(received).toEqual([1, 3, 2])
		})

		it('swap-remove maintains integrity (Fix #2)', () => {
			const ec = createEventsCenter()
			const received: string[] = []
			ec.addListener(EnemyEvent, (data) => received.push(data.enemy))

			// Queue 5 delayed events with same delay
			for (let i = 0; i < 5; i++) {
				ec.dispatchDelayed({ id: EnemyEvent, enemy: `e${i}` }, 5 * DT)
			}

			updateFrames(ec, 6)
			// All 5 should fire, none lost to splice issues
			expect(received).toHaveLength(5)
			expect(received.sort()).toEqual(['e0', 'e1', 'e2', 'e3', 'e4'])
		})
	})

	describe('destroy', () => {
		it('clears all listeners', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			ec.addListener(CoinEvent, listener)

			ec.destroy()
			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
			expect(listener).not.toHaveBeenCalled()
		})

		it('clears queued dispatches', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			ec.addListener(CoinEvent, listener)
			ec.dispatch(makeCoinEvent(1))

			ec.destroy()
			ec.update(DT)
			expect(listener).not.toHaveBeenCalled()
		})

		it('clears delayed dispatches', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			ec.addListener(CoinEvent, listener)
			ec.dispatchDelayed(makeCoinEvent(1), 5 * DT)

			ec.destroy()
			updateFrames(ec, 6)
			expect(listener).not.toHaveBeenCalled()
		})
	})

	describe('integration', () => {
		it('full game-frame simulation', () => {
			const ec = createEventsCenter()
			const log: string[] = []

			ec.addListener(CoinEvent, (data) => {
				log.push(`coin:${data.coins}`)
			})
			ec.addListener(EnemyEvent, (data) => {
				log.push(`kill:${data.enemy}`)
				// Killing an enemy triggers a delayed coin bonus (~0.5s)
				ec.dispatchDelayed(makeCoinEvent(100), 30 * DT)
			})

			// Frame 1: systems dispatch events
			ec.dispatch(makeCoinEvent(1))
			ec.dispatch({ id: EnemyEvent, enemy: 'goomba' })
			ec.update(DT)
			expect(log).toEqual(['coin:1', 'kill:goomba'])

			// 31 more frames: delayed coin bonus fires (30*DT + 1 for fp)
			updateFrames(ec, 31)
			expect(log).toEqual(['coin:1', 'kill:goomba', 'coin:100'])
		})

		it('Unsubscribe.addTo works with createSubscriptions', () => {
			const ec = createEventsCenter()
			const subs = createSubscriptions()
			const listener = vi.fn()

			ec.addListener(CoinEvent, listener).addTo(subs)

			ec.dispatch(makeCoinEvent(1))
			ec.update(DT)
			expect(listener).toHaveBeenCalledOnce()

			subs.unsubscribe()

			listener.mockClear()
			ec.dispatch(makeCoinEvent(2))
			ec.update(DT)
			expect(listener).not.toHaveBeenCalled()
		})
	})

	describe('addWildcardListener', () => {
		it('fires for every dispatch regardless of event id', () => {
			const ec = createEventsCenter()
			const seen: IEventData[] = []
			ec.addWildcardListener((d) => seen.push(d))

			ec.dispatch(makeCoinEvent(5), true)
			ec.dispatch({ id: EnemyEvent, enemy: 'goomba' } as EnemyKilled, true)

			expect(seen).toHaveLength(2)
			expect(seen[0].id.value).toBe(CoinEvent.value)
			expect(seen[1].id.value).toBe(EnemyEvent.value)
		})

		it('fires AFTER per-id listeners for the same dispatch', () => {
			const ec = createEventsCenter()
			const order: string[] = []
			ec.addListener(CoinEvent, () => order.push('per-id'))
			ec.addWildcardListener(() => order.push('wildcard'))

			ec.dispatch(makeCoinEvent(1), true)
			expect(order).toEqual(['per-id', 'wildcard'])
		})

		it('returns an Unsubscribe; subsequent dispatches do not invoke', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			const unsub = ec.addWildcardListener(listener)

			ec.dispatch(makeCoinEvent(1), true)
			expect(listener).toHaveBeenCalledTimes(1)

			unsub()
			ec.dispatch(makeCoinEvent(2), true)
			expect(listener).toHaveBeenCalledTimes(1)
		})

		it('fires during queued + delayed updates, not just immediate', () => {
			const ec = createEventsCenter()
			const listener = vi.fn()
			ec.addWildcardListener(listener)

			ec.dispatch(makeCoinEvent(1)) // queued
			expect(listener).toHaveBeenCalledTimes(0)
			ec.update(DT)
			expect(listener).toHaveBeenCalledTimes(1)

			ec.dispatchDelayed(makeCoinEvent(2), 0) // delayed, fires next update
			ec.update(DT)
			expect(listener).toHaveBeenCalledTimes(2)
		})
	})
})
