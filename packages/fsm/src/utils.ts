import type {
	IState,
	FunctionStateWithName,
	OnExit,
	UpdateFunc,
	IMachine,
} from './types'

export function fromFunction<StateName extends string, Props>(
	state: FunctionStateWithName<StateName, Props>,
	props: Props
): IState<StateName> {
	let onExitFunc: OnExit | undefined | { (): void }
	const onUpdateFuncs: UpdateFunc[] = []
	let onDestroyFunc: { (): void } | undefined
	function onUpdate(cb: UpdateFunc) {
		onUpdateFuncs.push(cb)

		return () => {
			const idx = onUpdateFuncs.indexOf(cb)
			if (idx < 0) {
				return
			}
			onUpdateFuncs.splice(idx, 1)
		}
	}
	function onDestroy(cb: () => void) {
		onDestroyFunc = cb
	}

	return {
		name: state.stateName,
		onEnter(fsm: IMachine) {
			onExitFunc = state(props as Props, { onUpdate, onDestroy }, fsm)
		},
		onUpdate(dt) {
			for (const update of onUpdateFuncs) {
				update(dt)
			}
		},
		onExit() {
			onUpdateFuncs.length = 0

			onExitFunc?.()
			onExitFunc = undefined
		},
		destroy() {
			onDestroyFunc?.()
		},
	}
}
