// Unit tests for buildDailyPack — deterministic daily rotation.
// Ensures same pack+date → same questions; different date → different
// shuffle when the pool is larger than questionCount.

import { describe, it, expect } from 'vitest'
import { buildDailyPack } from '../src/content-pack'
import type { ContentPack } from '../src/content-pack'

function q(id: string) {
	return {
		id,
		text: `Q ${id}`,
		options: ['a', 'b', 'c', 'd'] as [string, string, string, string],
		correctIndex: 0 as 0 | 1 | 2 | 3,
		category: 'history_geography' as const,
		difficulty: 'easy' as const,
		explanation: 'because',
		seed: 1,
	}
}

function makePack(seedQuestionsCount: number, questionCount = 10): ContentPack {
	const seedQuestions = Array.from({ length: seedQuestionsCount }, (_, i) => q(`q-${i}`))
	return {
		slug: 'test',
		publisherName: 'Test Publisher',
		regionName: 'Test Region',
		locale: 'en-US',
		timeZone: 'America/New_York',
		brand: { title: 'Test', shortName: 'Test' },
		palette: {
			bg: '#000', panel: '#111', text: '#fff', muted: '#888',
			accent: '#f00', accentAlt: '#0f0', correct: '#0f0',
			incorrect: '#f00', neutral: '#aaa', success: '#0f0',
		},
		theme: { motif: '', surface: '', uiTone: '' },
		dailyQuiz: {
			seedPrefix: 'lgs-trivia:test',
			questionCount,
			rolloverHour: 5,
			timerSeconds: 15,
		},
		questionPipeline: {
			rss_url: 'https://example.com/feed',
			seed_questions_path: 'content/test/seeds.json',
			question_categories: [{ category: 'history_geography', countPerDay: 10 }],
			freshFromRssTarget: 70,
			evergreenSeedTarget: 30,
		},
		share: { template: '' },
		leaderboard: { mode: 'off' },
		seedQuestions,
	}
}

describe('buildDailyPack: daily rotation', () => {
	it('is deterministic for the same pack + date', () => {
		const pack = makePack(30)
		const a = buildDailyPack(pack, '2026-05-12')
		const b = buildDailyPack(pack, '2026-05-12')
		expect(a.questions.map((x) => x.id)).toEqual(b.questions.map((x) => x.id))
	})

	it('returns questionCount questions when pool >= questionCount', () => {
		const pack = makePack(30, 10)
		const out = buildDailyPack(pack, '2026-05-12')
		expect(out.questions.length).toBe(10)
	})

	it('rotates the subset across days when pool > questionCount', () => {
		const pack = makePack(30, 10)
		const d1 = buildDailyPack(pack, '2026-05-12').questions.map((x) => x.id)
		const d2 = buildDailyPack(pack, '2026-05-13').questions.map((x) => x.id)
		expect(d1).not.toEqual(d2)
	})

	it('does not return duplicate questions on a given day', () => {
		const pack = makePack(30, 10)
		const out = buildDailyPack(pack, '2026-05-12')
		const ids = out.questions.map((q) => q.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('every question is drawn from the seed pool', () => {
		const pack = makePack(30, 10)
		const poolIds = new Set(pack.seedQuestions.map((q) => q.id))
		const out = buildDailyPack(pack, '2026-05-12')
		for (const q of out.questions) {
			expect(poolIds.has(q.id)).toBe(true)
		}
	})

	it('handles pool == questionCount by reordering (no variety, by definition)', () => {
		const pack = makePack(10, 10)
		const out = buildDailyPack(pack, '2026-05-12')
		expect(out.questions.length).toBe(10)
		// All ids present, possibly in different order.
		const ids = out.questions.map((q) => q.id).sort()
		const expected = pack.seedQuestions.map((q) => q.id).sort()
		expect(ids).toEqual(expected)
	})

	it('caps at seedQuestions.length when pool < questionCount', () => {
		const pack = makePack(5, 10)
		const out = buildDailyPack(pack, '2026-05-12')
		expect(out.questions.length).toBe(5)
	})

	it('different seedPrefix yields a different daily set', () => {
		const a = makePack(30, 10)
		const b = makePack(30, 10)
		b.dailyQuiz = { ...b.dailyQuiz, seedPrefix: 'lgs-trivia:other' }
		const outA = buildDailyPack(a, '2026-05-12').questions.map((x) => x.id)
		const outB = buildDailyPack(b, '2026-05-12').questions.map((x) => x.id)
		expect(outA).not.toEqual(outB)
	})

	it('stamps the requested date onto the output', () => {
		const pack = makePack(30)
		const out = buildDailyPack(pack, '2026-05-12')
		expect(out.date).toBe('2026-05-12')
	})

	it('preserves slug / publisher / region / timer / rollover from the pack', () => {
		const pack = makePack(30)
		const out = buildDailyPack(pack, '2026-05-12')
		expect(out.slug).toBe('test')
		expect(out.publisherName).toBe('Test Publisher')
		expect(out.regionName).toBe('Test Region')
		expect(out.timerSeconds).toBe(15)
		expect(out.rolloverHour).toBe(5)
	})
})
