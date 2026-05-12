import { Process } from '../process'
import { ProcessSystem } from '../process-system'
import { ProcessState } from '../types'
import type { IProcessManager } from '../types'

const TYPE = 'ExecuteAsyncAction'

export class ExecuteAsyncAction extends Process {
	readonly type = TYPE

	constructor(public readonly action: () => Promise<void>) {
		super()
	}
}

export class ExecuteAsyncActionSystem extends ProcessSystem<ExecuteAsyncAction> {
	readonly type = TYPE

	constructor(manager: IProcessManager) {
		super(manager)
	}

	update(_dt: number): void {
		for (let i = this.processes.length - 1; i >= 0; --i) {
			const p = this.processes[i]
			switch (p.state) {
				case ProcessState.Idle:
					this.executeAsync(p)
					p.state = ProcessState.Running
					break
				case ProcessState.Running:
					// Wait for async operation to complete
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

	private executeAsync(p: ExecuteAsyncAction): void {
		p.action()
			.then(() => {
				if (p.state === ProcessState.Running) {
					p.state = ProcessState.Succeeded
				}
			})
			.catch((e) => {
				console.error('ExecuteAsyncAction failed:', e)
				if (p.state === ProcessState.Running) {
					p.state = ProcessState.Failed
				}
			})
	}
}
