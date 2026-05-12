import { describe, it, expect, vi } from 'vitest'
import { createProcessManager } from '../process-manager'
import { ExecuteActionInterval, ExecuteActionIntervalSystem } from '../processes/execute-action-interval'
import { ProcessState } from '../types'

function setup(action: () => void, interval: number, opts?: { executeImmediately?: boolean; maxExecutions?: number }) {
	const manager = createProcessManager()
	const system = new ExecuteActionIntervalSystem(manager)
	manager.addSystem(system)
	const process = new ExecuteActionInterval(action, interval, opts?.executeImmediately)
	if (opts?.maxExecutions !== undefined) {
		process.withMaxExecutions(opts.maxExecutions)
	}
	manager.add(process)
	return { manager, system, process }
}

const DT = 1 / 60

describe('ExecuteActionInterval', () => {
	it('fires at interval', () => {
		const action = vi.fn()
		const { manager } = setup(action, 0.5)

		// Idle → Running
		manager.update(DT)
		expect(action).not.toHaveBeenCalled()

		// Accumulate just under 0.5s — 28 ticks = 28/60 ≈ 0.467
		for (let i = 0; i < 28; ++i) {
			manager.update(DT)
		}
		expect(action).not.toHaveBeenCalled()

		// 2 more ticks = 30/60 = 0.5s (may need 31 due to float precision)
		manager.update(DT)
		manager.update(DT)
		// At 31 Running ticks (31/60 ≈ 0.517), definitely >= 0.5
		manager.update(DT)
		expect(action).toHaveBeenCalledOnce()
	})

	it('fires repeatedly in unlimited mode', () => {
		const action = vi.fn()
		const { manager, process } = setup(action, 0.25)

		// Idle → Running
		manager.update(DT)

		// Use a big enough dt to cover the interval
		manager.update(0.26)
		expect(action).toHaveBeenCalledTimes(1)

		// Another interval
		manager.update(0.26)
		expect(action).toHaveBeenCalledTimes(2)
		expect(process.state).toBe(ProcessState.Running)
	})

	it('stops after maxExecutions', () => {
		const action = vi.fn()
		const { manager, process } = setup(action, 0.1, { maxExecutions: 2 })

		// Idle → Running
		manager.update(DT)

		// Exceed first interval
		manager.update(0.11)
		expect(action).toHaveBeenCalledTimes(1)

		// Exceed second interval
		manager.update(0.11)
		expect(action).toHaveBeenCalledTimes(2)
		expect(process.state).toBe(ProcessState.Succeeded)
	})

	it('executeImmediately fires on first update', () => {
		const action = vi.fn()
		const { manager } = setup(action, 1.0, { executeImmediately: true })

		// Idle → executeImmediately + Running
		manager.update(DT)
		expect(action).toHaveBeenCalledOnce()
	})

	it('executeImmediately with maxExecutions=1 succeeds immediately', () => {
		const action = vi.fn()
		const { manager, process } = setup(action, 1.0, { executeImmediately: true, maxExecutions: 1 })

		// Idle → action + Succeeded (maxExecutions reached)
		manager.update(DT)
		expect(action).toHaveBeenCalledOnce()
		expect(process.state).toBe(ProcessState.Succeeded)
	})

	it('accumulator wraps correctly', () => {
		const action = vi.fn()
		const { manager, process } = setup(action, 0.1)

		// Idle → Running
		manager.update(DT)

		// Big dt that covers one interval with remainder
		manager.update(0.15)
		expect(action).toHaveBeenCalledTimes(1)
		// accumulatedTime should be ~0.05 (0.15 - 0.1)
		expect(process.accumulatedTime).toBeCloseTo(0.05, 5)
	})

	it('abort stops execution', () => {
		const action = vi.fn()
		const { manager, system, process } = setup(action, 0.1)

		// Idle → Running
		manager.update(DT)
		process.state = ProcessState.Aborted
		manager.update(DT)

		expect(action).not.toHaveBeenCalled()
		expect(system.count).toBe(0)
	})
})
