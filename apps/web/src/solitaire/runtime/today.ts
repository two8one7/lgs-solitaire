/**
 * Resolve the current "play day" in the publisher's timezone as YYYY-MM-DD.
 *
 * Pack's `dailyMatch.rolloverHour` shifts the boundary (e.g. 4 → day rolls
 * at 4am local). Pure-ish: depends on `new Date()`, injectable via `now`.
 *
 * Verbatim from lgs-memory/runtime/today.ts — the play-day rollover is a
 * cross-game concern; promotion to a shared @lgs/* helper is a Phase 4 todo.
 */

export type TodayDeps = {
	timeZone: string
	rolloverHour?: number
	now?: () => Date
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad2(n: number): string {
	return n.toString().padStart(2, '0')
}

function isoDateInZone(date: Date, timeZone: string): string {
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
	const parts = fmt.formatToParts(date)
	const y = parts.find((p) => p.type === 'year')?.value ?? '0000'
	const m = parts.find((p) => p.type === 'month')?.value ?? '01'
	const d = parts.find((p) => p.type === 'day')?.value ?? '01'
	return `${y}-${m}-${d}`
}

function hourInZone(date: Date, timeZone: string): number {
	const fmt = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		hour: '2-digit',
		hour12: false,
	})
	const h = fmt.format(date)
	const n = parseInt(h, 10)
	return Number.isFinite(n) ? n : 0
}

export function todayInZone(deps: TodayDeps): string {
	const now = (deps.now ?? (() => new Date()))()
	const rollover = deps.rolloverHour ?? 0
	const hour = hourInZone(now, deps.timeZone)
	const ymd = isoDateInZone(now, deps.timeZone)
	if (hour >= rollover) return ymd

	const m = ISO_DATE_RE.exec(ymd)
	if (m === null) return ymd
	const utc = Date.UTC(parseInt(m[1]!, 10), parseInt(m[2]!, 10) - 1, parseInt(m[3]!, 10))
	const prior = new Date(utc - 24 * 60 * 60 * 1000)
	return `${prior.getUTCFullYear()}-${pad2(prior.getUTCMonth() + 1)}-${pad2(prior.getUTCDate())}`
}
