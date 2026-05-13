/**
 * Solitaire runtime entity bundle.
 *
 * Singletons created in runtime/index.ts and threaded through systems +
 * render context. `cards` holds the 52 per-Card entities in deal order
 * (their CCardId matches the index into SolitaireBoardState.cards).
 */

import type { IEntity } from '@2817/ecs'

export type SolitaireWorldEntities = {
	gameRoot: IEntity
	board: IEntity
	selection: IEntity
	timer: IEntity
	streakTracker: IEntity
	scoreCalc: IEntity
	cards: IEntity[]
}
