import type { IEntity, IWorld } from './types'
import { makeEntityId } from './id'
import type { IWorldInternal } from './internalTypes'
import { removeComponent } from './component'

export interface IEntityInternal extends IEntity {
	componentIds: Set<string>
}

type EntityOptions = {
	id?: string
}
export function createEntity(world: IWorld, options: EntityOptions = {}) {
	const w = world as IWorldInternal
	if (options.id && w.entitiesById[options.id]) {
		return w.entitiesById[options.id]
	}

	const e: IEntityInternal = {
		id: options.id || makeEntityId(),
		index: w.getNextEntityIndex(),
		worldIndex: w.index,
		componentIds: new Set(),

		getWorld() {
			return world
		},
	}

	world.addEntity(e)

	return e as IEntity
}

export function removeEntity(
	entity: IEntity,
	unlinkDisplay = true,
	clearValues = false
) {
	const w = entity.getWorld() as IWorldInternal
	const _entity = entity as IEntityInternal

	// remove all components
	for (const componentId of _entity.componentIds) {
		const component = w.getComponentById(componentId)

		if (!component) {
			continue
		}

		removeComponent(entity, component, clearValues)
	}

	if (unlinkDisplay) {
		removeEntityDisplay(entity)
	}
	w.removeEntity(entity)
}

export function addEntityDisplay(entity: IEntity, display: unknown) {
	const w = entity.getWorld() as IWorldInternal
	w.displaysByEntityIndex[entity.index] = display
}

export function removeEntityDisplay(entity: IEntity) {
	const w = entity.getWorld() as IWorldInternal
	w.displaysByEntityIndex[entity.index] = undefined
}

export function getEntityDisplay<DisplayType = unknown>(entity: IEntity) {
	const w = entity.getWorld() as IWorldInternal
	return w.displaysByEntityIndex[entity.index] as DisplayType | undefined
}

export function getEntityById(world: IWorld, id: string) {
	const w = world as IWorldInternal
	return w.entitiesById[id]
}

export function getEntityByIndex(world: IWorld, index: number) {
	const w = world as IWorldInternal
	return w.entities[index]
}
