/**
 * streak-update — bumps the daily streak when the Board lands CompletedFlag.
 *
 * Runs each tick; fires once per CompletedFlag-bearing Board. Updates
 * CurrentStreak / BestStreak / LastCompletedDate components, mirrors them
 * into the SaveSlot data, marks the date completed, and updates bestTime.
 *
 * No Pixi imports.
 */

import { createQuery } from '@2817/ecs'
import type { IWorld } from '@2817/ecs'
import {
	CBestStreak,
	CCompletedFlag,
	CCurrentStreak,
	CLastCompletedDate,
	CPlayerTimeMs,
	CSaveSlot,
	CDailyDealRef,
} from '../components'
import { computeNewStreak, markCompleted, updateBestTime } from '../save'
import type { SolitaireSaveSlot } from '../types'

export function createStreakUpdateSystem(world: IWorld, getDate: () => string) {
	const completedQ = createQuery(world, { with: [CCompletedFlag] })
	const streakQ = createQuery(world, {
		with: [CCurrentStreak, CBestStreak, CLastCompletedDate],
	})
	const saveSlotQ = createQuery(world, { with: [CSaveSlot, CDailyDealRef] })
	const scoreCalcQ = createQuery(world, { with: [CPlayerTimeMs] })

	let lastProcessedIndex = -1

	function update(): void {
		const completed = completedQ()
		if (completed.length === 0) return
		const streaks = streakQ()
		if (streaks.length === 0) return
		const saveSlots = saveSlotQ()
		if (saveSlots.length === 0) return
		const scoreCalcs = scoreCalcQ()
		if (scoreCalcs.length === 0) return

		const board = completed[0]!
		if (board.index === lastProcessedIndex) return
		lastProcessedIndex = board.index

		const today = getDate()

		const saveEntity = saveSlots[0]!
		const svWi = saveEntity.worldIndex
		const svIdx = saveEntity.index
		const saveData = (CSaveSlot.data[svWi][svIdx] as SolitaireSaveSlot | undefined) ?? {
			completedDates: {},
			currentStreak: 0,
			bestStreak: 0,
			lastCompletedDate: '',
			bestTimeMs: 0,
		}

		// Update best-time from final score.
		const sc = scoreCalcs[0]!
		const playerTimeMs = (CPlayerTimeMs.value[sc.worldIndex][sc.index] as number) ?? 0
		if (playerTimeMs > 0) updateBestTime(saveData, playerTimeMs)

		// Streak bookkeeping.
		const streakEntity = streaks[0]!
		const stWi = streakEntity.worldIndex
		const stIdx = streakEntity.index
		const snapshot: SolitaireSaveSlot = {
			completedDates: saveData.completedDates ?? {},
			currentStreak: (CCurrentStreak.value[stWi][stIdx] as number) ?? 0,
			bestStreak: (CBestStreak.value[stWi][stIdx] as number) ?? 0,
			lastCompletedDate: (CLastCompletedDate.value[stWi][stIdx] as string) ?? '',
			bestTimeMs: saveData.bestTimeMs,
		}
		const { newStreak, newBestStreak } = computeNewStreak(snapshot, today)

		CCurrentStreak.value[stWi][stIdx] = newStreak
		CBestStreak.value[stWi][stIdx] = newBestStreak
		CLastCompletedDate.value[stWi][stIdx] = today

		saveData.currentStreak = newStreak
		saveData.bestStreak = newBestStreak
		saveData.lastCompletedDate = today
		markCompleted(saveData, today)

		CSaveSlot.data[svWi][svIdx] = saveData
	}

	return { update }
}
