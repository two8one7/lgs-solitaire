import type { ComponentType, WithId } from './component'
import type { IEntity, IWorld } from './types'

export type Signal = {
	on(cb: () => void): () => void
	fire(): void
	destroy(): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentWithId = WithId<ComponentType<any>>

export type ComponentHandler = (entity: IEntity, component: ComponentWithId) => void

export interface IWorldInternal extends IWorld {
	isUpdating: boolean
	isDestroyed: boolean

	getNextEntityIndex: () => number

	entities: (IEntity | undefined)[]
	entitiesById: Record<string, IEntity>

	displaysByEntityIndex: unknown[]

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	getComponentById: (id: string) => ComponentWithId | undefined

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	registerComponent: (component: ComponentWithId) => void

	onAddComponent: ComponentHandler[]
	onRemoveComponent: ComponentHandler[]

	addQuery: (query: QueryFunc) => void
	removeQuery: (query: QueryFunc) => void
	getAllQueries: () => ReadonlyArray<QueryFunc>

	save: (world: IWorld) => void
	delete: (world: IWorld) => void

	load: (world: IWorld) => Promise<boolean>

	destroy: () => void
	clear: () => void

	setId: (id: string) => void
}

export type QueryFunc = {
	(): ReadonlyArray<IEntity>
	key: string
	id: string
	indices: number[]
	size(): number
	added(): ReadonlyArray<IEntity>
	removed(): ReadonlyArray<IEntity>
	clearDirty(clearAll?: boolean): void
	dirty: Signal
}

export type BaseQueryFunc = QueryFunc & {
	destroy(): void
}
