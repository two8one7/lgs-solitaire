// Unit tests for migrate() — schema v1→v2 upgrade, partial-v2 fill, idempotency.
// No Pixi imports; pure-function coverage of the migrate utility.

import { describe, it, expect } from 'vitest'
import { migrate } from '../src/content-pack'
import type { ContentPack } from '../src/content-pack'

// --- Minimal v1-shaped pack fixture -----------------------------------------

function makeV1Pack(overrides: Partial<ContentPack> = {}): ContentPack {
  return {
    slug: 'test',
    publisherName: 'Test Publisher',
    regionName: 'Test Region',
    locale: 'en-US',
    timeZone: 'America/New_York',
    brand: { title: 'Test Trivia', shortName: 'Test Trivia' },
    palette: {
      bg: '#000000',
      panel: '#111111',
      text: '#ffffff',
      muted: '#888888',
      accent: '#ff0000',
      accentAlt: '#00ff00',
      correct: '#00ff00',
      incorrect: '#ff0000',
      neutral: '#aaaaaa',
      success: '#00ff00',
    },
    theme: {
      motif: 'test motif',
      surface: 'test surface',
      uiTone: 'test tone',
    },
    dailyQuiz: {
      seedPrefix: 'lgs-trivia:test',
      questionCount: 10,
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
    share: { template: 'I got {correct}/10!' },
    leaderboard: { mode: 'off' },
    seedQuestions: [],
    ...overrides,
  }
}

// --- Tests ------------------------------------------------------------------

describe('migrate()', () => {
  describe('v1 → v2 upgrade', () => {
    it('sets schemaVersion to 2', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.schemaVersion).toBe(2)
    })

    it('adds default juice block with no particles, no glows, no shake', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.juice).toBeDefined()
      expect(migrated.juice?.particles).toEqual({})
      expect(migrated.juice?.glows).toEqual({})
      expect(migrated.juice?.shake).toEqual({})
    })

    it('adds fade-only transitions as juice defaults', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.juice?.transitions?.questionEnter?.kind).toBe('fade')
      expect(migrated.juice?.transitions?.questionExit?.kind).toBe('fade')
    })

    it('adds default layout with stacked-vertical composition', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.layout).toBeDefined()
      expect(migrated.layout?.composition).toBe('stacked-vertical')
    })

    it('adds default answerGrid.shape of 2x2', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.layout?.slots?.answerGrid?.shape).toBe('2x2')
    })

    it('adds solid background by default', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.layout?.background?.kind).toBe('solid')
    })

    it('adds default personalityTheme with system-ui font stacks', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.typography?.headingStack).toBe('system-ui, sans-serif')
      expect(migrated.personalityTheme?.typography?.bodyStack).toBe('system-ui, sans-serif')
      expect(migrated.personalityTheme?.typography?.monoStack).toBe('ui-monospace, monospace')
    })

    it('leaves cornerRadius undefined when pack omits it (Phase 3 owns radius defaults at the call site)', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.shape?.cornerRadius).toBeUndefined()
    })

    it('leaves primitive undefined when pack omits it (Phase 3 token default = rounded behavior)', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.shape?.primitive).toBeUndefined()
    })

    it('sets durationMultiplier to 1.0 by default', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.motion?.durationMultiplier).toBe(1.0)
    })

    it('leaves easing undefined when pack omits it (Phase 3 owns per-class easing fallbacks)', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.motion?.easing).toBeUndefined()
    })

    it('adds empty motif by default (no motif assets)', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.motif).toEqual({})
    })

    it('sets vignette false by default', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.surface?.vignette).toBe(false)
    })

    it('sets all audio events to null (silent) by default', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      const events = migrated.audio?.events
      expect(events?.['answer.correct']).toBeNull()
      expect(events?.['answer.incorrect']).toBeNull()
      expect(events?.['ui.hover']).toBeNull()
      expect(events?.['ui.press']).toBeNull()
      expect(events?.['question.reveal']).toBeNull()
      expect(events?.['round.complete']).toBeNull()
    })

    it('sets music to null by default', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.audio?.music?.title).toBeNull()
      expect(migrated.audio?.music?.gameplay).toBeNull()
      expect(migrated.audio?.music?.complete).toBeNull()
    })

    it('preserves all existing non-personality fields byte-identical', () => {
      const pack = makeV1Pack()
      const migrated = migrate(pack)
      expect(migrated.slug).toBe(pack.slug)
      expect(migrated.publisherName).toBe(pack.publisherName)
      expect(migrated.palette).toEqual(pack.palette)
      expect(migrated.theme).toEqual(pack.theme)
      expect(migrated.dailyQuiz).toEqual(pack.dailyQuiz)
      expect(migrated.brand).toEqual(pack.brand)
    })
  })

  describe('partial v2 pack — fills missing defaults without clobbering explicit values', () => {
    it('keeps explicit composition override', () => {
      const pack = makeV1Pack({
        schemaVersion: 2,
        layout: { composition: 'masthead-classic' },
      })
      const migrated = migrate(pack)
      expect(migrated.layout?.composition).toBe('masthead-classic')
    })

    it('keeps explicit answerGrid.shape = 1x4', () => {
      const pack = makeV1Pack({
        schemaVersion: 2,
        layout: { slots: { answerGrid: { shape: '1x4' } } },
      })
      const migrated = migrate(pack)
      expect(migrated.layout?.slots?.answerGrid?.shape).toBe('1x4')
    })

    it('keeps explicit durationMultiplier; easing stays undefined when pack omits it', () => {
      const pack = makeV1Pack({
        schemaVersion: 2,
        personalityTheme: {
          motion: { durationMultiplier: 1.4 },
        },
      })
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.motion?.durationMultiplier).toBe(1.4)
      // Phase 3: easing fallbacks live at the call site; migrate doesn't fill them.
      expect(migrated.personalityTheme?.motion?.easing).toBeUndefined()
    })

    it('keeps explicit entrance easing; other easings stay undefined (call-site fallback)', () => {
      const pack = makeV1Pack({
        schemaVersion: 2,
        personalityTheme: {
          motion: {
            easing: { entrance: 'easeInOutQuart' },
          },
        },
      })
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.motion?.easing?.entrance).toBe('easeInOutQuart')
      expect(migrated.personalityTheme?.motion?.easing?.exit).toBeUndefined()
    })

    it('keeps explicit vignette: true', () => {
      const pack = makeV1Pack({
        schemaVersion: 2,
        personalityTheme: {
          surface: { vignette: true },
        },
      })
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.surface?.vignette).toBe(true)
    })

    it('keeps explicit audio event config', () => {
      const correctEvent = { sample: 'pack:test/chime.ogg', volume: 0.8 }
      const pack = makeV1Pack({
        schemaVersion: 2,
        audio: {
          events: { 'answer.correct': correctEvent },
        },
      })
      const migrated = migrate(pack)
      expect(migrated.audio?.events?.['answer.correct']).toEqual(correctEvent)
      // Other events still default to null
      expect(migrated.audio?.events?.['ui.hover']).toBeNull()
    })

    it('keeps explicit null audio event (no sound is an explicit choice)', () => {
      const pack = makeV1Pack({
        schemaVersion: 2,
        audio: {
          events: { 'answer.correct': null },
        },
      })
      const migrated = migrate(pack)
      expect(migrated.audio?.events?.['answer.correct']).toBeNull()
    })

    it('keeps explicit cornerRadius.md; other radii stay undefined (call-site token default)', () => {
      const pack = makeV1Pack({
        schemaVersion: 2,
        personalityTheme: {
          shape: { cornerRadius: { md: 16 } },
        },
      })
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.shape?.cornerRadius?.md).toBe(16)
      // Phase 3: unmentioned radii flow through getRadius() token defaults.
      expect(migrated.personalityTheme?.shape?.cornerRadius?.sm).toBeUndefined()
      expect(migrated.personalityTheme?.shape?.cornerRadius?.lg).toBeUndefined()
    })

    it('keeps primitive: sharp', () => {
      const pack = makeV1Pack({
        schemaVersion: 2,
        personalityTheme: { shape: { primitive: 'sharp' } },
      })
      const migrated = migrate(pack)
      expect(migrated.personalityTheme?.shape?.primitive).toBe('sharp')
    })
  })

  describe('idempotency — migrate(migrate(pack)) equals migrate(pack)', () => {
    it('is idempotent on a plain v1 pack', () => {
      const pack = makeV1Pack()
      const once = migrate(pack)
      const twice = migrate(once)
      expect(twice).toEqual(once)
    })

    it('is idempotent on a v2 pack with partial overrides', () => {
      const pack = makeV1Pack({
        schemaVersion: 2,
        layout: { composition: 'centered-editorial', slots: { answerGrid: { shape: '1x4' } } },
        personalityTheme: {
          motion: { durationMultiplier: 0.9, easing: { entrance: 'easeOutBack' } },
          shape: { primitive: 'sharp' },
        },
        audio: {
          events: { 'answer.correct': { sample: 'pack:x/ding.ogg', volume: 0.9 } },
          mix: { master: 0.8 },
        },
      })
      const once = migrate(pack)
      const twice = migrate(once)
      expect(twice).toEqual(once)
    })

    it('schemaVersion stays 2 after double migration', () => {
      const pack = makeV1Pack()
      const migrated = migrate(migrate(pack))
      expect(migrated.schemaVersion).toBe(2)
    })
  })

  // Phase 4.5 — texturePath round-trip and curtain-wipe schema validation.
  describe('Phase 4.5 — texturePath + curtain-wipe', () => {
    it('texturePath on ParticleConfig round-trips through migrate() unchanged', () => {
      const pack = makeV1Pack({
        juice: {
          particles: {
            correct: { count: 10, texturePath: '/assets/star.svg' },
          },
        },
      })
      const migrated = migrate(pack)
      expect(migrated.juice?.particles?.correct?.texturePath).toBe('/assets/star.svg')
    })

    it('texturePath is undefined when pack omits it (no default injected)', () => {
      const pack = makeV1Pack({
        juice: {
          particles: {
            correct: { count: 5 },
          },
        },
      })
      const migrated = migrate(pack)
      expect(migrated.juice?.particles?.correct?.texturePath).toBeUndefined()
    })

    it("TransitionConfig accepts kind 'curtain-wipe' with texturePath", () => {
      const pack = makeV1Pack({
        juice: {
          transitions: {
            questionEnter: { kind: 'curtain-wipe', texturePath: '/curtain.svg', ms: 500 },
          },
        },
      })
      const migrated = migrate(pack)
      const enter = migrated.juice?.transitions?.questionEnter
      expect(enter?.kind).toBe('curtain-wipe')
      expect(enter?.texturePath).toBe('/curtain.svg')
      expect(enter?.ms).toBe(500)
    })

    it("TransitionConfig accepts kind 'curtain-wipe' without texturePath (uses WHITE fallback)", () => {
      const pack = makeV1Pack({
        juice: {
          transitions: {
            questionEnter: { kind: 'curtain-wipe', ms: 300 },
          },
        },
      })
      const migrated = migrate(pack)
      const enter = migrated.juice?.transitions?.questionEnter
      expect(enter?.kind).toBe('curtain-wipe')
      expect(enter?.texturePath).toBeUndefined()
    })

    it('texturePath on TransitionConfig round-trips through migrate() unchanged', () => {
      const pack = makeV1Pack({
        juice: {
          transitions: {
            questionExit: { kind: 'curtain-wipe', texturePath: '/velvet.svg' },
          },
        },
      })
      const migrated = migrate(pack)
      expect(migrated.juice?.transitions?.questionExit?.texturePath).toBe('/velvet.svg')
    })

    it("idempotent on pack with 'curtain-wipe' transitions", () => {
      const pack = makeV1Pack({
        juice: {
          transitions: {
            questionEnter: { kind: 'curtain-wipe', texturePath: '/curtain.svg' },
          },
          particles: {
            correct: { count: 8, texturePath: '/burst.svg' },
          },
        },
      })
      const once = migrate(pack)
      const twice = migrate(once)
      expect(twice).toEqual(once)
    })
  })
})
