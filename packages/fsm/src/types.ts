export interface IMachine<
	StateName extends string = string,
	TransitionName extends string = string,
> {
	readonly currentState: StateName | undefined

	addState<Props>(
		state: IState<StateName> | FunctionStateWithName<StateName, Props>,
		options?: { with: Props | null }
	): IMachine<StateName, TransitionName>
	// addState(
	// 	state: IState<StateName> | FunctionStateWithName<StateName, void>
	// ): IMachine<StateName, TransitionName>

	addTransition(
		name: TransitionName,
		from: StateName | '*',
		to: StateName
	): IMachine<StateName, TransitionName>
	go(name: TransitionName, addToQueue?: boolean): void
	update(dt?: number): void
	isCurrentState(name: StateName): boolean
	start(name: StateName, ...args: unknown[]): void
	onTransition(cb: TransitionCallback<StateName, TransitionName>): () => void
	reset(): void
	destroy(): void
}

export interface IState<StateName extends string = string> {
	readonly name: StateName
	onEnter?: (fsm: IMachine) => Promise<void> | void
	onUpdate?: (dt: number) => void
	onExit?: () => Promise<void> | void
	destroy?: () => void
}

export type TransitionCallback<
	StateName extends string = string,
	TransitionName extends string = string,
> = (
	nextState: StateName,
	prevState: StateName,
	transition: TransitionName
) => void

export type OnExit = () => void
export type UpdateFunc = (dt: number) => void

export type FunctionState<
	Props,
	StateName extends string = string,
	TransitionName extends string = string,
> = (
	props: Props,
	hooks: Hooks,
	fsm: IMachine<StateName, TransitionName>
) => OnExit | undefined | { (): void }

export type FunctionStateWithName<
	StateName extends string,
	Props,
> = FunctionState<Props> & { stateName: StateName }

export type OnUpdateFunction = (cb: UpdateFunc) => () => void
export type OnDestroyFunction = (cb: () => void) => void
export type WithUpdate<T> = T & { onUpdate: OnUpdateFunction }
export type Hooks = {
	onUpdate: OnUpdateFunction
	onDestroy: OnDestroyFunction
}

export const NoProps = null
