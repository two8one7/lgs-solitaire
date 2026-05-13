/**
 * Typed event IDs for the Solitaire module.
 *
 * Mirrors lgs-memory/events.ts shape (typed-id per event, no monkey-patching
 * dispatch). Ref: preferences/typed-event-listeners-over-monkey-patch.md
 *
 * Render layer fires Location*Tap events with a logical CardLocation; the
 * input-system listens and dispatches to validator/executor. Logic systems
 * fire MoveExecuted / StockCycled / DailyComplete after state mutation; the
 * scene + save-system listen for those.
 */

import { createTypedId } from '@2817/events-center'
import type { IEventData } from '@2817/events-center'
import type { CardLocation } from './logic/types'

// ─── Input (render → logic) ──────────────────────────────────────────────────

/** Tap on any pile / waste / foundation slot. */
export interface LocationTapEventData extends IEventData {
	readonly id: typeof LocationTapEventId
	location: CardLocation
	/** Depth into the source for pile taps (0 = bottom). Ignored for waste/foundation. */
	depth: number
}
export const LocationTapEventId =
	createTypedId<LocationTapEventData>('solitaire:location-tap')

/** Double-tap → auto-place to legal foundation (or do nothing). */
export interface LocationDoubleTapEventData extends IEventData {
	readonly id: typeof LocationDoubleTapEventId
	location: CardLocation
}
export const LocationDoubleTapEventId = createTypedId<LocationDoubleTapEventData>(
	'solitaire:location-double-tap',
)

/** Tap the stock — draws, or recycles waste if stock empty. */
export interface StockTapEventData extends IEventData {
	readonly id: typeof StockTapEventId
}
export const StockTapEventId = createTypedId<StockTapEventData>('solitaire:stock-tap')

// ─── Logic → world (audit / save / fx) ───────────────────────────────────────

export interface MoveExecutedEventData extends IEventData {
	readonly id: typeof MoveExecutedEventId
	fromKind: string
	toKind: string
}
export const MoveExecutedEventId =
	createTypedId<MoveExecutedEventData>('solitaire:move-executed')

export interface StockCycledEventData extends IEventData {
	readonly id: typeof StockCycledEventId
	kind: 'draw' | 'recycle' | 'empty'
}
export const StockCycledEventId =
	createTypedId<StockCycledEventData>('solitaire:stock-cycled')

export interface DailyCompleteEventData extends IEventData {
	readonly id: typeof DailyCompleteEventId
	playerTimeMs: number
	timeDeltaMs: number
}
export const DailyCompleteEventId =
	createTypedId<DailyCompleteEventData>('solitaire:daily-complete')

// ─── UI ───────────────────────────────────────────────────────────────────────

export interface UiPressEventData extends IEventData {
	readonly id: typeof UiPressEventId
	target: string
}
export const UiPressEventId = createTypedId<UiPressEventData>('solitaire:ui-press')
