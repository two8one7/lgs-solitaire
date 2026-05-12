import { describe, it, expect } from 'vitest'
import { createToken } from './token'
import type { Token, OptionalToken } from './token'

describe('createToken', () => {
	it('returns an object with __d equal to the description string', () => {
		const token = createToken<number>('my-description')
		expect(token.__d).toBe('my-description')
	})

	it('sets __o to false on a required token', () => {
		const token = createToken<string>('required-token')
		expect(token.__o).toBe(false)
	})

	it('sets __s to a Symbol', () => {
		const token = createToken<boolean>('symbolic')
		expect(typeof token.__s).toBe('symbol')
	})

	it('creates __s as a non-global symbol (Symbol.keyFor returns undefined)', () => {
		const token = createToken<number>('non-global')
		expect(Symbol.keyFor(token.__s)).toBeUndefined()
	})
})

describe('identity', () => {
	it('two tokens with the same description are not equal (different __s)', () => {
		const a = createToken<number>('same-desc')
		const b = createToken<number>('same-desc')
		expect(a.__s).not.toBe(b.__s)
		expect(a).not.toBe(b)
	})

	it('the same token reference is equal to itself', () => {
		const token = createToken<string>('self-eq')
		expect(token).toBe(token)
		expect(token.__s).toBe(token.__s)
	})

	it('token __s can be used as a Map key', () => {
		const token = createToken<number>('map-key')
		const map = new Map<symbol, string>()
		map.set(token.__s, 'value')
		expect(map.get(token.__s)).toBe('value')
	})
})

describe('optional accessor', () => {
	it('returns an object with __o: true', () => {
		const token = createToken<number>('opt-token')
		const optional = token.optional
		expect(optional.__o).toBe(true)
	})

	it('preserves the same __s as the parent token', () => {
		const token = createToken<string>('opt-same-symbol')
		expect(token.optional.__s).toBe(token.__s)
	})

	it('preserves the same __d as the parent token', () => {
		const token = createToken<number>('opt-same-desc')
		expect(token.optional.__d).toBe(token.__d)
	})

	it('returns the same object on repeated access (referential equality)', () => {
		const token = createToken<boolean>('opt-ref-eq')
		const first = token.optional
		const second = token.optional
		expect(first).toBe(second)
	})
})

describe('phantom type (compile-time)', () => {
	it('allows assigning Token<number> to Token<number>', () => {
		const numToken = createToken<number>('num')
		const same: Token<number> = numToken
		expect(same.__s).toBe(numToken.__s)
	})

	it('disallows assigning Token<number> to Token<string>', () => {
		const numToken = createToken<number>('num')
		// @ts-expect-error — Token<number> is not assignable to Token<string>
		const _stringToken: Token<string> = numToken
		expect(_stringToken).toBeDefined()
	})
})

describe('runtime overhead', () => {
	it('token creation does not throw', () => {
		expect(() => createToken<number>('safe')).not.toThrow()
	})

	it('all four fields are present and have correct types', () => {
		const token = createToken<number>('complete')
		expect(typeof token.__s).toBe('symbol')
		expect(typeof token.__d).toBe('string')
		expect(typeof token.__o).toBe('boolean')
		// __t is phantom — only exists at compile time, no runtime assertion possible
	})
})
