import type { IProcess, IProcessManager, IProcessSystem } from './types'
import { ProcessState } from './types'

export function createProcessManager(): IProcessManager {
	const systemsByType = new Map<string, IProcessSystem>()
	const systems: IProcessSystem[] = []
	const pendingQueue = new Map<string, IProcess[]>()

	function add(...processes: IProcess[]): void {
		for (const process of processes) {
			const system = systemsByType.get(process.type)
			if (system !== undefined) {
				system.add(process)
			} else {
				let queue = pendingQueue.get(process.type)
				if (queue === undefined) {
					queue = []
					pendingQueue.set(process.type, queue)
				}
				queue.push(process)
			}
		}
	}

	function chain(...processes: IProcess[]): IProcess {
		for (let i = 0, len = processes.length - 1; i < len; ++i) {
			processes[i].next = processes[i + 1]
		}
		add(processes[0])
		return processes[0]
	}

	function abort(process: IProcess): void {
		process.state = ProcessState.Aborted
	}

	function markFinished(process: IProcess): void {
		process.state = ProcessState.Succeeded
	}

	function markFailed(process: IProcess): void {
		process.state = ProcessState.Failed
	}

	function addSystem(system: IProcessSystem): void {
		systemsByType.set(system.type, system)
		systems.push(system)

		const queued = pendingQueue.get(system.type)
		if (queued !== undefined) {
			for (const process of queued) {
				system.add(process)
			}
			pendingQueue.delete(system.type)
		}
	}

	function update(dt: number): void {
		for (let i = 0, len = systems.length; i < len; ++i) {
			systems[i].update(dt)
		}
	}

	function destroy(): void {
		for (let i = systems.length - 1; i >= 0; --i) {
			systems[i].destroy()
		}
		systems.length = 0
		systemsByType.clear()
		pendingQueue.clear()
	}

	return { add, chain, abort, markFinished, markFailed, addSystem, update, destroy }
}
