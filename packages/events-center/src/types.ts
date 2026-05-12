import type { TypedId } from './typed-id'
import type { Unsubscribe } from '@2817/subscriptions'

export interface IEventData {
	readonly id: TypedId
}

export interface IDelayedEventData extends IEventData {
	accumulatedDelay: number
	delay: number
}

export type Listener<T extends IEventData = IEventData> = (data: T) => void

export type WildcardListener = (data: IEventData) => void

export interface IEventsCenter {
	addListener<T extends IEventData>(eventId: TypedId<T>, listener: Listener<T>): Unsubscribe
	removeListener<T extends IEventData>(eventId: TypedId<T>, listener: Listener<T>): void
	/**
	 * Subscribe to every dispatch on this events-center. Fires after per-id
	 * listeners for the same dispatch. Use sparingly — reserved for
	 * cross-cutting observers (the agent harness's event recorder, dev-tool
	 * loggers). The listener receives the full IEventData payload, including
	 * the TypedId.
	 */
	addWildcardListener(listener: WildcardListener): Unsubscribe
	dispatch<T extends IEventData>(data: T, immediate?: boolean): void
	dispatchDelayed<T extends IEventData>(data: T, delay: number): void
	update(dt: number): void
	destroy(): void
}
