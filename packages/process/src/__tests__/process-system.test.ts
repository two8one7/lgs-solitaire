import { describe, it, expect, vi } from 'vitest'
import { createSubscriptions } from '@2817/subscriptions'
import { Process } from '../process'
import { ProcessSystem } from '../process-system'
import { ProcessState } from '../types'
import type { IProcess, IProcessManager } from '../types'

// Concrete test implementations
class TestProcess extends Process {
	readonly type = 'test'
}

class TestProcessSystem extends ProcessSystem<TestProcess> {
	readonly type = 'test'

	update(_dt: number): void {
		for (let i = this.processes.length - 1; i >= 0; --i) {
			const p = this.processes[i]
			switch (p.state) {
				case ProcessState.Idle:
					p.state = ProcessState.Running
					break
				case ProcessState.Running:
					p.state = ProcessState.Succeeded
					break
				case ProcessState.Succeeded:
					this.handleNextProcesses(p)
					this.removeAt(i)
					break
				case ProcessState.Failed:
				case ProcessState.Aborted:
					this.removeAt(i)
					break
			}
		}
	}
}

function createMockManager(): IProcessManager {
	return {
		add: vi.fn(),
		chain: vi.fn(() => null as unknown as IProcess),
		abort: vi.fn(),
		markFinished: vi.fn(),
		markFailed: vi.fn(),
		addSystem: vi.fn(),
		update: vi.fn(),
		destroy: vi.fn(),
	}
}

describe('Process', () => {
	it('starts in Idle state', () => {
		const p = new TestProcess()
		expect(p.state).toBe(ProcessState.Idle)
	})

	it('has null next by default', () => {
		const p = new TestProcess()
		expect(p.next).toBeNull()
	})

	it('addTo pushes abort cleanup to subscriptions', () => {
		const subs = createSubscriptions()
		const p = new TestProcess()
		p.state = ProcessState.Running

		p.addTo(subs)
		subs.unsubscribe()

		expect(p.state).toBe(ProcessState.Aborted)
	})

	it('addTo returns the process for chaining', () => {
		const subs = createSubscriptions()
		const p = new TestProcess()
		const result = p.addTo(subs)
		expect(result).toBe(p)
	})

	it('addTo with custom state sets that state on cleanup', () => {
		const subs = createSubscriptions()
		const p = new TestProcess()
		p.state = ProcessState.Running

		p.addTo(subs, ProcessState.Succeeded)
		subs.unsubscribe()

		expect(p.state).toBe(ProcessState.Succeeded)
	})
})

describe('ProcessSystem', () => {
	it('tracks count of processes', () => {
		const manager = createMockManager()
		const system = new TestProcessSystem(manager)
		expect(system.count).toBe(0)

		const p = new TestProcess()
		system.add(p)
		expect(system.count).toBe(1)
	})

	it('removeAt uses swap-and-pop (O(1))', () => {
		const manager = createMockManager()
		const system = new TestProcessSystem(manager)

		// Add 3 processes — all start Idle
		const p0 = new TestProcess()
		const p1 = new TestProcess()
		const p2 = new TestProcess()
		system.add(p0)
		system.add(p1)
		system.add(p2)

		// First update: Idle → Running
		system.update(0)
		expect(p0.state).toBe(ProcessState.Running)
		expect(p1.state).toBe(ProcessState.Running)
		expect(p2.state).toBe(ProcessState.Running)

		// Abort p0 — it should be removed via swap-and-pop
		p0.state = ProcessState.Aborted

		// Second update: p1,p2 Running → Succeeded, p0 removed
		system.update(0)
		expect(system.count).toBe(2) // p1 and p2 now Succeeded, p0 removed
		// p1 and p2 are succeeded, next update removes them
		system.update(0)
		expect(system.count).toBe(0)
	})

	it('handleNextProcesses adds next to manager on success', () => {
		const manager = createMockManager()
		const system = new TestProcessSystem(manager)

		const p0 = new TestProcess()
		const p1 = new TestProcess()
		p0.next = p1

		system.add(p0)

		// Idle → Running
		system.update(0)
		// Running → Succeeded
		system.update(0)
		// Succeeded → handleNext + remove
		system.update(0)

		expect(manager.add).toHaveBeenCalledWith(p1)
		expect(system.count).toBe(0)
	})

	it('handleNextProcesses does not add next when process failed', () => {
		const manager = createMockManager()
		const system = new TestProcessSystem(manager)

		const p0 = new TestProcess()
		const p1 = new TestProcess()
		p0.next = p1

		system.add(p0)

		// Idle → Running
		system.update(0)
		// Externally fail the process
		p0.state = ProcessState.Failed
		// Failed → remove (no handleNext)
		system.update(0)

		expect(manager.add).not.toHaveBeenCalled()
		expect(system.count).toBe(0)
	})

	it('handleNextProcesses does not add next when process aborted', () => {
		const manager = createMockManager()
		const system = new TestProcessSystem(manager)

		const p0 = new TestProcess()
		const p1 = new TestProcess()
		p0.next = p1

		system.add(p0)

		// Idle → Running
		system.update(0)
		p0.state = ProcessState.Aborted
		system.update(0)

		expect(manager.add).not.toHaveBeenCalled()
		expect(system.count).toBe(0)
	})

	it('destroy clears all processes', () => {
		const manager = createMockManager()
		const system = new TestProcessSystem(manager)

		system.add(new TestProcess())
		system.add(new TestProcess())
		system.add(new TestProcess())
		expect(system.count).toBe(3)

		system.destroy()
		expect(system.count).toBe(0)
	})
})
