import { expect, test } from 'vitest'
import {
	addComponent,
	createComponent,
	createTag,
	hasComponent,
	removeComponent,
} from './component'
import { createWorld } from './world'
import { createEntity } from './entity'

test('components basic', () => {
	const Test = createComponent({
		name: { type: String, default: '' },
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})

	const w = createWorld()
	const e = createEntity(w)
	addComponent(e, Test, {
		name: 'test',
	})

	expect(Test.name[e.worldIndex][e.index]).toBe('test')
	expect(Test.x[e.worldIndex][e.index]).toBe(0)
	expect(Test.y[e.worldIndex][e.index]).toBe(0)
})

test('components with defaults', () => {
	const Test = createComponent({
		name: { type: String, default: 'default-name' },
		x: { type: Number, default: 42 },
	})

	const w = createWorld()
	const e = createEntity(w)
	addComponent(e, Test)

	expect(Test.name[e.worldIndex][e.index]).toBe('default-name')
	expect(Test.x[e.worldIndex][e.index]).toBe(42)
})

test('components remove', () => {
	const Test = createComponent({
		name: { type: String, default: '' },
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})

	const w = createWorld()
	const e = createEntity(w)
	addComponent(e, Test, {
		name: 'test',
	})

	expect(hasComponent(e, Test)).toBe(true)
	expect(Test.name[e.worldIndex][e.index]).toBe('test')

	removeComponent(e, Test)

	expect(hasComponent(e, Test)).toBe(false)
})

test('direct write updates value', () => {
	const Test = createComponent({
		x: { type: Number, default: 0 },
	})

	const w = createWorld()
	const e = createEntity(w)
	addComponent(e, Test, { x: 5 })

	expect(Test.x[e.worldIndex][e.index]).toBe(5)

	Test.x[e.worldIndex][e.index] = 10
	expect(Test.x[e.worldIndex][e.index]).toBe(10)
})

test('direct write updates multiple fields', () => {
	const Test = createComponent({
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})

	const w = createWorld()
	const e = createEntity(w)
	addComponent(e, Test, { x: 1, y: 2 })

	Test.x[e.worldIndex][e.index] = 10
	Test.y[e.worldIndex][e.index] = 20
	expect(Test.x[e.worldIndex][e.index]).toBe(10)
	expect(Test.y[e.worldIndex][e.index]).toBe(20)
})

test('addComponent is idempotent', () => {
	const Test = createComponent({
		x: { type: Number, default: 0 },
	})

	const w = createWorld()
	const e = createEntity(w)
	addComponent(e, Test, { x: 5 })
	addComponent(e, Test, { x: 99 }) // should be ignored

	expect(Test.x[e.worldIndex][e.index]).toBe(5)
})

test('entity.worldIndex is set correctly', () => {
	const w = createWorld()
	const e = createEntity(w)

	expect(e.worldIndex).toBe(w.index)
})

test('direct array access returns correct values', () => {
	const Position = createComponent({
		x: { type: Number, default: 0 },
		y: { type: Number, default: 0 },
	})

	const w = createWorld()
	const e = createEntity(w)
	addComponent(e, Position, { x: 42, y: 99 })

	expect(Position.x[e.worldIndex][e.index]).toBe(42)
	expect(Position.y[e.worldIndex][e.index]).toBe(99)

	Position.x[e.worldIndex][e.index] = 100
	expect(Position.x[e.worldIndex][e.index]).toBe(100)
})

test('removeComponent on entity without component is safe', () => {
	const w = createWorld()
	const e = createEntity(w)
	const A = createComponent({ x: { type: 'number', default: 0 } })

	// never added A — should be a no-op, not a crash
	expect(hasComponent(e, A)).toBe(false)
	removeComponent(e, A)
	expect(hasComponent(e, A)).toBe(false)
})

test('removeComponent with clearValues zeros out field data', () => {
	const w = createWorld()
	const e = createEntity(w)
	const A = createComponent({ x: { type: 'number', default: 0 }, y: { type: 'number', default: 0 } })

	addComponent(e, A, { x: 42, y: 99 })
	expect(A.x[e.worldIndex][e.index]).toBe(42)
	expect(A.y[e.worldIndex][e.index]).toBe(99)

	removeComponent(e, A, true)

	expect(hasComponent(e, A)).toBe(false)
	expect(A.x[e.worldIndex][e.index]).toBeUndefined()
	expect(A.y[e.worldIndex][e.index]).toBeUndefined()
})

test('addComponent to multiple entities — independent values', () => {
	const w = createWorld()
	const e1 = createEntity(w)
	const e2 = createEntity(w)
	const A = createComponent({ val: { type: 'number', default: 0 } })

	addComponent(e1, A, { val: 10 })
	addComponent(e2, A, { val: 20 })

	expect(A.val[e1.worldIndex][e1.index]).toBe(10)
	expect(A.val[e2.worldIndex][e2.index]).toBe(20)

	// mutating one doesn't affect the other
	A.val[e1.worldIndex][e1.index] = 999
	expect(A.val[e2.worldIndex][e2.index]).toBe(20)
})

test('tag components (no fields) can be added and removed', () => {
	const w = createWorld()
	const e = createEntity(w)
	const MyTag = createTag()

	expect(hasComponent(e, MyTag)).toBe(false)

	addComponent(e, MyTag)
	expect(hasComponent(e, MyTag)).toBe(true)

	removeComponent(e, MyTag)
	expect(hasComponent(e, MyTag)).toBe(false)
})
