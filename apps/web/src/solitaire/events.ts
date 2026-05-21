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

export interface CardTapEventData extends IEventData {
	readonly id: typeof CardTapEventId
	source: 'tableau' | 'waste' | 'foundation' | 'stock'
}
export const CardTapEventId = createTypedId<CardTapEventData>('solitaire:card-tap')

export interface CardPickupEventData extends IEventData {
	readonly id: typeof CardPickupEventId
	source: 'tableau' | 'waste' | 'foundation'
}
export const CardPickupEventId =
	createTypedId<CardPickupEventData>('solitaire:card-pickup')

// ─── Logic → world (audit / save / fx) ───────────────────────────────────────

export interface MoveExecutedEventData extends IEventData {
	readonly id: typeof MoveExecutedEventId
	fromKind: string
	toKind: string
	/** Source location of the move (added Phase 3 for juice targeting). */
	from?: CardLocation
	/** Destination location of the move (added Phase 3 for juice targeting). */
	to?: CardLocation
}
export const MoveExecutedEventId =
	createTypedId<MoveExecutedEventData>('solitaire:move-executed')

export interface MoveRejectedEventData extends IEventData {
	readonly id: typeof MoveRejectedEventId
	reason: string
	/** Source location of the failed move (added Phase 3 for juice targeting). */
	from?: CardLocation
}
export const MoveRejectedEventId =
	createTypedId<MoveRejectedEventData>('solitaire:move-rejected')

export interface StockCycledEventData extends IEventData {
	readonly id: typeof StockCycledEventId
	kind: 'draw' | 'recycle' | 'empty'
}
export const StockCycledEventId =
	createTypedId<StockCycledEventData>('solitaire:stock-cycled')

export interface FoundationCompletedEventData extends IEventData {
	readonly id: typeof FoundationCompletedEventId
	suit: number
}
export const FoundationCompletedEventId = createTypedId<FoundationCompletedEventData>(
	'solitaire:foundation-completed',
)

export interface AutoCompleteTickEventData extends IEventData {
	readonly id: typeof AutoCompleteTickEventId
}
export const AutoCompleteTickEventId = createTypedId<AutoCompleteTickEventData>(
	'solitaire:auto-complete-tick',
)

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
