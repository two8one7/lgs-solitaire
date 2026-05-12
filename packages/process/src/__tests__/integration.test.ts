import { describe, it, expect, vi } from 'vitest'
import { createSubscriptions } from '@2817/subscriptions'
import { createProcessManager } from '../process-manager'
import { WaitForSeconds, WaitForSecondsSystem } from '../processes/wait-for-seconds'
import { ExecuteAction, ExecuteActionSystem } from '../processes/execute-action'
import { ExecuteActionInterval, ExecuteActionIntervalSystem } from '../processes/execute-action-interval'
import { WhenAll, WhenAllSystem } from '../processes/when-all'
import { WhenChain, WhenChainSystem } from '../processes/when-chain'
import { ProcessState } from '../types'

const DT = 1 / 60

function setupAll() {
	const manager = createProcessManager()
	manager.addSystem(new WaitForSecondsSystem(manager))
	manager.addSystem(new ExecuteActionSystem(manager))
	manager.addSystem(new ExecuteActionIntervalSystem(manager))
	manager.addSystem(new WhenAllSystem(manager))
	manager.addSystem(new WhenChainSystem(manager))
	return manager
}

describe('integration', () => {
	it('full chain: wait → action → wait → action', () => {
		const manager = setupAll()
		const calls: string[] = []

		const p1 = new WaitForSeconds(0)
		const p2 = new ExecuteAction(() => calls.push('first'))
		const p3 = new WaitForSeconds(0)
		const p4 = new ExecuteAction(() => calls.push('second'))

		manager.chain(p1, p2, p3, p4)

		// Run enough updates to complete the chain
		for (let i = 0; i < 20; ++i) {
			manager.update(DT)
		}

		expect(calls).toEqual(['first', 'second'])
		expect(p4.state).toBe(ProcessState.Succeeded)
	})

	it('addTo subscription cleanup aborts processes', () => {
		const manager = setupAll()
		const subs = createSubscriptions()

		const wait = new WaitForSeconds(10.0)
		wait.addTo(subs)
		manager.add(wait)

		// Idle → Running
		manager.update(DT)
		expect(wait.state).toBe(ProcessState.Running)

		// Cleanup via subscriptions
		subs.unsubscribe()
		expect(wait.state).toBe(ProcessState.Aborted)

		// Process gets removed on next update
		manager.update(DT)
	})

	it('WhenAll with mixed process types', () => {
		const manager = setupAll()
		const action = vi.fn()

		const wait = new WaitForSeconds(0)
		const exec = new ExecuteAction(action)
		const whenAll = new WhenAll(wait, exec)
		manager.add(whenAll)

		// Run until complete
		for (let i = 0; i < 10; ++i) {
			manager.update(DT)
		}

		expect(action).toHaveBeenCalledOnce()
		expect(whenAll.state).toBe(ProcessState.Succeeded)
	})

	it('WhenChain followed by WhenAll', () => {
		const manager = setupAll()
		const calls: string[] = []

		const sequential = new WhenChain(
			new ExecuteAction(() => calls.push('a')),
			new ExecuteAction(() => calls.push('b')),
		)

		const parallel = new WhenAll(
			new ExecuteAction(() => calls.push('c')),
			new ExecuteAction(() => calls.push('d')),
		)

		sequential.next = parallel

		manager.add(sequential)

		for (let i = 0; i < 20; ++i) {
			manager.update(DT)
		}

		expect(calls).toContain('a')
		expect(calls).toContain('b')
		expect(calls).toContain('c')
		expect(calls).toContain('d')
		// a before b (sequential), c and d after b (parallel after chain)
		expect(calls.indexOf('a')).toBeLessThan(calls.indexOf('b'))
		expect(calls.indexOf('b')).toBeLessThan(calls.indexOf('c'))
		expect(calls.indexOf('b')).toBeLessThan(calls.indexOf('d'))
	})

	it('nested WhenAll inside WhenChain', () => {
		const manager = setupAll()
		const calls: string[] = []

		const chain = new WhenChain(
			new WhenAll(
				new ExecuteAction(() => calls.push('parallel-1')),
				new ExecuteAction(() => calls.push('parallel-2')),
			),
			new ExecuteAction(() => calls.push('after')),
		)

		manager.add(chain)

		for (let i = 0; i < 20; ++i) {
			manager.update(DT)
		}

		expect(calls).toContain('parallel-1')
		expect(calls).toContain('parallel-2')
		expect(calls).toContain('after')
		expect(calls.indexOf('after')).toBeGreaterThan(calls.indexOf('parallel-1'))
		expect(calls.indexOf('after')).toBeGreaterThan(calls.indexOf('parallel-2'))
	})

	it('process manager destroy cleans everything', () => {
		const manager = setupAll()
		const action = vi.fn()

		manager.add(new WaitForSeconds(10.0))
		manager.add(new ExecuteActionInterval(action, 1.0))

		manager.update(DT)
		manager.destroy()

		// After destroy, update should do nothing (no systems)
		manager.update(DT)
		expect(action).not.toHaveBeenCalled()
	})

	it('pending queue works across multiple types', () => {
		const manager = createProcessManager()

		const wait = new WaitForSeconds(0)
		const action = new ExecuteAction(() => {})

		// Add before systems registered
		manager.add(wait, action)

		// Register systems
		manager.addSystem(new WaitForSecondsSystem(manager))
		manager.addSystem(new ExecuteActionSystem(manager))

		// Both should be picked up
		manager.update(DT)
		expect(wait.state).toBe(ProcessState.Running)
		expect(action.state).toBe(ProcessState.Succeeded)
	})
})
