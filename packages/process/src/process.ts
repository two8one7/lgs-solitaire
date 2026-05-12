import type { createSubscriptions } from '@2817/subscriptions'
import { ProcessState } from './types'
import type { IProcess } from './types'

export abstract class Process implements IProcess {
	state: ProcessState = ProcessState.Idle
	next: IProcess | null = null
	abstract readonly type: string

	addTo(subscriptions: ReturnType<typeof createSubscriptions>, state: ProcessState = ProcessState.Aborted): this {
		subscriptions.push(() => {
			this.state = state
		})
		return this
	}
}
