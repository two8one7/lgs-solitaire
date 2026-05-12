import { test, expect } from 'vitest'
import {
	createEntity,
	removeEntity,
	getEntityById,
	getEntityByIndex,
} from './entity'
import {
	createComponent,
	addComponent,
	hasComponent,
} from './component'
import { createWorld } from './world'
import { createQuery } from './query'

test('createEntity assigns unique index and id', () => {
	const w = createWorld()
	const e1 = createEntity(w)
	const e2 = createEntity(w)

	expect(e1.id).not.toBe(e2.id)
	expect(e1.index).not.toBe(e2.index)
	expect(e1.worldIndex).toBe(w.index)
	expect(e2.worldIndex).toBe(w.index)
})

test('createEntity with custom id returns existing entity', () => {
	const w = createWorld()
	const e1 = createEntity(w, { id: 'player' })
	const e2 = createEntity(w, { id: 'player' })

	// same reference — dedup path
	expect(e1).toBe(e2)
	expect(e1.id).toBe('player')
})

test('removeEntity removes all components', () => {
	const w = createWorld()
	const A = createComponent({ x: { type: 'number', default: 0 } })
	const B = createComponent({ y: { type: 'number', default: 0 } })

	const e = createEntity(w)
	addComponent(e, A, { x: 5 })
	addComponent(e, B, { y: 10 })

	expect(hasComponent(e, A)).toBe(true)
	expect(hasComponent(e, B)).toBe(true)

	// query should contain the entity
	const q = createQuery(w, { with: [A, B] })
	expect(q().length).toBe(1)

	removeEntity(e)

	expect(hasComponent(e, A)).toBe(false)
	expect(hasComponent(e, B)).toBe(false)

	// query should be empty
	expect(q().length).toBe(0)
})

test('removeEntity removes entity from world lookups', () => {
	const w = createWorld()
	const e = createEntity(w)
	const id = e.id
	const index = e.index

	expect(getEntityById(w, id)).toBe(e)
	expect(getEntityByIndex(w, index)).toBe(e)

	removeEntity(e)

	expect(getEntityById(w, id)).toBeUndefined()
	expect(getEntityByIndex(w, index)).toBeUndefined()
})

test('getEntityById and getEntityByIndex round-trip', () => {
	const w = createWorld()
	const e = createEntity(w)

	const byId = getEntityById(w, e.id)
	const byIndex = getEntityByIndex(w, e.index)

	expect(byId).toBe(e)
	expect(byIndex).toBe(e)
	expect(byId).toBe(byIndex)
})
