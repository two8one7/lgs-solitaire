// Particle FX components — part of the personality engine, not game logic.
//
// Trivia (and every future LGS game) re-exports these from its own
// `components/index.ts` so call sites are unchanged. Component IDs are
// `lgs:*` since they're shared across games.

import { createComponent } from '@2817/ecs'

/**
 * Transient burst-request component (PP-2): attached to a one-frame entity by
 * gameplay code. The fx-particles system reads it on its next tick, spawns
 * `count` particle entities, and despawns the burst.
 *
 * `eventName` is the juice block key (`correct | incorrect | ambient`).
 */
export const CParticleBurst = createComponent(
  {
    eventName: { type: String, default: '' },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
  },
  { id: 'lgs:ParticleBurst' },
)

/**
 * Per-particle lifetime + motion (PP-1/PP-2). When `remaining <= 0`, the
 * fx-particles system removes the component; downstream cleanup uses
 * `query.removed()` to despawn the entity + free its display.
 *
 * Pixi-side particle state (sprite/tint/alpha) lives in the system's parallel
 * arrays keyed by entity index — components stay data-only (AP-2 ✓).
 */
export const CParticleLifetime = createComponent(
  {
    remaining: { type: Number, default: 0 },
    maxLifetime: { type: Number, default: 1 },
    vx: { type: Number, default: 0 },
    vy: { type: Number, default: 0 },
    gravity: { type: Number, default: 0 },
    /** Tint as 0xRRGGBB. Stored on the component for test introspection. */
    color: { type: Number, default: 0xffffff },
    /** Particle radius in px (size half-extent). */
    radius: { type: Number, default: 3 },
    fade: { type: Boolean, default: true },
  },
  { id: 'lgs:ParticleLifetime' },
)
