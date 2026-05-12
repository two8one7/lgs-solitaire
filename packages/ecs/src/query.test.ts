import { test, expect } from 'vitest'

import { createWorld } from './world'
import { createEntity, removeEntity } from './entity'
import {
	createComponent,
	createTag,
	addComponent,
	removeComponent,
	hasComponent,
} from './component'
import { OR, createQuery, queryIsDirty, removeQuery } from './query'

test('query with', () => {
	const world = createWorld()
	const entity = createEntity(world)
	const entity2 = createEntity(world)

	const Test = createComponent({
		name: { type: String, default: '' },
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})
	const Test2 = createComponent({
		name: { type: String, default: '' },
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})

	addComponent(entity, Test, {
		name: 'test',
	})
	addComponent(entity, Test2, {
		name: 'test2',
	})

	addComponent(entity2, Test, {
		name: 'test',
	})

	const query = createQuery(world, {
		with: [Test, Test2],
	})

	let entities = query()
	expect(entities.map((e) => e.id)).toEqual([entity.id])

	const query2 = createQuery(world, {
		without: [Test2],
	})
	entities = query2()
	expect(entities.map((e) => e.id)).toEqual([entity2.id])
})

test('query without', () => {
	const world = createWorld()
	const entity = createEntity(world)
	const entity2 = createEntity(world)

	const Test = createComponent({
		name: { type: String, default: '' },
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})
	const Test2 = createComponent({
		name: { type: String, default: '' },
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})

	addComponent(entity, Test, {
		name: 'test',
	})
	addComponent(entity, Test2, {
		name: 'test2',
	})

	addComponent(entity2, Test, {
		name: 'test',
	})

	const query = createQuery(world, {
		without: [Test2],
	})
	const entities = query()
	expect(entities.map((e) => e.id)).toEqual([entity2.id])
})

test('query with components added later', () => {
	const world = createWorld()
	const entity = createEntity(world)

	const Test = createComponent({
		name: { type: String, default: '' },
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})
	const Test2 = createComponent({
		name: { type: String, default: '' },
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})

	addComponent(entity, Test, {
		name: 'test',
	})

	const query = createQuery(world, {
		with: [Test, Test2],
	})

	let entities = query()
	expect(entities.map((e) => e.id)).toHaveLength(0)

	addComponent(entity, Test2, {
		name: 'test',
	})

	entities = query()
	expect(entities.map((e) => e.id)).toEqual([entity.id])
})

test('queries are cached', () => {
	const world = createWorld()

	const Test = createComponent({
		name: { type: String, default: '' },
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})
	const Test2 = createComponent({
		name: { type: String, default: '' },
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})

	const query = createQuery(world, {
		with: [Test, Test2],
	})

	const query2 = createQuery(world, {
		with: [Test, Test2],
	})

	const query3 = createQuery(world, {
		with: [Test],
		without: [Test2],
	})

	expect(query()).toBe(query2())
	expect(query()).not.toBe(query3())
})

test('query with OR', () => {
	const world = createWorld()

	const Test = createComponent({
		name: { type: 'string', default: '' },
		x: { type: 'number', default: 0 },
		y: { type: 'number', default: 0 },
	})
	const Test2 = createComponent({
		name: { type: 'string', default: '' },
		x: { type: 'number', default: 0 },
		y: { type: 'number', default: 0 },
	})
	const Test3 = createComponent({
		name: { type: 'string', default: '' },
		x: { type: 'number', default: 0 },
		y: { type: 'number', default: 0 },
	})

	const query = createQuery(world, {
		with: [Test, OR(Test2, Test3)],
	})

	const entity = createEntity(world)
	addComponent(entity, Test)

	const entity2 = createEntity(world)
	addComponent(entity2, Test)
	addComponent(entity2, Test2)

	const entities = query()
	expect(entities.map((e) => e.id)).toHaveLength(1)
	expect(entities.map((e) => e.id)).toEqual([entity2.id])
})

test('query with added', () => {
	const world = createWorld()

	const Test = createComponent({
		name: { type: 'string', default: '' },
		x: { type: 'number', default: 0 },
		y: { type: 'number', default: 0 },
	})

	const query = createQuery(world, {
		with: [Test],
	})

	const entity = createEntity(world)
	addComponent(entity, Test)

	const addedEntities = query.added()
	expect(addedEntities.map((e) => e.id)).toHaveLength(1)

	const entity2 = createEntity(world)
	addComponent(entity2, Test)

	expect(addedEntities.map((e) => e.id)).toHaveLength(2)

	const entities = query()
	expect(entities.map((e) => e.id)).toHaveLength(2)
	expect(entities.map((e) => e.id)).toEqual([entity.id, entity2.id])
})

test('query with added and removed', () => {
	const world = createWorld()

	const Test = createComponent({
		name: { type: 'string', default: '' },
		x: { type: 'number', default: 0 },
		y: { type: 'number', default: 0 },
	})

	const query = createQuery(world, {
		with: [Test],
	})

	const entity = createEntity(world)
	addComponent(entity, Test)

	const entity2 = createEntity(world)
	addComponent(entity2, Test)

	const addedEntities = query.added()
	expect(addedEntities).toHaveLength(2)

	const entities = query()
	expect(entities).toHaveLength(2)

	// clear the added list explicitly
	query.added.clear()
	expect(query.added()).toHaveLength(0)

	removeComponent(entity, Test)

	const removedEntities = query.removed()
	expect(removedEntities).toHaveLength(1)
	expect(removedEntities[0].id).toBe(entity.id)

	// clear removed
	query.removed.clear()
	expect(query.removed()).toHaveLength(0)
})

test('removeComponent updates query correctly', () => {
	const world = createWorld()

	const A = createComponent({ val: { type: 'number', default: 0 } })
	const B = createComponent({ val: { type: 'number', default: 0 } })

	const entity = createEntity(world)
	addComponent(entity, A)
	addComponent(entity, B)

	const query = createQuery(world, {
		with: [A, B],
	})

	expect(query().length).toBe(1)

	removeComponent(entity, B)

	expect(query().length).toBe(0)
})

test('removing a without component adds entity back to query', () => {
	const world = createWorld()

	const Position = createComponent({ x: { type: 'number', default: 0 } })
	const Dead = createTag()

	const entity = createEntity(world)
	addComponent(entity, Position)
	addComponent(entity, Dead)

	const aliveQuery = createQuery(world, {
		with: [Position],
		without: [Dead],
	})

	// entity has Dead, should not be in query
	expect(aliveQuery().length).toBe(0)

	// remove Dead tag — entity should appear in query
	removeComponent(entity, Dead)
	expect(aliveQuery().length).toBe(1)
	expect(aliveQuery()[0].id).toBe(entity.id)
})

test('adding a without component removes entity from query', () => {
	const world = createWorld()

	const Position = createComponent({ x: { type: 'number', default: 0 } })
	const Hidden = createTag()

	const entity = createEntity(world)
	addComponent(entity, Position)

	const visibleQuery = createQuery(world, {
		with: [Position],
		without: [Hidden],
	})

	expect(visibleQuery().length).toBe(1)

	// adding Hidden should remove entity from the query
	addComponent(entity, Hidden)
	expect(visibleQuery().length).toBe(0)

	// removing Hidden should add it back
	removeComponent(entity, Hidden)
	expect(visibleQuery().length).toBe(1)
})

test('removeEntity removes from active queries', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })
	const B = createComponent({ val: { type: 'number', default: 0 } })

	const e1 = createEntity(world)
	addComponent(e1, A, { val: 1 })
	addComponent(e1, B, { val: 2 })

	const e2 = createEntity(world)
	addComponent(e2, A, { val: 3 })
	addComponent(e2, B, { val: 4 })

	const q = createQuery(world, { with: [A, B] })
	expect(q().length).toBe(2)

	removeEntity(e1)
	expect(q().length).toBe(1)
	expect(q()[0].id).toBe(e2.id)
})

test('added() does not duplicate on re-add', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const q = createQuery(world, { with: [A] })

	const e = createEntity(world)
	addComponent(e, A)

	// first added
	expect(q.added()).toHaveLength(1)

	// clear, remove, re-add
	q.added.clear()
	expect(q.added()).toHaveLength(0)

	removeComponent(e, A)
	addComponent(e, A)

	// should appear exactly once, not duplicated
	expect(q.added()).toHaveLength(1)
	expect(q.added()[0].id).toBe(e.id)
})

test('removed() tracks entity leaving query via component removal', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const e = createEntity(world)
	addComponent(e, A)

	const q = createQuery(world, { with: [A] })
	expect(q().length).toBe(1)

	// activate tracking
	q.removed()

	removeComponent(e, A)
	expect(q().length).toBe(0)
	expect(q.removed()).toHaveLength(1)
	expect(q.removed()[0].id).toBe(e.id)

	// clear and verify
	q.removed.clear()
	expect(q.removed()).toHaveLength(0)
})

test('multiple without components', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })
	const B = createTag()
	const C = createTag()

	const eOnlyA = createEntity(world)
	addComponent(eOnlyA, A)

	const eAB = createEntity(world)
	addComponent(eAB, A)
	addComponent(eAB, B)

	const eAC = createEntity(world)
	addComponent(eAC, A)
	addComponent(eAC, C)

	const eABC = createEntity(world)
	addComponent(eABC, A)
	addComponent(eABC, B)
	addComponent(eABC, C)

	const q = createQuery(world, { with: [A], without: [B, C] })

	const results = q()
	expect(results.length).toBe(1)
	expect(results[0].id).toBe(eOnlyA.id)
})

test('query on empty world then add entities', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	// create query before any entities exist
	const q = createQuery(world, { with: [A] })
	expect(q().length).toBe(0)

	// add entities after query creation
	const e1 = createEntity(world)
	addComponent(e1, A, { val: 1 })

	const e2 = createEntity(world)
	addComponent(e2, A, { val: 2 })

	expect(q().length).toBe(2)
})

test('component values survive add/remove of unrelated component', () => {
	const world = createWorld()
	const A = createComponent({ x: { type: 'number', default: 0 }, y: { type: 'number', default: 0 } })
	const B = createTag()

	const e = createEntity(world)
	addComponent(e, A, { x: 42, y: 99 })

	expect(A.x[e.worldIndex][e.index]).toBe(42)
	expect(A.y[e.worldIndex][e.index]).toBe(99)

	// add unrelated component
	addComponent(e, B)
	expect(A.x[e.worldIndex][e.index]).toBe(42)
	expect(A.y[e.worldIndex][e.index]).toBe(99)

	// remove unrelated component
	removeComponent(e, B)
	expect(A.x[e.worldIndex][e.index]).toBe(42)
	expect(A.y[e.worldIndex][e.index]).toBe(99)
})

test('query.indices parallels entities', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const q = createQuery(world, { with: [A] })

	const e1 = createEntity(world)
	addComponent(e1, A, { val: 1 })

	const e2 = createEntity(world)
	addComponent(e2, A, { val: 2 })

	const e3 = createEntity(world)
	addComponent(e3, A, { val: 3 })

	// indices should match entities
	const entities = q()
	expect(q.indices.length).toBe(entities.length)
	for (let i = 0; i < entities.length; i++) {
		expect(q.indices[i]).toBe(entities[i].index)
	}

	// remove middle entity (triggers swap-and-pop)
	removeComponent(e1, A)

	const entitiesAfter = q()
	expect(q.indices.length).toBe(entitiesAfter.length)
	for (let i = 0; i < entitiesAfter.length; i++) {
		expect(q.indices[i]).toBe(entitiesAfter[i].index)
	}

	// re-add entity
	addComponent(e1, A, { val: 10 })

	const entitiesFinal = q()
	expect(q.indices.length).toBe(entitiesFinal.length)
	for (let i = 0; i < entitiesFinal.length; i++) {
		expect(q.indices[i]).toBe(entitiesFinal[i].index)
	}
})

// --- query.dirty signal tests ---

test('query.dirty.on() fires when entity joins query', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const q = createQuery(world, { with: [A] })

	let dirtyCount = 0
	q.dirty.on(() => { dirtyCount++ })

	const e = createEntity(world)
	addComponent(e, A)

	expect(dirtyCount).toBeGreaterThan(0)
})

test('query.dirty.on() fires when entity leaves query', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const e = createEntity(world)
	addComponent(e, A)

	const q = createQuery(world, { with: [A] })

	let dirtyCount = 0
	q.dirty.on(() => { dirtyCount++ })

	removeComponent(e, A)

	expect(dirtyCount).toBeGreaterThan(0)
})

test('queryIsDirty() tracks dirty state', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const q = createQuery(world, { with: [A] })

	// fresh query with no entities — not dirty after calling it
	q()
	q.clearDirty()
	expect(queryIsDirty(q)).toBe(false)

	const e = createEntity(world)
	addComponent(e, A)

	expect(queryIsDirty(q)).toBe(true)

	q.clearDirty()
	expect(queryIsDirty(q)).toBe(false)
})

test('query.dirty.on() with multiple subscribers', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const q = createQuery(world, { with: [A] })

	let count1 = 0
	let count2 = 0
	q.dirty.on(() => { count1++ })
	q.dirty.on(() => { count2++ })

	const e = createEntity(world)
	addComponent(e, A)

	expect(count1).toBeGreaterThan(0)
	expect(count2).toBeGreaterThan(0)
})

test('query.dirty unsubscribe stops notifications', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const q = createQuery(world, { with: [A] })

	let dirtyCount = 0
	const unsub = q.dirty.on(() => { dirtyCount++ })

	const e1 = createEntity(world)
	addComponent(e1, A)

	const countAfterFirst = dirtyCount
	expect(countAfterFirst).toBeGreaterThan(0)

	unsub()

	const e2 = createEntity(world)
	addComponent(e2, A)

	// count should not have increased after unsubscribe
	expect(dirtyCount).toBe(countAfterFirst)
})

test('removeQuery destroys dirty signal', () => {
	const world = createWorld()
	const A = createComponent({ val: { type: 'number', default: 0 } })

	const q = createQuery(world, { with: [A] })

	let dirtyCount = 0
	q.dirty.on(() => { dirtyCount++ })

	removeQuery(q)

	const e = createEntity(world)
	addComponent(e, A)

	// dirty signal was destroyed, so our callback should not fire
	expect(dirtyCount).toBe(0)
})
