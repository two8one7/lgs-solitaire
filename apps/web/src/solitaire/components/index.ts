/**
 * ECS component definitions for LGS Solitaire (Klondike Draw-1).
 *
 * Pure data, no logic. No Pixi imports. Mirrors lgs-memory/components/index.ts
 * in shape and conventions (one component per concept, presence tags via
 * `createTag` consumed by `with:` / `without:` queries).
 *
 * Entities and their components (see runtime/index.ts for spawn sites):
 *   GameRoot       : CGameState, CDailyDealRef, CContentPackRef, CSaveSlot, CAudioState
 *   Board          : CTableau, CFoundations, CStock, CWaste, CMovesCount, CDrawSize
 *                    + CCardCatalog (the SolitaireBoardState the logic owns)
 *                    + CCompletedFlag (presence tag, set by win-check)
 *   Card[0..51]    : CCardId, CSuit, CRank, CFaceUp, CPosition
 *   Selection      : CSelectedCardRef, CSelectionRunLength
 *   Timer          : CTimeElapsedMs, CStartedAtMs (+ CTimerRunning tag)
 *   StreakTracker  : CCurrentStreak, CBestStreak, CLastCompletedDate
 *   ScoreCalc      : CParTimeMs, CPlayerTimeMs, CTimeDeltaMs, CBestTimeMs
 *
 * ECS review notes (AP-1..AP-31, PP-1..PP-5):
 *   AP-2  ✓ — components are data-only.
 *   AP-27 ✓ — every entity gets ALL required components in one shot at spawn
 *           (see runtime/index.ts).
 *   PP-3  ✓ — CTimerRunning and CCompletedFlag are presence tags read via
 *           `with:` / `without:` to gate one-shot transitions.
 */

import { createComponent, createTag } from '@2817/ecs'
import type { SolitaireBoardState, PileType } from '../logic/types'
import type { SolitaireSaveSlot } from '../types'

// ─── GameRoot entity ──────────────────────────────────────────────────────────

/** Current scene phase. boot → title → playing → complete. */
export const CGameState = createComponent(
	{ phase: { type: String, default: 'boot' } },
	{ id: 'solitaire:GameState' },
)

/** YYYY-MM-DD of the active daily deal — what we hydrated for. */
export const CDailyDealRef = createComponent(
	{
		date: { type: String, default: '' },
		drawSize: { type: Number, default: 1 },
		source: { type: String, default: '' },
	},
	{ id: 'solitaire:DailyDealRef' },
)

/** Content-pack slug — the swap surface for multi-publisher reskins. */
export const CContentPackRef = createComponent(
	{ slug: { type: String, default: '' } },
	{ id: 'solitaire:ContentPackRef' },
)

/** Save slot — localStorage-backed via SaveStore. */
export const CSaveSlot = createComponent(
	{
		data: {
			type: Object,
			default: (): SolitaireSaveSlot => ({
				completedDates: {},
				currentStreak: 0,
				bestStreak: 0,
				lastCompletedDate: '',
				bestTimeMs: 0,
			}),
		},
	},
	{ id: 'solitaire:SaveSlot' },
)

/** Audio state — logic-only stub; no Web Audio imports here. */
export const CAudioState = createComponent(
	{
		sfxEnabled: { type: Boolean, default: true },
		ambientEnabled: { type: Boolean, default: false },
	},
	{ id: 'solitaire:AudioState' },
)

// ─── Board entity ─────────────────────────────────────────────────────────────

/**
 * The full Klondike board state — the SolitaireBoardState shape that
 * checker.ts mutates. Held as a single Object component so the validator /
 * executor / stock-cycle systems can hand it to the pure functions in
 * logic/checker.ts without re-shaping.
 *
 * Why one Object rather than five per-pile components? The logic primitives
 * already work on SolitaireBoardState; splitting it would force serialization
 * back-and-forth on every move. Render systems read this same Object via
 * the Board entity reference threaded through RenderContext.
 */
export const CBoardState = createComponent(
	{ value: { type: Object, default: () => null as SolitaireBoardState | null } },
	{ id: 'solitaire:BoardState' },
)

/** Number of moves the player has executed this session. */
export const CMovesCount = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:MovesCount' },
)

/**
 * Klondike draw size (1 or 3). Lives on the Board so input/stock-cycle
 * systems can read it without reaching into the daily deal artifact.
 */
export const CDrawSize = createComponent(
	{ value: { type: Number, default: 1 } },
	{ id: 'solitaire:DrawSize' },
)

/**
 * Presence tag — set by win-check once all 52 cards reach foundations.
 * PP-3 ✓ — consumed via `without:` by win-check, save-system, streak-update.
 */
export const CCompletedFlag = createTag({ id: 'solitaire:CompletedFlag' })

// ─── Card[0..51] entities ─────────────────────────────────────────────────────

/** Stable card index in the SolitaireBoardState.cards array (0..51). */
export const CCardId = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:CardId' },
)

/** 0=spades, 1=hearts, 2=clubs, 3=diamonds. Mirrors logic/types.Suit. */
export const CSuit = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:Suit' },
)

/** 1=Ace .. 13=King. */
export const CRank = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:Rank' },
)

/**
 * Whether the card is face-up. The authoritative copy is on
 * SolitaireBoardState.cards[idx].faceUp — this component mirrors it for
 * render systems that prefer per-entity reads to indexing the whole state.
 */
export const CFaceUp = createComponent(
	{ value: { type: Boolean, default: false } },
	{ id: 'solitaire:FaceUp' },
)

/** Logical position — pile kind + column + depth. */
export const CPosition = createComponent(
	{
		pile: { type: String, default: 'stock' as PileType },
		column: { type: Number, default: 0 },
		depth: { type: Number, default: 0 },
	},
	{ id: 'solitaire:Position' },
)

// ─── Selection entity ─────────────────────────────────────────────────────────

/**
 * Currently-selected card location. `pile === ''` means no active selection.
 * `runLength` is the number of cards being held (1 for foundation/waste; 1..N
 * for a tableau run). Multi-card runs are validated by move-validator at
 * commit time.
 */
export const CSelectedCardRef = createComponent(
	{
		pile: { type: String, default: '' as PileType | '' },
		column: { type: Number, default: 0 },
		depth: { type: Number, default: 0 },
	},
	{ id: 'solitaire:SelectedCardRef' },
)

export const CSelectionRunLength = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:SelectionRunLength' },
)

// ─── Timer entity ─────────────────────────────────────────────────────────────

export const CTimeElapsedMs = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:TimeElapsedMs' },
)

/**
 * Presence tag — timer is actively counting up.
 * Set on first input, cleared by win-check when CompletedFlag lands.
 * PP-3 ✓ — timer-system queries `with: [CTimerRunning]`.
 */
export const CTimerRunning = createTag({ id: 'solitaire:TimerRunning' })

export const CStartedAtMs = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:StartedAtMs' },
)

// ─── StreakTracker entity ─────────────────────────────────────────────────────

export const CCurrentStreak = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:CurrentStreak' },
)

export const CBestStreak = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:BestStreak' },
)

/** YYYY-MM-DD of the last completion, or '' if never. */
export const CLastCompletedDate = createComponent(
	{ value: { type: String, default: '' } },
	{ id: 'solitaire:LastCompletedDate' },
)

// ─── ScoreCalc entity ─────────────────────────────────────────────────────────

export const CParTimeMs = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:ParTimeMs' },
)

export const CPlayerTimeMs = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:PlayerTimeMs' },
)

export const CTimeDeltaMs = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:TimeDeltaMs' },
)

/** Best (lowest) PlayerTimeMs ever recorded for this publisher. */
export const CBestTimeMs = createComponent(
	{ value: { type: Number, default: 0 } },
	{ id: 'solitaire:BestTimeMs' },
)
