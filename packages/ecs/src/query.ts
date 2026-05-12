import type { ComponentType, IComponentDefinition, WithId } from './component'
import type { IEntityInternal } from './entity'
import type { IEntity, IWorld } from './types'
import type {
	ComponentHandler,
	IWorldInternal,
	QueryFunc,
	Signal,
} from './internalTypes'

import { murmurhash3 } from '@2817/hash'

import { type BaseQuery, baseQueriesForWorld } from './worldQueries'
import { removeFilterCache } from './queryFilter'

export type AddedRemovedFunc = {
	(): ReadonlyArray<IEntity>
	size(): number
	clear(): void
}

const queryCache: Record<string, BaseQuery> = {}
const queryDirty: Record<string, Record<string, boolean>> = {}
const queryFuncs: Record<string, QueryFunc[]> = {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function OR(...components: WithId<ComponentType<any>>[]) {
	return components
}

// Monotonic counter for query func IDs (replaces nanoid)
let nextQueryFuncId = 0

/**
 * Tracked array: maintains a parallel Map<id, index> for O(1) lookup
 * alongside the array for O(1) swap-and-pop removal.
 */
function trackedPush(
	arr: IEntity[],
	map: Map<string, number>,
	entity: IEntity,
	indices?: number[]
): boolean {
	if (map.has(entity.id)) return false
	map.set(entity.id, arr.length)
	arr.push(entity)
	if (indices) indices.push(entity.index)
	return true
}

function trackedRemove(
	arr: IEntity[],
	map: Map<string, number>,
	entityId: string,
	indices?: number[]
): boolean {
	const idx = map.get(entityId)
	if (idx === undefined) return false

	const lastIdx = arr.length - 1
	if (idx !== lastIdx) {
		const moved = arr[lastIdx]
		arr[idx] = moved
		map.set(moved.id, idx)
		if (indices) indices[idx] = indices[lastIdx]
	}
	arr.pop()
	if (indices) indices.pop()
	map.delete(entityId)
	return true
}

function trackedHas(map: Map<string, number>, entityId: string): boolean {
	return map.has(entityId)
}

function trackedClear(
	arr: IEntity[],
	map: Map<string, number>,
	indices?: number[]
): void {
	arr.length = 0
	map.clear()
	if (indices) indices.length = 0
}

type Options = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	with?: (WithId<ComponentType<any>> | WithId<ComponentType<any>>[])[]
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	without?: WithId<ComponentType<any>>[]
}
export function createQuery(world: IWorld, options: Options) {
	const internalWorld = world as IWorldInternal
	const { with: withList = [], without = [] } = options ?? {}
	const queryKey = createKey(world.id, withList, without)

	if (queryCache[queryKey]) {
		const entry = queryCache[queryKey]
		return createQueryFunc(
			entry.entities,
			entry.entityIndices,
			queryKey,
			entry.added,
			entry.removed
		)
	}

	const entities: IEntity[] = []
	const entitiesMap = new Map<string, number>()
	const entityIndices: number[] = []

	const withListFlat = withList.flat(Infinity) as WithId<
		ComponentType<IComponentDefinition>
	>[]
	const withSet = new Set(withListFlat.map((c) => c.id))
	const withoutSet = new Set(without.map((c) => c.id))

	let trackAddOrRemove = false
	const entitiesAdded: IEntity[] = []
	const entitiesAddedMap = new Map<string, number>()
	const entitiesAddedQueue: IEntity[] = []
	const entitiesAddedQueueMap = new Map<string, number>()

	const entitiesRemoved: IEntity[] = []
	const entitiesRemovedMap = new Map<string, number>()
	const entitiesRemovedQueue: IEntity[] = []
	const entitiesRemovedQueueMap = new Map<string, number>()

	function removed() {
		if (!trackAddOrRemove) {
			trackAddOrRemove = true
		}
		return entitiesRemoved
	}
	removed.size = () => entitiesRemoved.length
	removed.clear = () => {
		if (entitiesRemoved.length <= 0 && entitiesRemovedQueue.length <= 0) {
			return
		}

		trackedClear(entitiesRemoved, entitiesRemovedMap)

		const len = entitiesRemovedQueue.length
		for (let i = 0; i < len; ++i) {
			trackedPush(
				entitiesRemoved,
				entitiesRemovedMap,
				entitiesRemovedQueue[i]
			)
		}

		trackedClear(entitiesRemovedQueue, entitiesRemovedQueueMap)

		setDirty(queryKey)
	}

	function added() {
		if (!trackAddOrRemove) {
			trackAddOrRemove = true
			const len = entities.length
			for (let i = 0; i < len; ++i) {
				trackedPush(entitiesAdded, entitiesAddedMap, entities[i])
			}
		}

		return entitiesAdded
	}
	added.size = () => entitiesAdded.length
	added.clear = () => {
		if (entitiesAdded.length <= 0 && entitiesAddedQueue.length <= 0) {
			return
		}

		trackedClear(entitiesAdded, entitiesAddedMap)

		const len = entitiesAddedQueue.length
		for (let i = 0; i < len; ++i) {
			trackedPush(entitiesAdded, entitiesAddedMap, entitiesAddedQueue[i])
		}

		trackedClear(entitiesAddedQueue, entitiesAddedQueueMap)

		setDirty(queryKey)
	}

	const addHandler: ComponentHandler = (entity, component) => {
		if (!withSet.has(component.id) && !withoutSet.has(component.id)) {
			return
		}

		if (isMatch(entity as IEntityInternal, withList, without)) {
			if (!trackedHas(entitiesMap, entity.id)) {
				trackedPush(entities, entitiesMap, entity, entityIndices)
				setDirty(queryKey)

				if (trackAddOrRemove) {
					if (internalWorld.isUpdating) {
						trackedPush(
							entitiesAddedQueue,
							entitiesAddedQueueMap,
							entity
						)
					} else if (
						trackedPush(entitiesAdded, entitiesAddedMap, entity)
					) {
						setDirty(queryKey)
					}
				}
			}
		} else if (trackedHas(entitiesMap, entity.id)) {
			trackedRemove(entities, entitiesMap, entity.id, entityIndices)
			setDirty(queryKey)
		}
	}

	const removeHandler: ComponentHandler = (entity, component) => {
		if (!withSet.has(component.id) && !withoutSet.has(component.id)) {
			return
		}

		// componentIds is already updated before this event fires
		const wasInQuery = trackedHas(entitiesMap, entity.id)
		const nowMatches = isMatch(entity as IEntityInternal, withList, without)

		if (wasInQuery && !nowMatches) {
			// entity no longer matches — remove from query
			trackedRemove(entities, entitiesMap, entity.id, entityIndices)
			setDirty(queryKey)

			if (trackAddOrRemove) {
				trackedRemove(entitiesAdded, entitiesAddedMap, entity.id)
				trackedRemove(
					entitiesAddedQueue,
					entitiesAddedQueueMap,
					entity.id
				)
			}

			if (trackAddOrRemove) {
				if (internalWorld.isUpdating) {
					trackedPush(
						entitiesRemovedQueue,
						entitiesRemovedQueueMap,
						entity
					)
				} else if (
					trackedPush(entitiesRemoved, entitiesRemovedMap, entity)
				) {
					setDirty(queryKey)
				}
			}
		} else if (!wasInQuery && nowMatches) {
			// entity now matches — add to query
			trackedPush(entities, entitiesMap, entity, entityIndices)
			setDirty(queryKey)

			if (trackAddOrRemove) {
				if (internalWorld.isUpdating) {
					trackedPush(
						entitiesAddedQueue,
						entitiesAddedQueueMap,
						entity
					)
				} else if (
					trackedPush(entitiesAdded, entitiesAddedMap, entity)
				) {
					setDirty(queryKey)
				}
			}
		}
	}

	const baseQuery = {
		key: queryKey,
		entities,
		entityIndices,
		added,
		removed,
		destroy() {
			const addIdx = internalWorld.onAddComponent.indexOf(addHandler)
			if (addIdx >= 0) {
				internalWorld.onAddComponent.splice(addIdx, 1)
			}

			const removeIdx =
				internalWorld.onRemoveComponent.indexOf(removeHandler)
			if (removeIdx >= 0) {
				internalWorld.onRemoveComponent.splice(removeIdx, 1)
			}

			trackedClear(entities, entitiesMap, entityIndices)
			added.clear()
			removed.clear()

			withListFlat.length = 0
			withSet.clear()
			withoutSet.clear()
		},
	}

	if (!baseQueriesForWorld[world.id]) {
		baseQueriesForWorld[world.id] = []
	}

	queryCache[queryKey] = baseQuery
	baseQueriesForWorld[world.id].push(baseQuery)

	internalWorld.onAddComponent.push(addHandler)
	internalWorld.onRemoveComponent.push(removeHandler)

	for (const entity of internalWorld.entities) {
		if (!entity) {
			continue
		}

		if (isMatch(entity as IEntityInternal, withList, without)) {
			trackedPush(entities, entitiesMap, entity, entityIndices)
			setDirty(queryKey)
		}
	}

	const func = createQueryFunc(
		entities,
		entityIndices,
		queryKey,
		added,
		removed
	)

	internalWorld.addQuery(func)

	return func
}

/**
 * Removes this query instance but keeps the base query around
 * @param query
 * @returns
 */
export function removeQuery(query: QueryFunc) {
	removeFilterCache(query.key)

	const funcs = queryFuncs[query.key]
	if (!funcs) {
		return
	}

	const idx = funcs.findIndex((f) => f.id === query.id)
	if (idx >= 0) {
		const func = funcs[idx]
		func.dirty.destroy()
		funcs.splice(idx, 1)
	}

	if (queryDirty[query.key]) {
		delete queryDirty[query.key][query.id]
	}
}

export function destroyQuery(world: IWorld, query: QueryFunc) {
	removeQuery(query)

	const baseQuery = queryCache[query.key]
	if (!baseQuery) {
		return
	}

	baseQuery.destroy()
	delete queryCache[query.key]
	delete queryDirty[query.key]

	const baseQueries = baseQueriesForWorld[world.id]
	if (!baseQueries) {
		return
	}

	const idx = baseQueries.findIndex((q) => q.key === query.key)
	if (idx >= 0) {
		baseQueries.splice(idx, 1)
	}
}

export function destroyAllQueries(world: IWorld) {
	const w = world as IWorldInternal
	const queries = w.getAllQueries()

	if (!queries) {
		return
	}

	for (const query of queries) {
		destroyQuery(world, query)
	}
	delete baseQueriesForWorld[world.id]
}

export function clearQueryAdded(world: IWorld) {
	const baseQueries = baseQueriesForWorld[world.id]
	if (!baseQueries || baseQueries.length <= 0) {
		return
	}

	for (const baseQuery of baseQueries) {
		baseQuery.added.clear()
	}
}

export function clearQueryRemoved(world: IWorld) {
	const baseQueries = baseQueriesForWorld[world.id]
	if (!baseQueries || baseQueries.length <= 0) {
		return
	}

	for (const baseQuery of baseQueries) {
		baseQuery.removed.clear()
	}
}

function createSignal(): Signal {
	const callbacks: (() => void)[] = []
	return {
		on(cb: () => void) {
			callbacks.push(cb)
			return () => {
				const idx = callbacks.indexOf(cb)
				if (idx >= 0) {
					callbacks.splice(idx, 1)
				}
			}
		},
		fire() {
			for (let i = 0, len = callbacks.length; i < len; ++i) {
				callbacks[i]()
			}
		},
		destroy() {
			callbacks.length = 0
		},
	}
}

function createQueryFunc(
	entities: IEntity[],
	entityIndices: number[],
	queryKey: string,
	added: AddedRemovedFunc,
	removed: AddedRemovedFunc
) {
	let calledOnce = false
	const id = `qf_${nextQueryFuncId++}`
	const func = () => {
		if (calledOnce) {
			clearDirtyQuery(queryKey, id)
		}
		calledOnce = entities.length > 0 ? true : false
		return entities as ReadonlyArray<IEntity>
	}
	func.key = queryKey
	func.id = id
	func.indices = entityIndices
	func.size = () => entities.length
	func.added = added
	func.removed = removed
	func.dirty = createSignal()
	func.clearDirty = (clearAll = false) => {
		if (clearAll) {
			setDirty(queryKey, false)
		} else {
			clearDirtyQuery(queryKey, id)
		}
	}

	if (!queryDirty[queryKey]) {
		queryDirty[queryKey] = {}
	}
	queryDirty[queryKey][func.id] = false

	if (!queryFuncs[queryKey]) {
		queryFuncs[queryKey] = []
	}
	queryFuncs[queryKey].push(func)

	return func
}

function setDirty(key: string, val = true) {
	if (!queryDirty[key]) {
		return
	}

	const funcs = queryFuncs[key]
	if (!funcs) {
		return
	}

	const len = funcs.length
	for (let i = 0; i < len; i++) {
		const func = funcs[i]
		queryDirty[key][func.id] = val
		if (val) {
			func.dirty.fire()
		}
	}
}

export function queryIsDirty(query: QueryFunc) {
	if (!queryDirty[query.key]) {
		return false
	}

	return queryDirty[query.key][query.id]
}

function clearDirtyQuery(queryKey: string, funcId: string) {
	queryDirty[queryKey][funcId] = false
}

function isMatch<T extends IComponentDefinition>(
	entity: IEntityInternal,
	withList: (WithId<ComponentType<T>> | WithId<ComponentType<T>>[])[],
	without: WithId<ComponentType<T>>[],
	matchWithAny = false
) {
	const predicate = (
		component: WithId<ComponentType<T>> | WithId<ComponentType<T>>[]
	) => {
		if (Array.isArray(component)) {
			return component.some((component) => {
				return entity.componentIds.has(component.id)
			})
		}
		return entity.componentIds.has(component.id)
	}

	const hasAllOrAny = matchWithAny
		? withList.some(predicate)
		: withList.every(predicate)
	const isHasNone = hasNone(entity, without)

	return hasAllOrAny && isHasNone
}

function hasNone<T extends IComponentDefinition>(
	entity: IEntityInternal,
	without: WithId<ComponentType<T>>[]
) {
	if (without.length <= 0) {
		return true
	}

	for (const component of without) {
		if (entity.componentIds.has(component.id)) {
			return false
		}
	}

	return true
}

const seed = 98712724 // Date.now()
function createKey(
	worldId: string,
	withList: (
		| WithId<ComponentType<IComponentDefinition>>
		| WithId<ComponentType<IComponentDefinition>>[]
	)[],
	without: WithId<ComponentType<IComponentDefinition>>[]
) {
	const key = `${worldId}-${withList
		.map((c) => {
			if (Array.isArray(c)) {
				return `or(${c.map((c) => c.id).join(',')})`
			}
			return c.id
		})
		.join(',')}:!${without.map((c) => c.id).join(',')}`
	return murmurhash3(key, seed).toString()
}
