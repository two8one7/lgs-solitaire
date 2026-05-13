/**
 * timer-system — counts up TimeElapsedMs each tick when TimerRunning is set.
 *
 * Started by input-system / stock-cycle on first action, stopped by win-check
 * on CompletedFlag.
 *
 * No Pixi imports.
 *
 * ECS review notes:
 *   AP-28 ✓ — dt is in SECONDS (per @2817/gameloop). Multiplied by 1000 here.
 *   PP-3  ✓ — CTimerRunning is a presence tag; query uses `with: [CTimerRunning]`.
 */

import { createQuery } from '@2817/ecs'
import type { IWorld } from '@2817/ecs'
import { CTimeElapsedMs, CTimerRunning } from '../components'

export function createTimerSystem(world: IWorld) {
	const runningTimerQ = createQuery(world, {
		with: [CTimeElapsedMs, CTimerRunning],
	})

	function update(dt: number): void {
		const dtMs = dt * 1000
		const entities = runningTimerQ()
		for (let i = 0; i < entities.length; i++) {
			const e = entities[i]!
			const wi = e.worldIndex
			const idx = e.index
			CTimeElapsedMs.value[wi][idx] =
				((CTimeElapsedMs.value[wi][idx] as number) ?? 0) + dtMs
		}
	}

	return { update }
}
