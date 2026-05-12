import { Process } from '../process'
import { ProcessSystem } from '../process-system'
import { ProcessState } from '../types'
import type { IProcessManager } from '../types'

const TYPE = 'ExecuteAction'

export class ExecuteAction extends Process {
	readonly type = TYPE

	constructor(public readonly action: () => void) {
		super()
	}
}

export class ExecuteActionSystem extends ProcessSystem<ExecuteAction> {
	readonly type = TYPE

	constructor(manager: IProcessManager) {
		super(manager)
	}

	update(_dt: number): void {
		for (let i = this.processes.length - 1; i >= 0; --i) {
			const p = this.processes[i]
			switch (p.state) {
				case ProcessState.Idle:
					p.action()
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
