export interface IWorld<StoreType = unknown, EventsCenterType = unknown> {
	id: string
	readonly index: number

	readonly store: StoreType | undefined
	readonly events: EventsCenterType | undefined

	addEntity(entity: IEntity): void
	removeEntity(entity: IEntity): void
}

export interface IEntity {
	id: string
	index: number
	worldIndex: number

	getWorld(): IWorld
}
