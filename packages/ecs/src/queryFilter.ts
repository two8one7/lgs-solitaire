import type { QueryFunc } from './internalTypes'
import type { IEntity } from './types'

type OperationFunc = {
	(entities: ReadonlyArray<IEntity>, modified: IEntity[]): void
	id: string
}

const cache: Record<string, () => ReadonlyArray<IEntity>> = {}

let nextFilterId = 0

type Options = {
	event?: 'added' | 'removed'
}
export function queryPipe(
	query: QueryFunc,
	operations: OperationFunc[],
	options: Options = {}
) {
	const key = `${query.key}:${operations.map((f) => f.id).join('-')}:e-${
		options.event ?? 'none'
	}`
	if (key in cache) {
		return cache[key]
	}

	const { event } = options

	const modified: IEntity[] = []

	let isDirty = true

	query.dirty.on(() => {
		isDirty = true
	})

	const func = () => {
		if (isDirty) {
			const entities =
				event === 'added'
					? query.added()
					: event === 'removed'
						? query.removed()
						: query()

			modified.length = 0
			const len = entities.length
			for (let i = 0; i < len; i++) {
				modified.push(entities[i])
			}

			for (const op of operations) {
				op(entities, modified)
			}
			isDirty = false
		}
		return modified
	}

	cache[key] = func

	return func
}

export function createFilter(
	predicate: (entity: IEntity) => boolean
): OperationFunc {
	const func = (entities: ReadonlyArray<IEntity>, modified: IEntity[]) => {
		modified.length = 0
		const len = entities.length
		for (let i = 0; i < len; i++) {
			if (predicate(entities[i])) {
				modified.push(entities[i])
			}
		}
	}

	func.id = `flt_${nextFilterId++}`

	return func
}

export function createSort(
	comparator: (a: IEntity, b: IEntity) => number
): OperationFunc {
	const func = (_entities: ReadonlyArray<IEntity>, modified: IEntity[]) => {
		modified.sort(comparator)
	}

	func.id = `srt_${nextFilterId++}`

	return func
}

export function removeFilterCache(queryKey: string) {
	for (const key in cache) {
		if (key.startsWith(queryKey)) {
			delete cache[key]
		}
	}
}
