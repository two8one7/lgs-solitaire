/**
 * Resilient localStorage-backed SaveStore for Solitaire.
 *
 * Adapted verbatim from lgs-memory/save/store.ts. The shape stays identical
 * across LGS games — the only thing that differs is the key prefix in
 * schema.ts and the SaveState fields.
 *
 * Falls back to an in-memory Map on any storage quota / access throw. Never
 * propagates exceptions to the caller.
 */

import { isSaveState, type SaveState, saveKey } from './schema'

export interface StorageLike {
	readonly length: number
	key(index: number): string | null
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}

export function createResilientStorage(storage: StorageLike): StorageLike {
	const memory = new Map<string, string>()
	let fallingBack = false

	function readMemoryKey(index: number): string | null {
		return Array.from(memory.keys())[index] ?? null
	}

	return {
		get length(): number {
			if (fallingBack) return memory.size
			try {
				return storage.length
			} catch {
				fallingBack = true
				return memory.size
			}
		},
		key(index: number): string | null {
			if (fallingBack) return readMemoryKey(index)
			try {
				return storage.key(index)
			} catch {
				fallingBack = true
				return readMemoryKey(index)
			}
		},
		getItem(key: string): string | null {
			if (fallingBack) return memory.get(key) ?? null
			try {
				const value = storage.getItem(key)
				if (value !== null) return value
				return memory.get(key) ?? null
			} catch {
				fallingBack = true
				return memory.get(key) ?? null
			}
		},
		setItem(key: string, value: string): void {
			if (fallingBack) {
				memory.set(key, value)
				return
			}
			try {
				storage.setItem(key, value)
			} catch (err) {
				fallingBack = true
				memory.set(key, value)
				// eslint-disable-next-line no-console
				console.warn(
					'[solitaire-save-store] localStorage unavailable, using memory fallback:',
					err,
				)
			}
		},
		removeItem(key: string): void {
			if (fallingBack) {
				memory.delete(key)
				return
			}
			try {
				storage.removeItem(key)
			} catch {
				fallingBack = true
			}
			memory.delete(key)
		},
	}
}

export type SaveStore = {
	read: (packSlug: string, date: string, mode: string) => SaveState | null
	write: (state: SaveState) => boolean
	remove: (packSlug: string, date: string, mode: string) => void
	keys: () => string[]
}

export function createSaveStore(storage: StorageLike): SaveStore {
	function read(packSlug: string, date: string, mode: string): SaveState | null {
		const key = saveKey(packSlug, date, mode)
		const raw = storage.getItem(key)
		if (raw === null) return null
		try {
			const parsed = JSON.parse(raw)
			if (!isSaveState(parsed)) {
				storage.removeItem(key)
				return null
			}
			return parsed
		} catch {
			storage.removeItem(key)
			return null
		}
	}

	function write(state: SaveState): boolean {
		const key = saveKey(state.packSlug, state.date, state.mode)
		try {
			storage.setItem(key, JSON.stringify(state))
			return true
		} catch (err) {
			// eslint-disable-next-line no-console
			console.warn('[solitaire-save-store] write failed:', err)
			return false
		}
	}

	function remove(packSlug: string, date: string, mode: string): void {
		storage.removeItem(saveKey(packSlug, date, mode))
	}

	function keys(): string[] {
		const out: string[] = []
		for (let i = 0; i < storage.length; i++) {
			const k = storage.key(i)
			if (k !== null) out.push(k)
		}
		return out
	}

	return { read, write, remove, keys }
}
