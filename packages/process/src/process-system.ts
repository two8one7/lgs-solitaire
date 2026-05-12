import type { IProcess, IProcessManager, IProcessSystem } from './types'
import { ProcessState } from './types'
import type { Process } from './process'

export abstract class ProcessSystem<T extends Process> implements IProcessSystem {
	abstract readonly type: string
	protected readonly processes: T[] = []
	protected readonly manager: IProcessManager

	constructor(manager: IProcessManager) {
		this.manager = manager
	}

	get count(): number {
		return this.processes.length
	}

	add(process: IProcess): void {
		this.processes.push(process as T)
	}

	abstract update(dt: number): void

	protected removeAt(index: number): void {
		const last = this.processes.length - 1
		if (index !== last) {
			this.processes[index] = this.processes[last]
		}
		this.processes.pop()
	}

	protected handleNextProcesses(process: T): void {
		if (process.next === null) return
		if (process.state === ProcessState.Succeeded) {
			this.manager.add(process.next)
		}
	}

	destroy(): void {
		this.processes.length = 0
	}
}
