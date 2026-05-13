/**
 * Fetch the daily-deal JSON artifact for (packSlug, date).
 *
 * Path convention: /daily/<packSlug>/klondike-draw-1/<yyyy-mm-dd>.json
 * Falls back to /daily/<packSlug>/klondike-draw-1/default.json if the dated
 * artifact 404s. Phase 3b/4 daily-bake CLI writes to the dated path.
 *
 * No Pixi. Returns a typed DailyDealArtifact ready for hydration.
 */

export interface DailyDealArtifact {
	date: string
	drawSize: 1 | 3
	/** "2D,12C,..." deck string — 52 cards. */
	deck: string
	type: 'klondike-1' | 'klondike-3'
	parTimeSeconds: number
	source?: string
}

export class BuildDailyDealError extends Error {}

const KLONDIKE_TYPES = new Set(['klondike-1', 'klondike-3'])

export function validateDailyDeal(raw: unknown): DailyDealArtifact {
	if (typeof raw !== 'object' || raw === null) {
		throw new BuildDailyDealError('daily deal: expected object')
	}
	const v = raw as Record<string, unknown>
	if (typeof v.date !== 'string' || v.date.length === 0) {
		throw new BuildDailyDealError('daily deal: missing date')
	}
	if (v.drawSize !== 1 && v.drawSize !== 3) {
		throw new BuildDailyDealError(`daily deal: drawSize must be 1 or 3, got ${String(v.drawSize)}`)
	}
	if (typeof v.deck !== 'string' || v.deck.length === 0) {
		throw new BuildDailyDealError('daily deal: missing deck')
	}
	if (typeof v.type !== 'string' || !KLONDIKE_TYPES.has(v.type)) {
		throw new BuildDailyDealError(`daily deal: bad type '${String(v.type)}'`)
	}
	if (typeof v.parTimeSeconds !== 'number' || v.parTimeSeconds <= 0) {
		throw new BuildDailyDealError('daily deal: bad parTimeSeconds')
	}
	return {
		date: v.date,
		drawSize: v.drawSize as 1 | 3,
		deck: v.deck,
		type: v.type as 'klondike-1' | 'klondike-3',
		parTimeSeconds: v.parTimeSeconds,
		source: typeof v.source === 'string' ? v.source : undefined,
	}
}

export type FetchDailyDealOptions = {
	packSlug: string
	date: string
	/** Defaults to global `fetch`; injectable for tests. */
	fetcher?: typeof fetch
}

export async function fetchDailyDeal(opts: FetchDailyDealOptions): Promise<DailyDealArtifact> {
	const f = opts.fetcher ?? globalThis.fetch
	const base = `/daily/${encodeURIComponent(opts.packSlug)}/klondike-draw-1`
	const dated = `${base}/${encodeURIComponent(opts.date)}.json`
	const fallback = `${base}/default.json`

	const tryRead = async (url: string): Promise<DailyDealArtifact | null> => {
		const res = await f(url)
		if (!res.ok) return null
		const json = await res.json()
		return validateDailyDeal(json)
	}

	const datedResult = await tryRead(dated).catch(() => null)
	if (datedResult !== null) return datedResult
	const fallbackResult = await tryRead(fallback).catch(() => null)
	if (fallbackResult !== null) return fallbackResult
	throw new BuildDailyDealError(
		`daily deal: neither ${dated} nor ${fallback} resolved`,
	)
}
