import { describe, it, expect } from 'vitest'
import { createTypedId } from '../typed-id'

describe('createTypedId', () => {
	it('returns unique values', () => {
		const a = createTypedId()
		const b = createTypedId()
		expect(a.value).not.toBe(b.value)
	})

	it('uses evt_ prefix', () => {
		const id = createTypedId()
		expect(id.value).toMatch(/^evt_\d+$/)
	})

	it('has null type at runtime', () => {
		const id = createTypedId<{ foo: number }>()
		expect(id.type).toBeNull()
	})

	it('accepts custom id string', () => {
		const id = createTypedId<unknown>('my-custom-id')
		expect(id.value).toBe('my-custom-id')
	})

	it('increments monotonically', () => {
		const a = createTypedId()
		const b = createTypedId()
		const numA = parseInt(a.value.split('_')[1], 10)
		const numB = parseInt(b.value.split('_')[1], 10)
		expect(numB).toBe(numA + 1)
	})
})
