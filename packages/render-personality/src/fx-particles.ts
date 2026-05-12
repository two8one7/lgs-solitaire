// FX particles — ECS-native short-lived bursts layered above gameplay.
//
// Replaces the Graphics-redraw fx-render.ts. Particles are spawned as
// transient entities; lifetime + motion live in CParticleLifetime; cleanup
// uses query.removed() rather than per-frame hasComponent (PP-1 from the
// ECS supplement). Render side draws each entity into a Pixi
// ParticleContainer — every particle shares one base texture (Texture.WHITE)
// and is differentiated by tint, scale, alpha, and position.
//
// Pipeline
//   1. Gameplay calls emit(eventName, x, y) → spawns one CParticleBurst entity.
//   2. update(dt) drains every entity that carries CParticleBurst:
//      - Reads ctx.pack.juice.particles[eventName] (ParticleConfig).
//      - Spawns `count` particle entities each with CParticleLifetime
//        initialized from the spec (lifetimeMs, speed, gravity, size, colors).
//      - Pairs each particle entity with a fresh Pixi Particle inside the
//        ParticleContainer, tracked in entity→Particle Map.
//      - Removes CParticleBurst from the source entity.
//   3. update(dt) advances every entity with CParticleLifetime:
//      - position += velocity*dt, velocity.y += gravity*dt.
//      - remaining -= dt; when remaining <= 0, removeComponent(CParticleLifetime)
//        which feeds query.removed() on the next read.
//      - fade alpha when remaining < ~30% of maxLifetime if fade=true.
//   4. update(dt) drains query.removed() — removes Pixi particles from the
//      container, removes the husk entity, then clears the removed list.
//
// Silent default: when ctx.pack.juice.particles[eventName] is undefined or
// count <= 0, emit is a no-op. All three v2 packs ship with empty juice →
// baseline-identical to Phase 3.

import { Container, Particle, ParticleContainer, Texture } from 'pixi.js'
import { resolveTexturePath } from './texture-cache'
import {
	addComponent,
	createEntity,
	createQuery,
	hasComponent,
	removeComponent,
	removeEntity,
} from '@2817/ecs'
import type { IWorld } from '@2817/ecs'
import type { ContentPack, ParticleConfig } from '@lgs/content-pack'
import { CParticleBurst, CParticleLifetime } from './components'
import type { RenderContext } from './render-context'

const TAU = Math.PI * 2

export type FxParticles = {
	display: Container
	emit: (eventName: string, originX: number, originY: number) => void
	update: (dt: number) => void
	destroy: () => void
}

/** Resolve a colors[] string (palette key name OR `#rrggbb`) to 0xRRGGBB. */
function resolveColor(name: string | undefined, palette: Record<string, number>): number {
	if (!name) return 0xffffff
	if (name.startsWith('#')) {
		// `#rgb` or `#rrggbb` — fall back to white on malformed input.
		const hex = name.slice(1)
		if (hex.length === 3) {
			const r = parseInt(hex[0] + hex[0], 16)
			const g = parseInt(hex[1] + hex[1], 16)
			const b = parseInt(hex[2] + hex[2], 16)
			if (Number.isFinite(r + g + b)) return (r << 16) | (g << 8) | b
			return 0xffffff
		}
		if (hex.length === 6) {
			const v = parseInt(hex, 16)
			return Number.isFinite(v) ? v : 0xffffff
		}
		return 0xffffff
	}
	// Palette key path.
	return typeof palette[name] === 'number' ? palette[name] : 0xffffff
}

/** Pick a numeric value uniformly from a [min, max] tuple. */
function pickRange(range: [number, number] | undefined, fallback: number): number {
	if (!range) return fallback
	const [a, b] = range
	if (b <= a) return a
	return a + Math.random() * (b - a)
}

/** Resolve the configured spread mode to a launch-angle generator. */
function makeAngleFn(spec: ParticleConfig): () => number {
	if (spec.spread === 'upward') {
		// Cone pointing up (~120° wide centered on -π/2).
		return () => -Math.PI / 2 + (Math.random() - 0.5) * (TAU / 3)
	}
	if (spec.spread === 'drift') {
		// Sideways drift; gentle horizontal motion, gravity carries the rest.
		return () => (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.4
	}
	// Default + 'radial': full circle.
	return () => Math.random() * TAU
}

export function createFxParticles(ctx: RenderContext): FxParticles {
	const world: IWorld = ctx.world
	const display = new Container()
	const particles = new ParticleContainer({
		// uvs: true enables per-particle texture overrides (needed for texturePath).
		// Existing packs use Texture.WHITE throughout, so visual output is unchanged.
		dynamicProperties: { position: true, color: true, scale: true, rotation: false, uvs: true },
		texture: Texture.WHITE,
		roundPixels: false,
	})
	display.addChild(particles)

	// Per-entity Pixi particle map. Indexed by entity.index (stable per world).
	const pixiByIndex = new Map<number, Particle>()

	// Burst entities awaiting consumption.
	const burstQuery = createQuery(world, { with: [CParticleBurst] })
	// All live particle entities.
	const liveQuery = createQuery(world, { with: [CParticleLifetime] })

	function spawnBurst(spec: ParticleConfig, originX: number, originY: number): void {
		const count = typeof spec.count === 'number' && spec.count > 0 ? Math.floor(spec.count) : 0
		if (count === 0) return

		// TODO(#18): particles.shape — generate per-shape textures (circle/star/
		// petal/flake) via Graphics→renderer.generateTexture at boot and use here.
		// TODO(#18): particles.blend — set ParticleContainer.blendMode per burst
		// without clobbering concurrent bursts that use a different blend mode.

		const colors = spec.colors && spec.colors.length > 0 ? spec.colors : ['#ffffff']
		const gravity = typeof spec.gravity === 'number' ? spec.gravity : 0
		const fade = spec.fadeCurve !== undefined
		const angleFor = makeAngleFn(spec)

		for (let i = 0; i < count; i++) {
			// Sample motion from spec.
			const lifetimeMs = pickRange(spec.lifetimeMs, 800)
			const lifetimeS = lifetimeMs / 1000
			const speed = pickRange(spec.speed, 200)
			const size = pickRange(spec.size, 4)
			const angle = angleFor()
			const vx = Math.cos(angle) * speed
			const vy = Math.sin(angle) * speed
			const color = resolveColor(colors[i % colors.length], ctx.palette)

			const entity = createEntity(world)
			addComponent(entity, CParticleLifetime, {
				remaining: lifetimeS,
				maxLifetime: lifetimeS,
				vx,
				vy,
				gravity,
				color,
				radius: size,
				fade,
			})

			// Resolve per-burst texture. Falls back to Texture.WHITE when
			// texturePath is absent, still loading, or failed (no throw).
			const texture = resolveTexturePath(spec.texturePath)

			// Pair with a Pixi particle. scaleX/Y = size / texture native dim so
			// the rendered particle is `size` px across regardless of source
			// texture dimensions (Texture.WHITE preserves the legacy size=scale
			// identity).
			const texW = (texture.width as number) > 0 ? (texture.width as number) : 1
			const texH = (texture.height as number) > 0 ? (texture.height as number) : 1
			const particle = new Particle({
				texture,
				x: originX,
				y: originY,
				anchorX: 0.5,
				anchorY: 0.5,
				scaleX: size / texW,
				scaleY: size / texH,
				tint: color,
				alpha: 1,
			})
			particles.addParticle(particle)
			pixiByIndex.set(entity.index, particle)
		}
	}

	function consumeBursts(): void {
		const list = burstQuery()
		if (list.length === 0) return
		// Snapshot — burstQuery() reflects live world state, but we mutate the
		// world during the loop, so iterate over a copy.
		const snapshot = list.slice()
		for (let i = 0; i < snapshot.length; i++) {
			const e = snapshot[i]
			if (!hasComponent(e, CParticleBurst)) continue
			const eventName = CParticleBurst.eventName[e.worldIndex][e.index] as string
			const x = CParticleBurst.x[e.worldIndex][e.index] as number
			const y = CParticleBurst.y[e.worldIndex][e.index] as number

			const spec = lookupParticleSpec(ctx.pack, eventName)
			if (spec) spawnBurst(spec, x, y)

			// Despawn the burst entity in the same tick — it's a one-shot signal.
			removeEntity(e)
		}
	}

	function advanceLifetimes(dt: number): void {
		const list = liveQuery()
		// Iterate by index over the snapshot to allow component removal during loop.
		const live = list.slice()
		const wi = ctx.world.index
		for (let i = 0; i < live.length; i++) {
			const e = live[i]
			const ei = e.index
			const remainingArr = CParticleLifetime.remaining[wi]
			const maxArr = CParticleLifetime.maxLifetime[wi]
			const vxArr = CParticleLifetime.vx[wi]
			const vyArr = CParticleLifetime.vy[wi]
			const gravArr = CParticleLifetime.gravity[wi]
			const fadeArr = CParticleLifetime.fade[wi]

			const remaining = (remainingArr[ei] as number) - dt
			remainingArr[ei] = remaining

			if (remaining <= 0) {
				// Remove the component — query.removed() will surface this entity
				// for cleanup below. Don't removeEntity here; the husk is recycled
				// after the Pixi-side despawn.
				removeComponent(e, CParticleLifetime)
				continue
			}

			const vx = vxArr[ei] as number
			let vy = vyArr[ei] as number
			vy += (gravArr[ei] as number) * dt
			vyArr[ei] = vy

			const particle = pixiByIndex.get(ei)
			if (particle) {
				particle.x += vx * dt
				particle.y += vy * dt
				if (fadeArr[ei]) {
					const max = maxArr[ei] as number
					// Linear fade across full lifetime — matches old fx-render alpha curve.
					particle.alpha = max > 0 ? Math.max(0, remaining / max) : 0
				}
			}
		}
	}

	function reapDead(): void {
		const dead = liveQuery.removed()
		if (dead.length === 0) return
		for (let i = 0; i < dead.length; i++) {
			const e = dead[i]
			const particle = pixiByIndex.get(e.index)
			if (particle) {
				particles.removeParticle(particle)
				pixiByIndex.delete(e.index)
			}
			// The component was already removed; despawn the husk entity now.
			removeEntity(e)
		}
		liveQuery.removed.clear()
	}

	function emit(eventName: string, originX: number, originY: number): void {
		// Cheap fast-path: skip the entity round-trip if no spec is configured.
		if (!lookupParticleSpec(ctx.pack, eventName)) return
		const burst = createEntity(world)
		addComponent(burst, CParticleBurst, { eventName, x: originX, y: originY })
	}

	function update(dt: number): void {
		consumeBursts()
		advanceLifetimes(dt)
		reapDead()
	}

	function destroy(): void {
		// Despawn every live Pixi particle + entity. Removing components first
		// keeps query.removed() consistent for any later reads.
		const live = liveQuery().slice()
		for (let i = 0; i < live.length; i++) {
			const e = live[i]
			if (hasComponent(e, CParticleLifetime)) removeComponent(e, CParticleLifetime)
			const particle = pixiByIndex.get(e.index)
			if (particle) {
				particles.removeParticle(particle)
				pixiByIndex.delete(e.index)
			}
			removeEntity(e)
		}
		liveQuery.removed.clear()
		// Also reap any unconsumed bursts.
		const bursts = burstQuery().slice()
		for (let i = 0; i < bursts.length; i++) removeEntity(bursts[i])

		display.destroy({ children: true })
	}

	return { display, emit, update, destroy }
}

/**
 * Resolve the active ParticleConfig for a given event name.
 *
 * Pack schema only defines three keys (correct | incorrect | ambient). Scenes
 * fire higher-level names (`streakUp`, `complete`) that map onto these three
 * — we coalesce here so the call sites stay readable. Unknown event names
 * return undefined (silent no-op).
 */
function lookupParticleSpec(pack: ContentPack, eventName: string): ParticleConfig | undefined {
	const particles = pack.juice?.particles
	if (!particles) return undefined

	switch (eventName) {
		case 'correct':
		case 'complete':
		case 'streakUp':
			return particles.correct
		case 'incorrect':
			return particles.incorrect
		case 'ambient':
			return particles.ambient
		default:
			return undefined
	}
}
