/**
 * Solitaire runtime — world creation, entity setup, system wiring, tick driver.
 *
 * Mirrors lgs-memory/runtime/index.ts. No Pixi imports.
 *
 * System tick order (each call site documents why):
 *   1. eventsCenter.update(dt)       — flush queued LocationTap / StockTap / ...
 *   2. timerSystem.update(dt)        — count up TimeElapsedMs while TimerRunning
 *   3. autoComplete.update(dt)       — drain pile→foundation when board is auto-clearable
 *   4. winCheck.update()             — set CompletedFlag when all 52 are on foundations
 *   5. streakUpdate.update()         — compute streak on completion
 *   6. saveSystem.update(dt)         — throttled/debounced localStorage write
 *
 * Input is event-driven, not tick-driven — input-system + stock-cycle + auto-place
 * attach listeners on the events bus and stay passive until an event arrives.
 */

import { addComponent, createEntity, createWorld } from '@2817/ecs'
import type { IWorld } from '@2817/ecs'
import { createEventsCenter } from '@2817/events-center'
import type { IEventsCenter } from '@2817/events-center'
import {
	CAudioState,
	CBestStreak,
	CBestTimeMs,
	CBoardState,
	CContentPackRef,
	CCurrentStreak,
	CDailyDealRef,
	CDrawSize,
	CGameState,
	CLastCompletedDate,
	CMovesCount,
	CParTimeMs,
	CPlayerTimeMs,
	CSaveSlot,
	CSelectedCardRef,
	CSelectionRunLength,
	CStartedAtMs,
	CTimeDeltaMs,
	CTimeElapsedMs,
} from '../components'
import {
	MoveExecutedEventId,
	StockCycledEventId,
	type MoveExecutedEventData,
	type StockCycledEventData,
} from '../events'
import type { SaveStore } from '../save/store'
import type { SolitaireSaveSlot } from '../types'
import {
	createAutoCompleteSystem,
	createAutoPlaceSystem,
	createInputSystem,
	createMoveExecutor,
	createSaveSystem,
	createStockCycleSystem,
	createStreakUpdateSystem,
	createTimerSystem,
	createWinCheckSystem,
	hydrateDailyDeal,
	type SaveSystem,
} from '../systems'
import type { DailyDealArtifact } from '../systems/build-daily-deal'
import type { SolitaireWorldEntities } from './types'

export type SolitaireRuntime = {
	world: IWorld
	eventsCenter: IEventsCenter
	entities: SolitaireWorldEntities
	systems: {
		input: ReturnType<typeof createInputSystem>
		stockCycle: ReturnType<typeof createStockCycleSystem>
		autoPlace: ReturnType<typeof createAutoPlaceSystem>
		autoComplete: ReturnType<typeof createAutoCompleteSystem>
		timer: ReturnType<typeof createTimerSystem>
		winCheck: ReturnType<typeof createWinCheckSystem>
		streakUpdate: ReturnType<typeof createStreakUpdateSystem>
		save: SaveSystem
	}
	tick: (dt: number) => void
	dispose: () => void
}

export type SolitaireRuntimeOptions = {
	getDate?: () => string
	now?: () => number
	initialSave?: Partial<SolitaireSaveSlot>
	autoCompleteStepIntervalS?: number
	saveStore: SaveStore
	packSlug: string
}

export function createSolitaireRuntime(
	artifact: DailyDealArtifact,
	options: SolitaireRuntimeOptions,
): SolitaireRuntime {
	const getDate = options.getDate ?? (() => artifact.date)
	const now = options.now ?? (() => performance.now())

	const eventsCenter = createEventsCenter()
	const world = createWorld({ events: () => eventsCenter })

	const initialSave: SolitaireSaveSlot = {
		completedDates: {},
		currentStreak: 0,
		bestStreak: 0,
		lastCompletedDate: '',
		bestTimeMs: 0,
		...options.initialSave,
	}

	// ─── Singleton entities (AP-27: all required components added one-shot) ───
	const gameRoot = createEntity(world)
	addComponent(gameRoot, CGameState, { phase: 'boot' })
	addComponent(gameRoot, CDailyDealRef, {
		date: artifact.date,
		drawSize: artifact.drawSize,
		source: artifact.source ?? '',
	})
	addComponent(gameRoot, CContentPackRef, { slug: options.packSlug })
	addComponent(gameRoot, CSaveSlot, { data: initialSave })
	addComponent(gameRoot, CAudioState, { sfxEnabled: true, ambientEnabled: false })

	const board = createEntity(world)
	addComponent(board, CBoardState, { value: null })
	addComponent(board, CMovesCount, { value: 0 })
	addComponent(board, CDrawSize, { value: artifact.drawSize })

	const selection = createEntity(world)
	addComponent(selection, CSelectedCardRef, { pile: '', column: 0, depth: 0 })
	addComponent(selection, CSelectionRunLength, { value: 0 })

	const timer = createEntity(world)
	addComponent(timer, CTimeElapsedMs, { value: 0 })
	addComponent(timer, CStartedAtMs, { value: 0 })

	const streakTracker = createEntity(world)
	addComponent(streakTracker, CCurrentStreak, { value: initialSave.currentStreak })
	addComponent(streakTracker, CBestStreak, { value: initialSave.bestStreak })
	addComponent(streakTracker, CLastCompletedDate, { value: initialSave.lastCompletedDate })

	const scoreCalc = createEntity(world)
	addComponent(scoreCalc, CParTimeMs, { value: artifact.parTimeSeconds * 1000 })
	addComponent(scoreCalc, CPlayerTimeMs, { value: 0 })
	addComponent(scoreCalc, CTimeDeltaMs, { value: 0 })
	addComponent(scoreCalc, CBestTimeMs, { value: initialSave.bestTimeMs })

	// ─── Hydrate the daily board ───────────────────────────────────────────────
	const cards = hydrateDailyDeal({
		world,
		artifact,
		packSlug: options.packSlug,
		gameRootEntity: gameRoot,
		boardEntity: board,
		selectionEntity: selection,
		timerEntity: timer,
		scoreCalcEntity: scoreCalc,
	})

	// ─── Systems ───────────────────────────────────────────────────────────────
	const executor = createMoveExecutor({
		eventsCenter,
		boardEntity: board,
		cardEntities: cards,
	})

	const input = createInputSystem({
		world,
		eventsCenter,
		boardEntity: board,
		selectionEntity: selection,
		timerEntity: timer,
		executor,
		now,
	})

	const stockCycle = createStockCycleSystem({
		world,
		eventsCenter,
		boardEntity: board,
		timerEntity: timer,
		cardEntities: cards,
		now,
	})

	const autoPlace = createAutoPlaceSystem({
		eventsCenter,
		boardEntity: board,
		executor,
	})

	const autoComplete = createAutoCompleteSystem({
		world,
		eventsCenter,
		boardEntity: board,
		executor,
		stepIntervalS: options.autoCompleteStepIntervalS,
	})

	const timerSystem = createTimerSystem(world)

	const winCheck = createWinCheckSystem({
		world,
		eventsCenter,
		timerEntity: timer,
		scoreCalcEntity: scoreCalc,
	})

	const streakUpdate = createStreakUpdateSystem(world, getDate)

	const save = createSaveSystem({
		world,
		store: options.saveStore,
		getContext: () => ({ packSlug: options.packSlug, date: getDate() }),
	})

	// Wire input listeners; they stay passive until events are dispatched.
	input.start()
	stockCycle.start()
	autoPlace.start()

	// Mark every MoveExecuted / StockCycled event as a save-dirty point.
	const unsubscribeMove = eventsCenter.addListener<MoveExecutedEventData>(
		MoveExecutedEventId,
		() => save.markDirty(),
	)
	const unsubscribeStock = eventsCenter.addListener<StockCycledEventData>(
		StockCycledEventId,
		() => save.markDirty(),
	)

	// Tick driver
	function tick(dt: number): void {
		eventsCenter.update(dt)
		timerSystem.update(dt)
		autoComplete.update(dt)
		winCheck.update()
		streakUpdate.update()
		save.update(dt)
	}

	function dispose(): void {
		input.stop()
		stockCycle.stop()
		autoPlace.stop()
		unsubscribeMove?.()
		unsubscribeStock?.()
	}

	// Flip from 'boot' to 'playing' — the boot scene can pause the tick if it
	// wants to hold the splash; the playing scene activates after.
	CGameState.phase[gameRoot.worldIndex][gameRoot.index] = 'playing'

	const entities: SolitaireWorldEntities = {
		gameRoot,
		board,
		selection,
		timer,
		streakTracker,
		scoreCalc,
		cards,
	}

	return {
		world,
		eventsCenter,
		entities,
		systems: {
			input,
			stockCycle,
			autoPlace,
			autoComplete,
			timer: timerSystem,
			winCheck,
			streakUpdate,
			save,
		},
		tick,
		dispose,
	}
}
