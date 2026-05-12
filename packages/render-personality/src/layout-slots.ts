// Layout slot system — maps a content pack's layout declaration to named
// canvas regions. Render systems read by region name; they never branch on
// publisher slug or composition mode.
//
// SlotMap is the output consumed by computeLayout (which derives the fine-
// grained answer[0..3] rects from the answerGrid slot).
//
// Composition modes and default constants are kept in sync with the hardcoded
// values that `computeLayout` used before Phase 2 so that packs with no
// layout overrides produce byte-identical geometry.

import type { ContentPack, LayoutBlock, SlotConfig } from '@lgs/content-pack'

// ─── Types ─────────────────────────────────────────────────────────────────

/** Named canvas region: position + size in CSS pixels. */
export type Rect = { x: number; y: number; w: number; h: number }

/** All named regions for one canvas size + pack combination. */
export type SlotMap = {
  header: Rect
  questionBlock: Rect
  answerGrid: Rect
  timerBar: Rect
  footer: Rect
  /** The answerGrid.shape resolved from the pack (never "which publisher"). */
  answerShape: '2x2' | '1x4' | '4x1'
  /** Background kind resolved from the pack. */
  backgroundKind: 'solid' | 'gradient' | 'vignette' | 'textureTile' | 'motif'
  /** Resolved padding around the layout column. */
  pad: number
}

// ─── Default constants (must match the pre-Phase-2 computeLayout values) ───

const DEFAULT_PAD = 16
const DEFAULT_HUD_H = 64
const DEFAULT_TIMER_H = 28
const DEFAULT_ANSWER_GAP = 12
const DEFAULT_MIN_QUESTION_H = 120
const DEFAULT_MIN_ANSWER_GRID_H = 200
const DEFAULT_MAX_BLOCK_W = 720

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Resolve a per-slot config value with a fallback default. */
function slotH(cfg: SlotConfig | undefined, defaultH: number): number {
  return cfg?.height ?? defaultH
}

function slotPad(cfg: SlotConfig | undefined, defaultPad: number): number {
  return cfg?.padding ? cfg.padding[1] : defaultPad
}

// ─── Composition implementations ────────────────────────────────────────────

/**
 * stacked-vertical — the default. Stack top-to-bottom: header, timerBar,
 * questionBlock, answerGrid. Matches the pre-Phase-2 computeLayout geometry
 * exactly when no slot overrides are present.
 */
function stackedVertical(
  layout: LayoutBlock,
  canvasW: number,
  canvasH: number,
): SlotMap {
  const slots = layout.slots ?? {}
  const pad = DEFAULT_PAD
  const maxW = slots.questionBlock?.maxWidth ?? DEFAULT_MAX_BLOCK_W

  const blockW = Math.min(canvasW - pad * 2, maxW)
  const blockX = Math.floor((canvasW - blockW) / 2)

  const hudH = slotH(slots.header, DEFAULT_HUD_H)
  const timerH = slotH(slots.timerBar, DEFAULT_TIMER_H)

  // Remaining vertical space splits ~2:5 question:answers, same logic as
  // the original computeLayout so defaults produce identical geometry.
  const chromeH = hudH + timerH + pad * 4
  const remaining = Math.max(DEFAULT_MIN_QUESTION_H + DEFAULT_MIN_ANSWER_GRID_H, canvasH - chromeH)
  let questionH = Math.max(DEFAULT_MIN_QUESTION_H, Math.floor(remaining * (2 / 7)))
  let answersH = Math.max(DEFAULT_MIN_ANSWER_GRID_H, remaining - questionH)
  if (questionH + answersH > remaining) {
    questionH = Math.max(DEFAULT_MIN_QUESTION_H, remaining - DEFAULT_MIN_ANSWER_GRID_H)
    answersH = remaining - questionH
  }

  const blockH = hudH + pad + timerH + pad + questionH + pad + answersH
  const blockTop = Math.max(pad, Math.floor((canvasH - blockH) / 2))

  const headerY = blockTop
  const timerY = blockTop + hudH + pad
  const questionY = timerY + timerH + pad
  const answersY = questionY + questionH + pad

  // Footer: whatever remains below the answer grid (may be zero height).
  const footerY = answersY + answersH
  const footerH = Math.max(0, canvasH - footerY - pad)

  return {
    header: { x: blockX, y: headerY, w: blockW, h: hudH },
    timerBar: { x: blockX, y: timerY, w: blockW, h: timerH },
    questionBlock: { x: blockX, y: questionY, w: blockW, h: questionH },
    answerGrid: { x: blockX, y: answersY, w: blockW, h: answersH },
    footer: { x: blockX, y: footerY, w: blockW, h: footerH },
    answerShape: slots.answerGrid?.shape ?? '2x2',
    backgroundKind: layout.background?.kind ?? 'solid',
    pad,
  }
}

/**
 * centered-editorial — tighter max-width and increased padding give a
 * magazine / editorial-program feel (e.g. Broche Ballet).
 */
function centeredEditorial(
  layout: LayoutBlock,
  canvasW: number,
  canvasH: number,
): SlotMap {
  const slots = layout.slots ?? {}
  const pad = slotPad(slots.questionBlock, DEFAULT_PAD + 12)
  const maxW = slots.questionBlock?.maxWidth ?? 640

  const blockW = Math.min(canvasW - pad * 2, maxW)
  const blockX = Math.floor((canvasW - blockW) / 2)

  const hudH = slotH(slots.header, DEFAULT_HUD_H)
  const timerH = slotH(slots.timerBar, DEFAULT_TIMER_H)

  const chromeH = hudH + timerH + pad * 4
  const remaining = Math.max(DEFAULT_MIN_QUESTION_H + DEFAULT_MIN_ANSWER_GRID_H, canvasH - chromeH)
  let questionH = Math.max(DEFAULT_MIN_QUESTION_H, Math.floor(remaining * (2 / 7)))
  let answersH = Math.max(DEFAULT_MIN_ANSWER_GRID_H, remaining - questionH)
  if (questionH + answersH > remaining) {
    questionH = Math.max(DEFAULT_MIN_QUESTION_H, remaining - DEFAULT_MIN_ANSWER_GRID_H)
    answersH = remaining - questionH
  }

  const blockH = hudH + pad + timerH + pad + questionH + pad + answersH
  const blockTop = Math.max(pad, Math.floor((canvasH - blockH) / 2))

  const headerY = blockTop
  const timerY = blockTop + hudH + pad
  const questionY = timerY + timerH + pad
  const answersY = questionY + questionH + pad
  const footerY = answersY + answersH
  const footerH = Math.max(0, canvasH - footerY - pad)

  return {
    header: { x: blockX, y: headerY, w: blockW, h: hudH },
    timerBar: { x: blockX, y: timerY, w: blockW, h: timerH },
    questionBlock: { x: blockX, y: questionY, w: blockW, h: questionH },
    answerGrid: { x: blockX, y: answersY, w: blockW, h: answersH },
    footer: { x: blockX, y: footerY, w: blockW, h: footerH },
    answerShape: slots.answerGrid?.shape ?? '2x2',
    backgroundKind: layout.background?.kind ?? 'solid',
    pad,
  }
}

/**
 * masthead-classic — full-width header band at top, content column below
 * (wide, like a broadsheet column). Suits West Orange / Observer.
 */
function mastheadClassic(
  layout: LayoutBlock,
  canvasW: number,
  canvasH: number,
): SlotMap {
  const slots = layout.slots ?? {}
  const pad = DEFAULT_PAD
  const maxW = slots.questionBlock?.maxWidth ?? 760

  const blockW = Math.min(canvasW - pad * 2, maxW)
  const blockX = Math.floor((canvasW - blockW) / 2)

  // Masthead header spans full canvas width.
  const hudH = slotH(slots.header, DEFAULT_HUD_H)
  const timerH = slotH(slots.timerBar, DEFAULT_TIMER_H)

  const chromeH = hudH + timerH + pad * 4
  const remaining = Math.max(DEFAULT_MIN_QUESTION_H + DEFAULT_MIN_ANSWER_GRID_H, canvasH - chromeH)
  let questionH = Math.max(DEFAULT_MIN_QUESTION_H, Math.floor(remaining * (2 / 7)))
  let answersH = Math.max(DEFAULT_MIN_ANSWER_GRID_H, remaining - questionH)
  if (questionH + answersH > remaining) {
    questionH = Math.max(DEFAULT_MIN_QUESTION_H, remaining - DEFAULT_MIN_ANSWER_GRID_H)
    answersH = remaining - questionH
  }

  const blockH = hudH + pad + timerH + pad + questionH + pad + answersH
  const blockTop = Math.max(pad, Math.floor((canvasH - blockH) / 2))

  const headerY = blockTop
  const timerY = blockTop + hudH + pad
  const questionY = timerY + timerH + pad
  const answersY = questionY + questionH + pad
  const footerY = answersY + answersH
  const footerH = Math.max(0, canvasH - footerY - pad)

  return {
    // Header at full canvas width (masthead spans edge to edge).
    header: { x: 0, y: headerY, w: canvasW, h: hudH },
    timerBar: { x: blockX, y: timerY, w: blockW, h: timerH },
    questionBlock: { x: blockX, y: questionY, w: blockW, h: questionH },
    answerGrid: { x: blockX, y: answersY, w: blockW, h: answersH },
    footer: { x: 0, y: footerY, w: canvasW, h: footerH },
    answerShape: slots.answerGrid?.shape ?? '1x4',
    backgroundKind: layout.background?.kind ?? 'solid',
    pad,
  }
}

/**
 * gallery — a more visual, card-grid layout for image-rich future use.
 * Phase 2 stub: falls back to centered-editorial geometry. Render systems
 * will be wired to the gallery-specific pass in Phase 3.
 * TODO(Phase 3): implement gallery-native geometry once image-card spec lands.
 */
function gallery(
  layout: LayoutBlock,
  canvasW: number,
  canvasH: number,
): SlotMap {
  // Stub: use centered-editorial as the stand-in geometry.
  const slots = centeredEditorial(layout, canvasW, canvasH)
  return { ...slots, backgroundKind: layout.background?.kind ?? 'solid' }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute named canvas regions for the given pack + canvas dimensions.
 *
 * Consumers must NOT branch on `pack.slug` or `composition` string — read
 * the returned `SlotMap` by name and let the slots express the personality.
 *
 * All slot geometry is deterministic: same `pack`, `canvasW`, `canvasH`
 * always returns the same `SlotMap`.
 */
export function resolveSlots(
  pack: ContentPack,
  canvasW: number,
  canvasH: number,
): SlotMap {
  // After migrate(), pack.layout is always defined. Guard for robustness.
  const layout: LayoutBlock = pack.layout ?? { composition: 'stacked-vertical' }
  const mode = layout.composition ?? 'stacked-vertical'

  switch (mode) {
    case 'centered-editorial':
      return centeredEditorial(layout, canvasW, canvasH)
    case 'masthead-classic':
      return mastheadClassic(layout, canvasW, canvasH)
    case 'gallery':
      return gallery(layout, canvasW, canvasH)
    case 'stacked-vertical':
    default:
      return stackedVertical(layout, canvasW, canvasH)
  }
}

// ─── Gap accessors (used by computeLayout when building answer rects) ───────

/** Resolve the answer-grid gap in pixels. */
export function resolveAnswerGap(pack: ContentPack): number {
  return pack.layout?.slots?.answerGrid?.gap ?? DEFAULT_ANSWER_GAP
}
