import type { Unsubscribe } from '@2817/subscriptions'

/** Minimal display-object interface — Pixi's Container satisfies this structurally */
export interface IDisplayObject {
	addChild(...children: IDisplayObject[]): unknown
	removeChild(...children: IDisplayObject[]): unknown
}

export interface IScreen {
	readonly name: string
	readonly display: IDisplayObject
	initialize?(manager: IScreenManager): Promise<void>
	enter?(manager: IScreenManager): Promise<void>
	revealed?(manager: IScreenManager): void
	exit?(manager: IScreenManager): Promise<void>
	update?(dt: number): void
	destroy?(): void
}

export interface IModal {
	readonly name: string
	readonly display: IDisplayObject
	initialize?(manager: IScreenManager): Promise<void>
	enter?(manager: IScreenManager): Promise<void>
	exit?(manager: IScreenManager): Promise<void>
	destroy?(): void
}

export interface ITransition {
	readonly name: string
	readonly display: IDisplayObject
	initialize?(): Promise<void>
	enter(): Promise<void>
	exit(): Promise<void>
	destroy?(): void
}

export interface GoOptions {
	skipTransition?: boolean
	excludeFromHistory?: boolean
}

export type ScreenCallback = (name: string) => void

export interface ScreenManagerConfig {
	screenParent: IDisplayObject
	modalParent: IDisplayObject
	transitionParent: IDisplayObject
}

export interface IScreenManager {
	addScreen(screen: IScreen): void
	addModal(modal: IModal): void
	addTransition(transition: ITransition): void
	removeScreen(name: string): void

	initialize(): Promise<void>

	go(name: string, options?: GoOptions): Promise<void>
	back(): Promise<boolean>
	dismissActive(): Promise<boolean>

	showModal(name: string): Promise<Unsubscribe>
	closeModal(name: string): Promise<void>
	closeAllModals(): Promise<void>

	showTransition(name?: string): Promise<ITransition | null>
	hideTransition(transition: ITransition | null): Promise<void>
	useTransition(name: string): void

	update(dt: number): void
	destroy(): Promise<void>

	readonly activeScreenName: string | undefined

	onScreenWillExit(cb: ScreenCallback): Unsubscribe
	onScreenDidExit(cb: ScreenCallback): Unsubscribe
	onScreenWillEnter(cb: ScreenCallback): Unsubscribe
	onScreenDidEnter(cb: ScreenCallback): Unsubscribe
}
