/**
 * daily-deal-hydration — one-shot system that boots the world from a
 * validated DailyDealArtifact.
 *
 * Deserializes the deck string, deals Klondike (PILES_LAYOUT 7..1), seeds
 * CBoardState on the Board entity with the resulting SolitaireBoardState,
 * and spawns 52 Card entities — each with CCardId/CSuit/CRank/CFaceUp/CPosition
 * mirroring its dealt location. Also resets Selection / Timer / ScoreCalc and
 * stashes DailyDealRef + ContentPackRef on GameRoot.
 *
 * No Pixi imports. Mirrors lgs-memory/systems/daily-layout-hydration.ts.
 *
 * ECS review notes:
 *   AP-1  ✓ — single concern: hydrate world from artifact, one call per session.
 *   AP-2  ✓ — components are data-only; logic stays in deck.ts / checker.ts.
 *   AP-27 ✓ — every Card entity gets ALL components in one addComponent batch.
 *   AP-30 ✓ — no float math; all integer indices / counts.
 */

import { addComponent, createEntity } from '@2817/ecs'
import type { IWorld, IEntity } from '@2817/ecs'
import { dealKlondike, deserializeDeck } from '../logic/deck'
import type { PileType, SolitaireBoardState } from '../logic/types'
import {
	CBoardState,
	CContentPackRef,
	CDailyDealRef,
	CDrawSize,
	CFaceUp,
	CMovesCount,
	CParTimeMs,
	CPlayerTimeMs,
	CPosition,
	CCardId,
	CRank,
	CSelectedCardRef,
	CSelectionRunLength,
	CStartedAtMs,
	CSuit,
	CTimeDeltaMs,
	CTimeElapsedMs,
} from '../components'
import type { DailyDealArtifact } from './build-daily-deal'

export class HydrationError extends Error {
	constructor(message: string) {
		super(`[HydrationError] ${message}`)
		this.name = 'HydrationError'
	}
}

export function validateDailyDealInvariants(artifact: DailyDealArtifact): void {
	if (!artifact) throw new HydrationError('artifact is null')
	if (typeof artifact.deck !== 'string' || artifact.deck.length === 0) {
		throw new HydrationError('artifact.deck is empty')
	}
	if (artifact.drawSize !== 1 && artifact.drawSize !== 3) {
		throw new HydrationError(`drawSize must be 1 or 3, got ${artifact.drawSize}`)
	}
	if (!(artifact.parTimeSeconds > 0)) {
		throw new HydrationError(`parTimeSeconds must be > 0, got ${artifact.parTimeSeconds}`)
	}
}

export type HydrateArgs = {
	world: IWorld
	artifact: DailyDealArtifact
	packSlug: string
	gameRootEntity: IEntity
	boardEntity: IEntity
	selectionEntity: IEntity
	timerEntity: IEntity
	scoreCalcEntity: IEntity
}

function pileTypeForIndex(pileIdx: number): PileType {
	void pileIdx
	return 'tableau'
}

export function hydrateDailyDeal(args: HydrateArgs): IEntity[] {
	const {
		world,
		artifact,
		packSlug,
		gameRootEntity,
		boardEntity,
		selectionEntity,
		timerEntity,
		scoreCalcEntity,
	} = args
	validateDailyDealInvariants(artifact)

	const cards = deserializeDeck(artifact.deck)
	if (cards.length !== 52) {
		throw new HydrationError(`deck deserialized to ${cards.length} cards, expected 52`)
	}
	const state: SolitaireBoardState = dealKlondike(cards, artifact.drawSize)

	// Stash artifact refs on GameRoot.
	const grWi = gameRootEntity.worldIndex
	const grIdx = gameRootEntity.index
	CDailyDealRef.date[grWi][grIdx] = artifact.date
	CDailyDealRef.drawSize[grWi][grIdx] = artifact.drawSize
	CDailyDealRef.source[grWi][grIdx] = artifact.source ?? ''
	CContentPackRef.slug[grWi][grIdx] = packSlug

	// Seed Board.
	const bWi = boardEntity.worldIndex
	const bIdx = boardEntity.index
	CBoardState.value[bWi][bIdx] = state
	CMovesCount.value[bWi][bIdx] = 0
	CDrawSize.value[bWi][bIdx] = artifact.drawSize

	// Spawn one Card entity per card index, with its dealt position.
	const cardEntities: IEntity[] = []
	const positions = buildPositionTable(state)
	for (let cardIdx = 0; cardIdx < state.cards.length; cardIdx++) {
		const card = state.cards[cardIdx]!
		const pos = positions[cardIdx]!
		const e = createEntity(world)
		addComponent(e, CCardId, { value: cardIdx })
		addComponent(e, CSuit, { value: card.suit })
		addComponent(e, CRank, { value: card.value })
		addComponent(e, CFaceUp, { value: card.faceUp })
		addComponent(e, CPosition, {
			pile: pos.pile,
			column: pos.column,
			depth: pos.depth,
		})
		cardEntities.push(e)
	}

	// Reset Selection.
	const sWi = selectionEntity.worldIndex
	const sIdx = selectionEntity.index
	CSelectedCardRef.pile[sWi][sIdx] = ''
	CSelectedCardRef.column[sWi][sIdx] = 0
	CSelectedCardRef.depth[sWi][sIdx] = 0
	CSelectionRunLength.value[sWi][sIdx] = 0

	// Reset Timer.
	const tWi = timerEntity.worldIndex
	const tIdx = timerEntity.index
	CTimeElapsedMs.value[tWi][tIdx] = 0
	CStartedAtMs.value[tWi][tIdx] = 0

	// Seed ScoreCalc with par.
	const scWi = scoreCalcEntity.worldIndex
	const scIdx = scoreCalcEntity.index
	CParTimeMs.value[scWi][scIdx] = artifact.parTimeSeconds * 1000
	CPlayerTimeMs.value[scWi][scIdx] = 0
	CTimeDeltaMs.value[scWi][scIdx] = 0

	return cardEntities

	// Local helper kept inside the closure for clarity — never invoked from
	// outside hydration.
	function buildPositionTable(s: SolitaireBoardState) {
		const out: { pile: PileType; column: number; depth: number }[] = new Array(s.cards.length)
		for (let col = 0; col < s.piles.length; col++) {
			const pile = s.piles[col]!
			for (let depth = 0; depth < pile.length; depth++) {
				const idx = pile[depth]!
				out[idx] = { pile: pileTypeForIndex(col), column: col, depth }
			}
		}
		for (let depth = 0; depth < s.stock.length; depth++) {
			const idx = s.stock[depth]!
			out[idx] = { pile: 'stock', column: 0, depth }
		}
		for (let depth = 0; depth < s.waste.length; depth++) {
			const idx = s.waste[depth]!
			out[idx] = { pile: 'waste', column: 0, depth }
		}
		for (let suit = 0; suit < s.foundations.length; suit++) {
			const f = s.foundations[suit]!
			for (let depth = 0; depth < f.length; depth++) {
				const idx = f[depth]!
				out[idx] = { pile: 'foundation', column: suit, depth }
			}
		}
		return out
	}
}
