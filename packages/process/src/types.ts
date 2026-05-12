import type { createSubscriptions } from '@2817/subscriptions'

export const enum ProcessState {
	Idle = 0,
	Running = 1,
	Succeeded = 2,
	Failed = 3,
	Aborted = 4,
}

export interface IProcess {
	state: ProcessState
	next: IProcess | null
	readonly type: string
	addTo(subscriptions: ReturnType<typeof createSubscriptions>, state?: ProcessState): IProcess
}

export interface IProcessSystem {
	readonly type: string
	readonly count: number
	add(process: IProcess): void
	update(dt: number): void
	destroy(): void
}

export interface IProcessManager {
	add(...processes: IProcess[]): void
	chain(...processes: IProcess[]): IProcess
	abort(process: IProcess): void
	markFinished(process: IProcess): void
	markFailed(process: IProcess): void
	addSystem(system: IProcessSystem): void
	update(dt: number): void
	destroy(): void
}
