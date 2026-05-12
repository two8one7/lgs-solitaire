import { describe, it, expect, vi } from 'vitest'
import { createProcessManager } from '../process-manager'
import { Process } from '../process'
import { ProcessSystem } from '../process-system'
import { ProcessState } from '../types'
import type { IProcessManager } from '../types'

const DT = 1 / 60

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

class OtherProcess extends Process {
	readonly type = 'other'
}

class OtherProcessSystem extends ProcessSystem<OtherProcess> {
	readonly type = 'other'

	update(_dt: number): void {
		for (let i = this.processes.length - 1; i >= 0; --i) {
			const p = this.processes[i]
			switch (p.state) {
				case ProcessState.Idle:
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

describe('createProcessManager', () => {
	it('dispatches processes to correct system by type', () => {
		const manager = createProcessManager()
		const testSystem = new TestProcessSystem(manager)
		const otherSystem = new OtherProcessSystem(manager)
		manager.addSystem(testSystem)
		manager.addSystem(otherSystem)

		manager.add(new TestProcess())
		manager.add(new OtherProcess())

		expect(testSystem.count).toBe(1)
		expect(otherSystem.count).toBe(1)
	})

	it('queues processes added before system registration', () => {
		const manager = createProcessManager()
		const p = new TestProcess()
		manager.add(p)

		const system = new TestProcessSystem(manager)
		manager.addSystem(system)

		expect(system.count).toBe(1)
	})

	it('drains pending queue on addSystem', () => {
		const manager = createProcessManager()
		const p1 = new TestProcess()
		const p2 = new TestProcess()
		manager.add(p1, p2)

		const system = new TestProcessSystem(manager)
		manager.addSystem(system)

		expect(system.count).toBe(2)
	})

	it('chain links processes via .next and adds first', () => {
		const manager = createProcessManager()
		const system = new TestProcessSystem(manager)
		manager.addSystem(system)

		const p0 = new TestProcess()
		const p1 = new TestProcess()
		const p2 = new TestProcess()

		const result = manager.chain(p0, p1, p2)

		expect(result).toBe(p0)
		expect(p0.next).toBe(p1)
		expect(p1.next).toBe(p2)
		expect(p2.next).toBeNull()
		expect(system.count).toBe(1) // only first added
	})

	it('update calls all systems', () => {
		const manager = createProcessManager()
		const system1 = new TestProcessSystem(manager)
		const system2 = new OtherProcessSystem(manager)
		manager.addSystem(system1)
		manager.addSystem(system2)

		const p1 = new TestProcess()
		const p2 = new OtherProcess()
		manager.add(p1, p2)

		manager.update(DT)

		// TestProcessSystem: Idle → Running
		expect(p1.state).toBe(ProcessState.Running)
		// OtherProcessSystem: Idle → Succeeded
		expect(p2.state).toBe(ProcessState.Succeeded)
	})

	it('destroy calls destroy on all systems', () => {
		const manager = createProcessManager()
		const system = new TestProcessSystem(manager)
		manager.addSystem(system)

		manager.add(new TestProcess())
		manager.add(new TestProcess())
		expect(system.count).toBe(2)

		manager.destroy()
		expect(system.count).toBe(0)
	})

	it('abort sets process state to Aborted', () => {
		const manager = createProcessManager()
		const p = new TestProcess()
		p.state = ProcessState.Running
		manager.abort(p)
		expect(p.state).toBe(ProcessState.Aborted)
	})

	it('markFinished sets process state to Succeeded', () => {
		const manager = createProcessManager()
		const p = new TestProcess()
		p.state = ProcessState.Running
		manager.markFinished(p)
		expect(p.state).toBe(ProcessState.Succeeded)
	})

	it('markFailed sets process state to Failed', () => {
		const manager = createProcessManager()
		const p = new TestProcess()
		p.state = ProcessState.Running
		manager.markFailed(p)
		expect(p.state).toBe(ProcessState.Failed)
	})

	it('aborted process is removed on next update', () => {
		const manager = createProcessManager()
		const system = new TestProcessSystem(manager)
		manager.addSystem(system)

		const p = new TestProcess()
		manager.add(p)

		// Idle → Running
		manager.update(DT)
		expect(p.state).toBe(ProcessState.Running)

		// Abort via manager
		manager.abort(p)
		manager.update(DT)
		expect(system.count).toBe(0)
	})

	it('chain processes execute sequentially through manager', () => {
		const manager = createProcessManager()
		const system = new TestProcessSystem(manager)
		manager.addSystem(system)

		const p0 = new TestProcess()
		const p1 = new TestProcess()
		manager.chain(p0, p1)

		// p0: Idle → Running
		manager.update(DT)
		expect(p0.state).toBe(ProcessState.Running)
		expect(system.count).toBe(1)

		// p0: Running → Succeeded
		manager.update(DT)
		expect(p0.state).toBe(ProcessState.Succeeded)

		// p0: Succeeded → handleNext(p1) + remove; p1 now in system
		manager.update(DT)
		expect(system.count).toBe(1)
		expect(p1.state).toBe(ProcessState.Idle)

		// p1: Idle → Running
		manager.update(DT)
		expect(p1.state).toBe(ProcessState.Running)

		// p1: Running → Succeeded
		manager.update(DT)
		// p1: Succeeded → remove
		manager.update(DT)
		expect(system.count).toBe(0)
	})
})
