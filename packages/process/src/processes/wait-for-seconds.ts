import { Process } from '../process'
import { ProcessSystem } from '../process-system'
import { ProcessState } from '../types'
import type { IProcessManager } from '../types'

const TYPE = 'WaitForSeconds'

export class WaitForSeconds extends Process {
	readonly type = TYPE
	accumulatedTime = 0

	constructor(public readonly duration: number) {
		super()
	}
}

export class WaitForSecondsSystem extends ProcessSystem<WaitForSeconds> {
	readonly type = TYPE

	constructor(manager: IProcessManager) {
		super(manager)
	}

	update(_dt: number): void {
		for (let i = this.processes.length - 1; i >= 0; --i) {
			const p = this.processes[i]
			switch (p.state) {
				case ProcessState.Idle:
					p.state = ProcessState.Running
					break
				case ProcessState.Running:
					p.accumulatedTime += _dt
					if (p.accumulatedTime >= p.duration) {
						p.state = ProcessState.Succeeded
					}
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
