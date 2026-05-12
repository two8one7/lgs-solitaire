import { Process } from '../process'
import { ProcessSystem } from '../process-system'
import { ProcessState } from '../types'
import type { IProcess, IProcessManager } from '../types'

const TYPE = 'WhenChain'

export class WhenChain extends Process {
	readonly type = TYPE
	readonly children: IProcess[]

	constructor(...children: IProcess[]) {
		super()
		this.children = children
	}
}

export class WhenChainSystem extends ProcessSystem<WhenChain> {
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
					if (children.length === 0) {
						p.state = ProcessState.Succeeded
						break
					}
					this.manager.chain(...children)
					p.state = ProcessState.Running
					break
				case ProcessState.Running: {
					// Walk the chain to find terminal state
					let child: IProcess | null = children[0]
					while (child !== null) {
						if (child.state === ProcessState.Failed || child.state === ProcessState.Aborted) {
							p.state = child.state
							break
						}
						if (child.next === null && child.state === ProcessState.Succeeded) {
							p.state = ProcessState.Succeeded
							break
						}
						child = child.next
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
