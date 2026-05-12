import { test, expect } from 'vitest'
import {
	addComponent,
	createComponent,
	createTag,
	hasComponent,
	removeComponent,
} from './component'
import { createEntity, getEntityById } from './entity'
import {
	createWorld,
	clearWorld,
	destroyWorld,
	deserializeWorld,
	registerComponent,
	serializeWorld,
} from './world'
import { createQuery } from './query'
import type { IWorldInternal } from './internalTypes'

test('world serialization', () => {
	const world = createWorld()
	const entity = createEntity(world)
	const entity2 = createEntity(world)

	const Test = createComponent(
		{
			name: { type: String, default: '' },
			x: { type: Number, default: 0 },
			y: { type: Number, default: 0 },
		},
		{ id: 'test' }
	)
	const Test2 = createComponent(
		{
			name: { type: String, default: '' },
			x: { type: Number, default: 0 },
			y: { type: Number, default: 0 },
		},
		{ id: 'test2' }
	)

	addComponent(entity, Test, {
		name: 'test',
	})
	addComponent(entity, Test2, {
		name: 'test2',
	})

	addComponent(entity2, Test, {
		name: 'test',
	})

	const serializedWorld = serializeWorld(world)
	console.log(JSON.stringify(serializedWorld, null, 2))

	const world2 = createWorld()
	registerComponent(world2, Test)
	registerComponent(world2, Test2)

	const [w2e, w2e2] = deserializeWorld(world2, serializedWorld)
	expect(w2e.id).toEqual(entity.id)
	expect(w2e2.id).toEqual(entity2.id)

	expect(Test.name[w2e.worldIndex][w2e.index]).toEqual(
		Test.name[entity.worldIndex][entity.index]
	)
	expect(Test2.name[w2e.worldIndex][w2e.index]).toEqual(
		Test2.name[entity.worldIndex][entity.index]
	)
	expect(Test.name[w2e2.worldIndex][w2e2.index]).toEqual(
		Test.name[entity2.worldIndex][entity2.index]
	)

	// test remove component
	removeComponent(entity, Test2)

	const serializedWorld2 = serializeWorld(world)
	const [_w2e] = deserializeWorld(world2, serializedWorld2)

	expect(hasComponent(_w2e, Test2)).toEqual(false)
})

test('destroyWorld cleans up queries and handlers', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const e = createEntity(world)
	addComponent(e, A)

	const q = createQuery(world, { with: [A] })
	expect(q().length).toBe(1)

	const w = world as unknown as IWorldInternal

	// handlers should exist before destroy
	expect(w.onAddComponent.length).toBeGreaterThan(0)
	expect(w.onRemoveComponent.length).toBeGreaterThan(0)

	destroyWorld(world)

	expect(w.onAddComponent.length).toBe(0)
	expect(w.onRemoveComponent.length).toBe(0)
	expect(w.isDestroyed).toBe(true)
})

test('clearWorld removes all entities', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const e1 = createEntity(world)
	addComponent(e1, A, { val: 1 })
	const e1Id = e1.id

	const e2 = createEntity(world)
	addComponent(e2, A, { val: 2 })
	const e2Id = e2.id

	const q = createQuery(world, { with: [A] })
	expect(q().length).toBe(2)

	clearWorld(world)

	// queries should be empty
	expect(q().length).toBe(0)

	// lookups should return undefined
	expect(getEntityById(world, e1Id)).toBeUndefined()
	expect(getEntityById(world, e2Id)).toBeUndefined()
})
