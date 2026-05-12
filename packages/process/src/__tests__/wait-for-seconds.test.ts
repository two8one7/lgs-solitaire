import { describe, it, expect } from 'vitest'
import { createProcessManager } from '../process-manager'
import { WaitForSeconds, WaitForSecondsSystem } from '../processes/wait-for-seconds'
import { ProcessState } from '../types'

const DT = 1 / 60

function setup(duration: number) {
	const manager = createProcessManager()
	const system = new WaitForSecondsSystem(manager)
	manager.addSystem(system)
	const process = new WaitForSeconds(duration)
	manager.add(process)
	return { manager, system, process }
}

describe('WaitForSeconds', () => {
	it('completes after duration elapses', () => {
		const { manager, system, process } = setup(1.0)

		// Idle → Running
		manager.update(DT)
		expect(process.state).toBe(ProcessState.Running)

		// Accumulate time
		for (let i = 0; i < 59; ++i) {
			manager.update(DT)
		}
		expect(process.state).toBe(ProcessState.Running)

		// One more tick should push over 1.0s
		manager.update(DT)
		expect(process.state).toBe(ProcessState.Succeeded)

		// Succeeded → removed
		manager.update(DT)
		expect(system.count).toBe(0)
	})

	it('does not complete early', () => {
		const { manager, process } = setup(0.5)

		// Idle → Running
		manager.update(DT)

		// Accumulate 0.4s — not enough
		for (let i = 0; i < 23; ++i) {
			manager.update(DT)
		}
		expect(process.state).toBe(ProcessState.Running)
		expect(process.accumulatedTime).toBeLessThan(0.5)
	})

	it('chains on success', () => {
		const { manager, system } = setup(0.0)
		const next = new WaitForSeconds(1.0)
		system['processes'][0].next = next

		// Idle → Running
		manager.update(DT)
		// Running → Succeeded (0 duration)
		manager.update(DT)
		// Succeeded → handleNext + remove
		manager.update(DT)

		// next should now be in the system
		expect(system.count).toBe(1)
		expect(next.state).toBe(ProcessState.Idle)
	})

	it('handles abort', () => {
		const { manager, system, process } = setup(1.0)

		// Idle → Running
		manager.update(DT)
		expect(process.state).toBe(ProcessState.Running)

		// Abort externally
		process.state = ProcessState.Aborted
		manager.update(DT)
		expect(system.count).toBe(0)
	})

	it('handles zero duration', () => {
		const { manager, system, process } = setup(0)

		// Idle → Running
		manager.update(DT)
		// Running: accumulatedTime (1/60) >= 0 → Succeeded
		manager.update(DT)
		expect(process.state).toBe(ProcessState.Succeeded)

		// Succeeded → removed
		manager.update(DT)
		expect(system.count).toBe(0)
	})
})
