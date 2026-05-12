import { describe, it, expect, vi } from 'vitest'
import { createProcessManager } from '../process-manager'
import { ExecuteAction, ExecuteActionSystem } from '../processes/execute-action'
import { ProcessState } from '../types'

const DT = 1 / 60

function setup(action: () => void) {
	const manager = createProcessManager()
	const system = new ExecuteActionSystem(manager)
	manager.addSystem(system)
	const process = new ExecuteAction(action)
	manager.add(process)
	return { manager, system, process }
}

describe('ExecuteAction', () => {
	it('fires action on first update', () => {
		const action = vi.fn()
		const { manager, process } = setup(action)

		// Idle → action() + Succeeded
		manager.update(DT)
		expect(action).toHaveBeenCalledOnce()
		expect(process.state).toBe(ProcessState.Succeeded)
	})

	it('removes after succeeding', () => {
		const action = vi.fn()
		const { manager, system } = setup(action)

		// Idle → Succeeded
		manager.update(DT)
		// Succeeded → removed
		manager.update(DT)
		expect(system.count).toBe(0)
	})

	it('chains on success', () => {
		const action1 = vi.fn()
		const action2 = vi.fn()
		const { manager, system } = setup(action1)

		const next = new ExecuteAction(action2)
		system['processes'][0].next = next

		// Idle → Succeeded
		manager.update(DT)
		// Succeeded → handleNext + remove
		manager.update(DT)

		expect(system.count).toBe(1)
		expect(action2).not.toHaveBeenCalled()

		// next: Idle → Succeeded
		manager.update(DT)
		expect(action2).toHaveBeenCalledOnce()
	})

	it('abort prevents execution', () => {
		const action = vi.fn()
		const { manager, system, process } = setup(action)

		process.state = ProcessState.Aborted
		manager.update(DT)

		expect(action).not.toHaveBeenCalled()
		expect(system.count).toBe(0)
	})

	it('action fires only once', () => {
		const action = vi.fn()
		const { manager } = setup(action)

		manager.update(DT)
		manager.update(DT)
		manager.update(DT)

		expect(action).toHaveBeenCalledOnce()
	})
})
