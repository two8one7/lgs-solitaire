import {
	addComponent,
	hasComponent,
	type ComponentType,
	type WithId,
	removeComponent,
} from './component'
import {
	type IEntityInternal,
	createEntity,
	getEntityById,
	removeEntity,
} from './entity'
import { makeWorldId } from './id'
import type { IEntity, IWorld } from './types'
import { isEntity, isEntityData } from './utils'
import { changeWorldId, resetFilterQueries, resetQueries } from './worldQueries'
import type { IWorldInternal, QueryFunc } from './internalTypes'
import { destroyAllQueries, destroyQuery } from './query'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentWithId = WithId<ComponentType<any>>

let lastWorldIndex = -1

type Options = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	store?: any
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	events?: (world: IWorld) => any
	onSave?: (world: IWorld) => void
	onDelete?: (world: IWorld) => void
	onLoad?: (world: IWorld) => Promise<boolean>
}
export function createWorld<WorldType extends IWorld = IWorld>(
	opts: Options = {}
): WorldType {
	const { store, events: makeEvents } = opts

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const componentsById: Record<string, ComponentWithId> = {}
	const queriesById: Record<string, QueryFunc> = {}
	const id = makeWorldId()
	const index = ++lastWorldIndex
	let lastEntityIndex = 0

	const internalWorld: IWorldInternal = {
		id,
		index,
		setId(id) {
			changeWorldId(this.id, id)
			this.id = id
		},
		isUpdating: false,
		isDestroyed: false,

		getNextEntityIndex() {
			return lastEntityIndex++
		},

		entities: [],
		entitiesById: {},

		displaysByEntityIndex: [],

		get store() {
			return store
		},

		get events() {
			return events
		},

		addEntity(entity) {
			this.entities[entity.index] = entity
			this.entitiesById[entity.id] = entity
		},
		removeEntity(entity) {
			this.entities[entity.index] = undefined
			delete this.entitiesById[entity.id]
		},

		onAddComponent: [],
		onRemoveComponent: [],

		addQuery(query) {
			queriesById[query.id] = query
		},

		removeQuery(query) {
			delete queriesById[query.id]
		},

		getAllQueries() {
			return Object.values(queriesById)
		},

		registerComponent(component) {
			if (componentsById[component.id]) {
				if (componentsById[component.id] !== component) {
					throw new Error(
						`Component with id "${component.id}" already registered. There may be an id collision.`
					)
				}
				return
			}

			componentsById[component.id] = component
		},
		getComponentById(id: string) {
			return componentsById[id]
		},

		save(world) {
			opts.onSave?.(world)
		},
		delete(world) {
			opts.onDelete?.(world)
		},
		async load(world) {
			return (await opts.onLoad?.(world)) ?? false
		},

		destroy() {
			this.onAddComponent.length = 0
			this.onRemoveComponent.length = 0

			resetFilterQueries(this)

			for (const key in queriesById) {
				destroyQuery(this, queriesById[key])
				delete queriesById[key]
			}

			for (const key in componentsById) {
				delete componentsById[key]
			}

			this.isDestroyed = true
		},

		clear() {
			lastEntityIndex = 0
		},
	}

	const events = makeEvents?.(internalWorld)

	return internalWorld as unknown as WorldType
}

/**
 * removes all entities from the world
 * @param world
 */
export function clearWorld(world: IWorld) {
	const w = world as IWorldInternal
	for (const entity of w.entities) {
		if (!entity) {
			continue
		}
		removeEntity(entity, false, true)
	}

	w.entities = []
	w.entitiesById = {}
	w.displaysByEntityIndex = []
	w.clear()

	resetQueries(world)
	resetFilterQueries(world)
}

export function destroyWorld(world: IWorld) {
	const w = world as IWorldInternal

	destroyAllQueries(w)
	clearWorld(world)

	w.destroy()
}

export function saveWorld(world: IWorld) {
	const w = world as IWorldInternal
	if (w.isDestroyed) {
		console.warn('tried to save a destroyed world; ignoring...')
		return
	}
	w.save(world)
}

export function deleteWorld(world: IWorld) {
	const w = world as IWorldInternal
	w.delete(world)

	resetFilterQueries(world)
}

export function loadWorld(world: IWorld) {
	const w = world as IWorldInternal
	return w.load(world)
}

/**
 * Clears the world and creates a new id
 * @param world
 */
export function reuseWorld(world: IWorld) {
	const w = world as IWorldInternal
	clearWorld(world)
	w.setId(makeWorldId())
}

export function setWorldId(world: IWorld, id: string) {
	const w = world as IWorldInternal
	w.setId(id)
}

export function startUpdating(world: IWorld) {
	const w = world as IWorldInternal
	w.isUpdating = true
}

export function endUpdating(world: IWorld) {
	const w = world as IWorldInternal
	w.isUpdating = false
}

export function registerComponent(world: IWorld, component: ComponentWithId) {
	const w = world as IWorldInternal
	w.registerComponent(component)
}

export function serializeWorld(world: IWorld) {
	const w = world as IWorldInternal

	const componentIds = new Set<string>()
	const entities = w.entities
		.map((entity) => {
			if (!entity) {
				return
			}

			const e = entity as IEntityInternal
			const components = Array.from(e.componentIds).map((componentId) => {
				const component = w.getComponentById(componentId)
				if (!component) {
					return
				}

				componentIds.add(componentId)

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const c = component as any
				const fields = c._fields as string[]
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const values: any = { id: component.id }
				for (const field of fields) {
					const v = component[field]
					values[field] = Array.isArray(v) ? v[entity.worldIndex][e.index] : v

					if (isEntity(values[field])) {
						values[field] = {
							_type: 'entity',
							id: values[field].id,
							index: values[field].index,
						}
					}
				}

				return {
					id: component.id,
					values,
				}
			})

			return {
				id: entity.id,
				components,
			}
		})
		.filter((v) => !!v) as {
		id: string
		components: { id: string; values: { [key: string]: unknown } }[]
	}[]

	return {
		id: w.id,
		entities,
		componentIds: Array.from(componentIds),
	}
}

export type SerializedWorld = ReturnType<typeof serializeWorld>

export function deserializeWorld(world: IWorld, data: SerializedWorld) {
	const w = world as IWorldInternal

	const oldId = w.id
	w.id = data.id

	if (oldId !== w.id) {
		changeWorldId(oldId, w.id)
	}

	const entities: IEntity[] = []
	const list = data.entities

	// create all entities
	for (const entity of list) {
		if (!getEntityById(world, entity.id)) {
			createEntity(world, { id: entity.id })
		}
	}

	for (const entity of list) {
		const e = getEntityById(world, entity.id)
		const entityInternal = e as IEntityInternal
		const existingComponents = new Set(entityInternal.componentIds)

		entity.components.forEach((component) => {
			const c = w.getComponentById(component.id)
			if (!c) {
				return
			}

			const values = Object.fromEntries(
				Object.entries(component.values).map(([key, v]) => [
					key,
					isEntityData(v) ? getEntityById(world, v.id) : v,
				])
			) as Partial<ComponentType<any>>

			if (hasComponent(e, c)) {
				// inline setComponentValues: write directly to component arrays
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const comp = c as any
				const fields = comp._fields as string[]
				const wi = e.worldIndex
				const idx = e.index
				for (const field of fields) {
					const v = values[field]
					if (v !== undefined) {
						if (!c[field][wi]) {
							c[field][wi] = []
						}
						c[field][wi][idx] = v
					}
				}
				existingComponents.delete(c.id)
			} else {
				addComponent(e, c, values)
			}
		})

		// any remaining componentIds were removed from this entity
		for (const componentId of existingComponents) {
			const c = w.getComponentById(componentId)
			if (!c) {
				continue
			}

			removeComponent(e, c)
		}

		entities.push(e)
	}

	return entities
}
