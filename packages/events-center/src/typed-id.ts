let nextId = 0

export interface TypedId<T = unknown> {
	type: T
	value: string
}

export function createTypedId<T>(id?: string): TypedId<T> {
	return { type: null as unknown as T, value: id ?? `evt_${nextId++}` }
}
