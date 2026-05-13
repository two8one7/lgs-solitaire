/**
 * save-system — persists per-day Solitaire progress to localStorage.
 *
 * Two write triggers (mirrors memory's save-system):
 *   1. markDirty() — fired on every move executed + on win-check completion.
 *      Debounced so a flurry of taps coalesces into one write after DEBOUNCE_MS.
 *   2. update(dt) — fired every frame. Writes on a TICK_INTERVAL_S cadence so
 *      mid-session progress survives even if the player stares at the board.
 *
 * flush() writes synchronously regardless of debounce — used on visibility
 * loss and pagehide so progress survives a tab close mid-move.
 *
 * No Pixi imports.
 *
 * ECS review notes:
 *   AP-28 ✓ — update(dt) is in SECONDS.
 */

import { createQuery } from '@2817/ecs'
import type { IWorld } from '@2817/ecs'
import {
	CBestStreak,
	CCompletedFlag,
	CCurrentStreak,
	CLastCompletedDate,
	CMovesCount,
	CPlayerTimeMs,
	CSaveSlot,
	CTimeDeltaMs,
	CTimeElapsedMs,
	CBoardState,
} from '../components'
import { SAVE_SCHEMA_VERSION, type SaveState } from '../save/schema'
import type { SaveStore } from '../save/store'
import type { SolitaireSaveSlot } from '../types'

const DEBOUNCE_MS = 500
const TICK_INTERVAL_S = 10

export type SaveSystemDeps = {
	world: IWorld
	store: SaveStore
	getContext: () => { packSlug: string; date: string }
}

export type SaveSystem = {
	markDirty: () => void
	update: (dtSeconds: number) => void
	flush: () => void
	getWriteCount: () => number
}

export function createSaveSystem(deps: SaveSystemDeps): SaveSystem {
	const { world, store } = deps

	const boardQ = createQuery(world, { with: [CBoardState, CMovesCount] })
	const completedQ = createQuery(world, { with: [CBoardState, CCompletedFlag] })
	const streakQ = createQuery(world, {
		with: [CCurrentStreak, CBestStreak, CLastCompletedDate],
	})
	const saveSlotQ = createQuery(world, { with: [CSaveSlot] })
	const timerQ = createQuery(world, { with: [CTimeElapsedMs] })
	const scoreCalcQ = createQuery(world, { with: [CPlayerTimeMs, CTimeDeltaMs] })

	let dirtyAt: number | null = null
	let tickAccum = 0
	let writeCount = 0

	function snapshot(): SaveState | null {
		const ctx = deps.getContext()
		const boards = boardQ()
		if (boards.length === 0) return null

		const board = boards[0]!
		const bWi = board.worldIndex
		const bIdx = board.index
		const movesCount = (CMovesCount.value[bWi][bIdx] as number) ?? 0
		const completed = completedQ().some((e) => e.id === board.id)

		let currentStreak = 0
		let bestStreak = 0
		let lastCompletedDate = ''
		const streaks = streakQ()
		if (streaks.length > 0) {
			const s = streaks[0]!
			currentStreak = Number(CCurrentStreak.value[s.worldIndex][s.index]) || 0
			bestStreak = Number(CBestStreak.value[s.worldIndex][s.index]) || 0
			lastCompletedDate = String(CLastCompletedDate.value[s.worldIndex][s.index] ?? '')
		}

		let bestTimeMs = 0
		const saves = saveSlotQ()
		if (saves.length > 0) {
			const e = saves[0]!
			const data = CSaveSlot.data[e.worldIndex][e.index] as SolitaireSaveSlot | undefined
			bestTimeMs = data?.bestTimeMs ?? 0
		}

		const timers = timerQ()
		const scores = scoreCalcQ()
		let playerTimeMs = 0
		let timeDeltaMs = 0
		if (completed && scores.length > 0) {
			const sc = scores[0]!
			playerTimeMs = Number(CPlayerTimeMs.value[sc.worldIndex][sc.index]) || 0
			timeDeltaMs = Number(CTimeDeltaMs.value[sc.worldIndex][sc.index]) || 0
		} else if (!completed && timers.length > 0) {
			const t = timers[0]!
			playerTimeMs = Number(CTimeElapsedMs.value[t.worldIndex][t.index]) || 0
		}

		return {
			v: SAVE_SCHEMA_VERSION,
			packSlug: ctx.packSlug,
			date: ctx.date,
			mode: 'daily',
			completed,
			playerTimeMs,
			timeDeltaMs,
			movesCount,
			currentStreak,
			bestStreak,
			lastCompletedDate,
			bestTimeMs,
			updatedAt: Date.now(),
		}
	}

	function write(): void {
		const state = snapshot()
		if (state === null) return
		store.write(state)
		writeCount++
		dirtyAt = null
		tickAccum = 0
	}

	function markDirty(): void {
		dirtyAt = Date.now()
	}

	function update(dtSeconds: number): void {
		tickAccum += dtSeconds
		if (dirtyAt !== null && Date.now() - dirtyAt >= DEBOUNCE_MS) {
			write()
			return
		}
		if (tickAccum >= TICK_INTERVAL_S) {
			write()
		}
	}

	function flush(): void {
		write()
	}

	return { markDirty, update, flush, getWriteCount: () => writeCount }
}
