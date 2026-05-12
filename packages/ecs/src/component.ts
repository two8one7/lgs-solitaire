import type { IEntityInternal } from './entity'
import { makeComponentId } from './id'
import type { IEntity, IWorld } from './types'
import type { IWorldInternal } from './internalTypes'

// base types
type FieldValue = {
	string: string
	number: number
	boolean: boolean
	object: object
	entity: IEntity
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConstructorType = { new (...args: any[]): any }

export interface IComponentDefinition {
	[key: string]: {
		type: keyof FieldValue | ConstructorType
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		default?: any
	}
}

export type ComponentType<T extends IComponentDefinition> = {
	[key in keyof T]: Array<
		| (T[key]['type'] extends keyof FieldValue
				? FieldValue[T[key]['type']]
				: T[key]['type'] extends ConstructorType
					? InstanceType<T[key]['type']>
					: undefined)
		| undefined
	>[]
}

type WithDefaults<
	T extends ComponentType<A>,
	A extends IComponentDefinition,
> = T & { _defaults: ComponentDefaults<A>; _fields: (keyof A)[] }

export type WithId<T> = T & { id: string }

export type ComponentDefaults<T extends IComponentDefinition> = {
	[key in keyof T]: T[key]['default']
}

export type ComponentValues<T extends ComponentType<IComponentDefinition>> = {
	[key in keyof T]: T[key][number][number]
}

type CreateComponentOptions = {
	id?: string
}
export function createComponent<T extends IComponentDefinition>(
	_definition?: T,
	options: CreateComponentOptions = {}
) {
	const definition = _definition ?? ({} as T)
	const fields = Object.keys(definition) as (keyof T)[]
	const result = fields.reduce(
		(acc, field) => {
			const _acc = acc as ComponentType<T>
			// TODO: maybe set a specific size to this array
			// TODO: maybe have an object of arrays where each key is a world id?
			// that would potentially be better for multiple worlds running at the same time
			_acc[field] = []
			acc._defaults[field] =
				definition[field].default instanceof Function
					? definition[field].default()
					: definition[field].default
			return acc
		},
		{
			id: options.id || makeComponentId(),
			_defaults: {},
			_fields: fields,
		} as WithId<WithDefaults<ComponentType<T>, T>>
	)
	return result as WithId<ComponentType<T>>
}

export function createTag(options: CreateComponentOptions = {}) {
	return createComponent({}, options)
}

export function addComponent<
	T extends ComponentType<A>,
	A extends IComponentDefinition,
>(
	entity: IEntity,
	component: WithId<T>,
	values: Partial<ComponentValues<T>> = {}
) {
	const e = entity as IEntityInternal
	if (e.componentIds.has(component.id)) {
		return
	}

	const wi = entity.worldIndex

	const c = component as unknown as WithDefaults<T, A>
	const fields = c._fields
	const len = fields.length
	for (let i = 0; i < len; ++i) {
		const field = fields[i]

		const f = component[field]

		// ensure the world-level array always exists so direct access never needs to allocate
		if (!f[wi]) {
			f[wi] = []
		}

		const v = (values[field] ??
			(c._defaults &&
				c._defaults[field as keyof A])) as ComponentValues<T>[keyof T]
		const idx = entity.index

		if (v !== undefined) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			f[wi][idx] = v
		}
	}

	e.componentIds.add(component.id)
	const world = entity.getWorld() as IWorldInternal
	world.registerComponent(component)
	const addHandlers = world.onAddComponent
	const addLen = addHandlers.length
	if (addLen > 0) {
		for (let i = 0; i < addLen; i++) {
			addHandlers[i](entity, component)
		}
	}
}

export function hasComponent<
	T extends ComponentType<A>,
	A extends IComponentDefinition,
>(entity: IEntity, component: WithId<T>) {
	return (entity as IEntityInternal).componentIds.has(component.id)
}

export function removeComponent<
	T extends ComponentType<A>,
	A extends IComponentDefinition,
>(entity: IEntity, component: WithId<T>, clearValues = false) {
	const e = entity as IEntityInternal
	if (!e.componentIds.has(component.id)) {
		return
	}

	const wi = entity.worldIndex

	if (clearValues) {
		const c = component as unknown as WithDefaults<T, A>
		const fields = c._fields
		for (const field of fields) {
			const f = component[field]
			if (!Array.isArray(f)) {
				continue
			}

			if (f[wi] === undefined) {
				continue
			}

			f[wi][entity.index] = undefined
		}
	}

	// remove before firing events so query handlers see correct state
	e.componentIds.delete(component.id)

	const world = entity.getWorld() as IWorldInternal
	const removeHandlers = world.onRemoveComponent
	const removeLen = removeHandlers.length
	if (removeLen > 0) {
		for (let i = 0; i < removeLen; i++) {
			removeHandlers[i](entity, component)
		}
	}
}

/**
 * Register a handler called when any component is removed from an entity in this world.
 * Handler receives (entity, component) — compare component by reference (===) to filter.
 * Returns an unsubscribe function.
 */
export function onWorldRemoveComponent(
	world: IWorld,
	handler: (entity: IEntity, component: unknown) => void
): () => void {
	const w = world as IWorldInternal
	w.onRemoveComponent.push(handler)
	return () => {
		const idx = w.onRemoveComponent.indexOf(handler)
		if (idx !== -1) {
			w.onRemoveComponent.splice(idx, 1)
		}
	}
}
