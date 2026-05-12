/**
 * Question-record and daily-pack types.
 *
 * Lives in the package because the pack schema references them. Trivia
 * (or future games that use this schema shape) re-exports these from its
 * own `types.ts` so existing call sites keep working.
 */

export type QuestionCategory =
	| 'history_geography'
	| 'businesses_schools'
	| 'sports'
	| 'current_events'
	| 'local_culture'
	| 'ballet_basics'
	| 'technique'
	| 'body_health'
	| 'programs_features'
	| 'culture_history'

export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

/** A single question as stored in the daily quiz pack */
export type QuestionRecord = {
	id: string
	text: string
	options: [string, string, string, string]
	/** 0–3 index into options[] for the correct answer */
	correctIndex: 0 | 1 | 2 | 3
	category: QuestionCategory
	difficulty: QuestionDifficulty
	explanation: string
	seed: number
}

/** The daily quiz pack passed to daily-puzzle-hydration */
export type DailyQuizPackData = {
	slug: string
	publisherName: string
	regionName: string
	/** YYYY-MM-DD — the date this pack was generated for */
	date: string
	timerSeconds: number
	rolloverHour: number
	questions: QuestionRecord[]
}
