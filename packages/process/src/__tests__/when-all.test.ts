import { describe, it, expect, vi } from 'vitest'
import { createProcessManager } from '../process-manager'
import { WaitForSeconds, WaitForSecondsSystem } from '../processes/wait-for-seconds'
import { ExecuteAction, ExecuteActionSystem } from '../processes/execute-action'
import { WhenAll, WhenAllSystem } from '../processes/when-all'
import { ProcessState } from '../types'

const DT = 1 / 60

function setup() {
	const manager = createProcessManager()
	manager.addSystem(new WaitForSecondsSystem(manager))
	manager.addSystem(new ExecuteActionSystem(manager))
	manager.addSystem(new WhenAllSystem(manager))
	return manager
}

describe('WhenAll', () => {
	it('succeeds when all children succeed', () => {
		const manager = setup()
		const action1 = vi.fn()
		const action2 = vi.fn()
		const c1 = new ExecuteAction(action1)
		const c2 = new ExecuteAction(action2)
		const whenAll = new WhenAll(c1, c2)
		manager.add(whenAll)

		// Idle → add children + Running
		manager.update(DT)
		expect(whenAll.state).toBe(ProcessState.Running)

		// Children: Idle → Succeeded
		manager.update(DT)
		expect(action1).toHaveBeenCalledOnce()
		expect(action2).toHaveBeenCalledOnce()

		// WhenAll sees all children Succeeded → Succeeded
		manager.update(DT)
		expect(whenAll.state).toBe(ProcessState.Succeeded)
	})

	it('fails and aborts remaining children when one child fails', () => {
		const manager = setup()
		const c1 = new WaitForSeconds(0.5)
		const c2 = new WaitForSeconds(1.0)
		const whenAll = new WhenAll(c1, c2)
		manager.add(whenAll)

		// Idle → add children + Running
		manager.update(DT)
		// Children: Idle → Running
		manager.update(DT)

		// Fail c1 externally
		c1.state = ProcessState.Failed

		// WhenAll sees failure → abort c2, WhenAll fails
		manager.update(DT)
		expect(whenAll.state).toBe(ProcessState.Failed)
		expect(c2.state).toBe(ProcessState.Aborted)
	})

	it('fails when a child is aborted', () => {
		const manager = setup()
		const c1 = new WaitForSeconds(0.5)
		const c2 = new WaitForSeconds(1.0)
		const whenAll = new WhenAll(c1, c2)
		manager.add(whenAll)

		// Idle → Running
		manager.update(DT)
		// Children: Idle → Running
		manager.update(DT)

		// Abort c1
		c1.state = ProcessState.Aborted
		manager.update(DT)

		expect(whenAll.state).toBe(ProcessState.Failed)
		expect(c2.state).toBe(ProcessState.Aborted)
	})

	it('chains on success', () => {
		const manager = setup()
		const action = vi.fn()
		const c1 = new ExecuteAction(() => {})
		const whenAll = new WhenAll(c1)
		const next = new ExecuteAction(action)
		whenAll.next = next
		manager.add(whenAll)

		// Idle → Running (add children)
		manager.update(DT)
		// c1: Idle → Succeeded
		manager.update(DT)
		// WhenAll: all done → Succeeded
		manager.update(DT)
		// WhenAll: Succeeded → handleNext + remove
		manager.update(DT)
		// next: Idle → Succeeded
		manager.update(DT)

		expect(action).toHaveBeenCalledOnce()
	})

	it('does not chain on failure', () => {
		const manager = setup()
		const action = vi.fn()
		const c1 = new WaitForSeconds(1.0)
		const whenAll = new WhenAll(c1)
		const next = new ExecuteAction(action)
		whenAll.next = next
		manager.add(whenAll)

		// Idle → Running
		manager.update(DT)
		// Children: Idle → Running
		manager.update(DT)

		c1.state = ProcessState.Failed
		// WhenAll: sees failure → Failed
		manager.update(DT)
		// WhenAll: Failed → removed (no handleNext)
		manager.update(DT)

		expect(action).not.toHaveBeenCalled()
	})
})
