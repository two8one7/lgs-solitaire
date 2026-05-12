import { describe, it, expect, vi } from 'vitest'
import { createProcessManager } from '../process-manager'
import { ExecuteAction, ExecuteActionSystem } from '../processes/execute-action'
import { WaitForSeconds, WaitForSecondsSystem } from '../processes/wait-for-seconds'
import { WhenChain, WhenChainSystem } from '../processes/when-chain'
import { ProcessState } from '../types'

const DT = 1 / 60

function setup() {
	const manager = createProcessManager()
	manager.addSystem(new ExecuteActionSystem(manager))
	manager.addSystem(new WaitForSecondsSystem(manager))
	manager.addSystem(new WhenChainSystem(manager))
	return manager
}

describe('WhenChain', () => {
	it('succeeds when all children complete in sequence', () => {
		const manager = setup()
		const calls: number[] = []
		const c1 = new ExecuteAction(() => calls.push(1))
		const c2 = new ExecuteAction(() => calls.push(2))
		const c3 = new ExecuteAction(() => calls.push(3))
		const chain = new WhenChain(c1, c2, c3)
		manager.add(chain)

		// Run enough updates for the full chain to complete
		for (let i = 0; i < 20; ++i) {
			manager.update(DT)
		}

		expect(calls).toEqual([1, 2, 3])
		expect(chain.state).toBe(ProcessState.Succeeded)
	})

	it('children execute in order', () => {
		const manager = setup()
		const calls: string[] = []
		const c1 = new ExecuteAction(() => calls.push('a'))
		const c2 = new ExecuteAction(() => calls.push('b'))
		const chain = new WhenChain(c1, c2)
		manager.add(chain)

		for (let i = 0; i < 20; ++i) {
			manager.update(DT)
		}

		expect(calls).toEqual(['a', 'b'])
	})

	it('empty children succeeds immediately', () => {
		const manager = setup()
		const chain = new WhenChain()
		manager.add(chain)

		// Idle → Succeeded (empty)
		manager.update(DT)
		expect(chain.state).toBe(ProcessState.Succeeded)
	})

	it('fails when a child fails', () => {
		const manager = setup()
		const c1 = new WaitForSeconds(1.0)
		const c2 = new ExecuteAction(() => {})
		const chain = new WhenChain(c1, c2)
		manager.add(chain)

		// Idle → chain children + Running
		manager.update(DT)
		// c1: Idle → Running
		manager.update(DT)

		// Fail c1
		c1.state = ProcessState.Failed

		// WhenChain walks chain, sees c1 failed
		manager.update(DT)
		expect(chain.state).toBe(ProcessState.Failed)
	})

	it('propagates abort state', () => {
		const manager = setup()
		const c1 = new WaitForSeconds(1.0)
		const chain = new WhenChain(c1)
		manager.add(chain)

		// Idle → chain + Running
		manager.update(DT)
		// c1: Idle → Running
		manager.update(DT)

		c1.state = ProcessState.Aborted
		manager.update(DT)
		expect(chain.state).toBe(ProcessState.Aborted)
	})

	it('chains on success (WhenChain.next)', () => {
		const manager = setup()
		const finalAction = vi.fn()
		const c1 = new ExecuteAction(() => {})
		const chain = new WhenChain(c1)
		const next = new ExecuteAction(finalAction)
		chain.next = next
		manager.add(chain)

		for (let i = 0; i < 20; ++i) {
			manager.update(DT)
		}

		expect(finalAction).toHaveBeenCalledOnce()
	})
})
