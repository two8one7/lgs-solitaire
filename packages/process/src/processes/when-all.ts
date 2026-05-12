import { Process } from '../process'
import { ProcessSystem } from '../process-system'
import { ProcessState } from '../types'
import type { IProcess, IProcessManager } from '../types'

const TYPE = 'WhenAll'

export class WhenAll extends Process {
	readonly type = TYPE
	readonly children: IProcess[]

	constructor(...children: IProcess[]) {
		super()
		this.children = children
	}
}

export class WhenAllSystem extends ProcessSystem<WhenAll> {
	readonly type = TYPE

	constructor(manager: IProcessManager) {
		super(manager)
	}

	update(_dt: number): void {
		for (let i = this.processes.length - 1; i >= 0; --i) {
			const p = this.processes[i]
			const children = p.children

			switch (p.state) {
				case ProcessState.Idle:
					for (let j = 0, len = children.length; j < len; ++j) {
						this.manager.add(children[j])
					}
					p.state = ProcessState.Running
					break
				case ProcessState.Running: {
					let allDone = true
					let anyFailed = false
					for (let j = 0, len = children.length; j < len; ++j) {
						const child = children[j]
						if (child.state === ProcessState.Failed || child.state === ProcessState.Aborted) {
							anyFailed = true
							break
						}
						if (child.state === ProcessState.Idle || child.state === ProcessState.Running) {
							allDone = false
						}
					}
					if (anyFailed) {
						// Abort remaining children
						for (let j = 0, len = children.length; j < len; ++j) {
							const child = children[j]
							if (child.state === ProcessState.Idle || child.state === ProcessState.Running) {
								child.state = ProcessState.Aborted
							}
						}
						p.state = ProcessState.Failed
					} else if (allDone) {
						p.state = ProcessState.Succeeded
					}
					break
				}
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
