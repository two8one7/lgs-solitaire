import { Process } from '../process'
import { ProcessSystem } from '../process-system'
import { ProcessState } from '../types'
import type { IProcessManager } from '../types'

const TYPE = 'ExecuteActionInterval'

export class ExecuteActionInterval extends Process {
	readonly type = TYPE
	accumulatedTime = 0
	executionCount = 0
	maxExecutions = -1

	constructor(
		public readonly action: () => void,
		public readonly interval: number,
		public readonly executeImmediately = false,
	) {
		super()
	}

	withMaxExecutions(max: number): this {
		this.maxExecutions = max
		return this
	}
}

export class ExecuteActionIntervalSystem extends ProcessSystem<ExecuteActionInterval> {
	readonly type = TYPE

	constructor(manager: IProcessManager) {
		super(manager)
	}

	update(dt: number): void {
		for (let i = this.processes.length - 1; i >= 0; --i) {
			const p = this.processes[i]
			switch (p.state) {
				case ProcessState.Idle:
					if (p.executeImmediately) {
						p.action()
						p.executionCount++
						if (p.maxExecutions > 0 && p.executionCount >= p.maxExecutions) {
							p.state = ProcessState.Succeeded
							break
						}
					}
					p.state = ProcessState.Running
					break
				case ProcessState.Running:
					p.accumulatedTime += dt
					if (p.accumulatedTime >= p.interval) {
						p.accumulatedTime -= p.interval
						p.action()
						p.executionCount++
						if (p.maxExecutions > 0 && p.executionCount >= p.maxExecutions) {
							p.state = ProcessState.Succeeded
						}
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
