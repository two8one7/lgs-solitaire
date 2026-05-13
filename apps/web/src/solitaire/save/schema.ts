/**
 * Local-save schema for Solitaire daily-streak + best-time record.
 *
 * Key prefix `lgs-solitaire:` (sibling to lgs-memory:, lgs-trivia:). One save
 * per (packSlug, mode, date). Stale prune lands in Phase 3c.
 *
 * Mirrors lgs-memory/save/schema.ts shape; bestTimeMs is a single number
 * (no daily/challenge split — Solitaire v1 is daily-only).
 */

import type { SolitaireSaveSlot } from '../types'

export const SAVE_SCHEMA_VERSION = 1

export type SaveState = {
	v: number
	packSlug: string
	/** YYYY-MM-DD. */
	date: string
	/** 'daily' for v1. */
	mode: string
	completed: boolean
	/** Final completion time in ms (0 if mid-session). */
	playerTimeMs: number
	/** Signed delta vs par in ms. */
	timeDeltaMs: number
	movesCount: number
	currentStreak: number
	bestStreak: number
	lastCompletedDate: string
	bestTimeMs: number
	updatedAt: number
}

const SAVE_KEY_PREFIX = 'lgs-solitaire:'

export function saveKey(packSlug: string, date: string, mode: string): string {
	return `${SAVE_KEY_PREFIX}${packSlug}:${mode}:${date}`
}

export function isSaveKey(key: string): boolean {
	return key.startsWith(SAVE_KEY_PREFIX)
}

export function isSaveState(value: unknown): value is SaveState {
	if (typeof value !== 'object' || value === null) return false
	const v = value as Record<string, unknown>
	if (v.v !== SAVE_SCHEMA_VERSION) return false
	if (typeof v.packSlug !== 'string' || v.packSlug.length === 0) return false
	if (typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return false
	if (typeof v.mode !== 'string') return false
	if (typeof v.completed !== 'boolean') return false
	if (typeof v.playerTimeMs !== 'number' || v.playerTimeMs < 0) return false
	if (typeof v.timeDeltaMs !== 'number') return false
	if (typeof v.movesCount !== 'number' || v.movesCount < 0) return false
	if (typeof v.currentStreak !== 'number' || v.currentStreak < 0) return false
	if (typeof v.bestStreak !== 'number' || v.bestStreak < 0) return false
	if (typeof v.lastCompletedDate !== 'string') return false
	if (typeof v.bestTimeMs !== 'number' || v.bestTimeMs < 0) return false
	if (typeof v.updatedAt !== 'number') return false
	return true
}

export function hydrateSlotFromSave(state: SaveState): SolitaireSaveSlot {
	const slot: SolitaireSaveSlot = {
		completedDates: {},
		currentStreak: state.currentStreak,
		bestStreak: state.bestStreak,
		lastCompletedDate: state.lastCompletedDate,
		bestTimeMs: state.bestTimeMs,
	}
	if (state.completed) slot.completedDates[state.date] = true
	return slot
}
