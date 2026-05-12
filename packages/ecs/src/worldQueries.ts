import type { AddedRemovedFunc } from './query'
import { removeFilterCache } from './queryFilter'
import type { IEntity, IWorld } from './types'

export type BaseQuery = {
	key: string
	entities: IEntity[]
	entityIndices: number[]
	added: AddedRemovedFunc
	removed: AddedRemovedFunc
	destroy: () => void
}

export const baseQueriesForWorld: Record<string, BaseQuery[]> = {}

export function changeWorldId(oldId: string, newId: string) {
	const queries = baseQueriesForWorld[oldId]

	if (!queries) {
		return
	}

	baseQueriesForWorld[newId] = queries
	delete baseQueriesForWorld[oldId]
}

export function resetFilterQueries(world: IWorld) {
	const queries = baseQueriesForWorld[world.id]

	if (!queries) {
		return
	}

	for (const query of queries) {
		removeFilterCache(query.key)
	}
}

export function resetQueries(world: IWorld) {
	const queries = baseQueriesForWorld[world.id]

	if (!queries) {
		return
	}

	for (const query of queries) {
		query.added.clear()
		query.removed.clear()
		query.entities.length = 0
		query.entityIndices.length = 0
	}
}
