/**
 * Public surface for the solitaire save module.
 *
 * Mirrors lgs-memory/save/index.ts split: schema + store cover storage;
 * this file owns pure helpers (createInMemorySave, markCompleted,
 * computeNewStreak, updateBestTime) consumed by save-system + streak-update.
 *
 * No DOM / Pixi. Headlessly testable.
 */

import type { SolitaireSaveSlot } from '../types'

export * from './schema'
export * from './store'

export function createInMemorySave(): SolitaireSaveSlot {
	return {
		completedDates: {},
		currentStreak: 0,
		bestStreak: 0,
		lastCompletedDate: '',
		bestTimeMs: 0,
	}
}

export function markCompleted(save: SolitaireSaveSlot, date: string): void {
	save.completedDates[date] = true
}

export function hasCompletedDate(save: SolitaireSaveSlot, date: string): boolean {
	return save.completedDates[date] === true
}

/**
 * GDD §"Daily streak":
 *   - Today === lastCompletedDate → idempotent, returns existing.
 *   - Today follows lastCompletedDate by one day → increment.
 *   - Otherwise → reset to 1.
 */
export function computeNewStreak(
	save: SolitaireSaveSlot,
	today: string,
): { newStreak: number; newBestStreak: number } {
	if (save.lastCompletedDate === today) {
		return { newStreak: save.currentStreak, newBestStreak: save.bestStreak }
	}
	const newStreak = isConsecutiveDay(save.lastCompletedDate, today)
		? save.currentStreak + 1
		: 1
	const newBestStreak = Math.max(save.bestStreak, newStreak)
	return { newStreak, newBestStreak }
}

export function isConsecutiveDay(base: string, candidate: string): boolean {
	if (!base) return false
	const baseMs = Date.parse(`${base}T00:00:00Z`)
	const candidateMs = Date.parse(`${candidate}T00:00:00Z`)
	if (!Number.isFinite(baseMs) || !Number.isFinite(candidateMs)) return false
	const oneDayMs = 24 * 60 * 60 * 1000
	return candidateMs - baseMs === oneDayMs
}

/** Update bestTime if `playerTimeMs` improves (0 = no prior record). */
export function updateBestTime(save: SolitaireSaveSlot, playerTimeMs: number): void {
	if (save.bestTimeMs === 0 || playerTimeMs < save.bestTimeMs) {
		save.bestTimeMs = playerTimeMs
	}
}
