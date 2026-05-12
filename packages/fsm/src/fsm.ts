import type {
	IMachine,
	IState,
	TransitionCallback,
	FunctionStateWithName,
	FunctionState,
} from './types'
import { fromFunction } from './utils'

function isFunctionState<StateName extends string, Props>(
	state: unknown
): state is FunctionStateWithName<StateName, Props> {
	if (typeof state === 'function' && 'stateName' in state) {
		return true
	}
	return false
}

export function createState<
	StateName extends string,
	TransitionName extends string,
	Props,
>(name: StateName, state: FunctionState<Props, StateName, TransitionName>) {
	;(state as FunctionStateWithName<StateName, Props>).stateName = name
	return state as FunctionStateWithName<StateName, Props>
}

export function createMachine<
	StateName extends string,
	TransitionName extends string,
>(machineName: string, verbose = false): IMachine<StateName, TransitionName> {
	const states = new Map<StateName, IState<StateName>>()
	const transitions = new Map<
		TransitionName,
		{ from: StateName; to: StateName }[]
	>()

	let currentState: StateName | undefined
	let currentStateObj: IState<StateName> | undefined
	let lastTransition: TransitionName | undefined

	const onTransitionCallbacks: TransitionCallback<
		StateName,
		TransitionName
	>[] = []

	const queue: TransitionName[] = []
	let transitioning = false

	function addState<Props>(
		state: IState<StateName> | FunctionStateWithName<StateName, Props>,
		props: { with: Props | null }
	) {
		const finalState = isFunctionState<StateName, Props>(state)
			? fromFunction(state, props?.with as Props)
			: (state as IState<StateName>)

		if (states.has(finalState.name)) {
			states.get(finalState.name)?.destroy?.()
		}
		states.set(finalState.name, finalState)
		return machine
	}

	function addTransition(
		name: TransitionName,
		from: StateName,
		to: StateName
	) {
		if (!transitions.has(name)) {
			transitions.set(name, [])
		}
		const list = transitions.get(name) ?? []
		list.push({ from, to })
		return machine
	}

	function _processNextInQueue() {
		if (queue.length > 0) {
			const next = queue.shift()
			if (next) {
				go(next)
			}
		}
	}

	function go(name: TransitionName, addToQueue = false) {
		if (transitioning || addToQueue) {
			queue.push(name)
			return
		}

		transitioning = true

		if (name === lastTransition) {
			transitioning = false
			return
		}

		verbose && console.info(`[${machineName}]: go transition: ${name}`)

		const list = transitions.get(name)
		if (!list) {
			transitioning = false
			console.log([...transitions.keys()])
			throw new Error(`unknown transition: ${name}`)
		}

		let transition: { from: StateName; to: StateName } | undefined
		let wildcard: { from: StateName; to: StateName } | undefined
		for (const t of list) {
			if (t.from === currentState) {
				transition = t
				break
			}
			if (t.from === '*' && !wildcard) {
				wildcard = t
			}
		}
		if (!transition) {
			transition = wildcard
		}

		if (!transition) {
			transitioning = false
			throw new Error(
				`invalid transition (${name}) from currentState (${currentState})`
			)
		}

		const nextState = states.get(transition.to)
		if (!nextState) {
			transitioning = false
			throw new Error(`unknown to state ${transition.to}`)
		}

		verbose && console.info(`[${machineName}]: exiting ${currentState}`)
		void currentStateObj?.onExit?.()

		currentState = transition.to
		currentStateObj = nextState

		for (const cb of onTransitionCallbacks) {
			cb(transition.to, transition.from, name)
		}

		verbose && console.info(`[${machineName}]: entering ${currentState}`)
		void nextState.onEnter?.(machine)

		lastTransition = name

		verbose &&
			console.info(
				`[${machineName}]: finished transition: ${lastTransition}`
			)

		transitioning = false

		// _processNextInQueue()
	}

	function update(dt: number) {
		if (!currentState) {
			return
		}
		currentStateObj?.onUpdate?.(dt)

		_processNextInQueue()
	}

	function isCurrentState(name: StateName) {
		return currentState === name
	}

	function start(name: StateName) {
		// exit any running state if this gets called on a machine
		// that is in-use; acts like a reset
		if (currentState) {
			verbose && console.info(`[${machineName}]: exiting ${currentState}`)
			currentStateObj?.onExit?.()

			currentState = undefined
			currentStateObj = undefined
			lastTransition = undefined
		}

		currentState = name
		currentStateObj = states.get(currentState)
		verbose && console.info(`[${machineName}]: entering ${currentState}`)

		transitioning = true

		currentStateObj?.onEnter?.(machine)

		transitioning = false

		_processNextInQueue()
	}

	function onTransition(cb: TransitionCallback<StateName, TransitionName>) {
		onTransitionCallbacks.push(cb)
		return () => {
			const idx = onTransitionCallbacks.indexOf(cb)
			if (idx < 0) {
				return
			}

			onTransitionCallbacks.splice(idx, 1)
		}
	}

	function reset() {
		states.clear()
		transitions.clear()

		currentState = undefined
		currentStateObj = undefined
		lastTransition = undefined
	}

	function destroy() {
		if (currentState) {
			currentStateObj?.onExit?.()
		}

		for (const state of states.values()) {
			state.destroy?.()
		}

		reset()
	}

	const machine = {
		addState,
		addTransition,
		go,
		update,
		isCurrentState,
		get currentState() {
			return currentState
		},
		start,
		onTransition,
		reset,
		destroy,
	}

	return machine
}
