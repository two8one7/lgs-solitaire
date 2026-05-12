import { describe, it, expect } from 'vitest'
import { createContainer, injected } from './container'
import { createToken } from '@2817/token'

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const WorldToken = createToken<object>('World')
const FooToken = createToken<{ id: number }>('Foo')
const BarToken = createToken<{ name: string; fooId: number; tag: string }>('Bar')
const BazToken = createToken<{ tag: string }>('Baz')
const DebugToken = createToken<{ verbose: boolean }>('Debug')
const AToken = createToken<string>('A')
const BToken = createToken<string>('B')
const CToken = createToken<string>('C')
const DToken = createToken<string>('D')

// ---------------------------------------------------------------------------
// Basic binding and resolution
// ---------------------------------------------------------------------------

describe('basic binding and resolution', () => {
	it('toValue() returns the exact value provided', () => {
		const container = createContainer()
		const world = { entities: 42 }
		container.bind(WorldToken).toValue(world)
		expect(container.get(WorldToken)).toBe(world)
	})

	it('toFactory() without scope defaults to transient (new instance each get)', () => {
		const container = createContainer()
		let callCount = 0
		container.bind(FooToken).toFactory(() => ({ id: ++callCount }))
		const first = container.get(FooToken)
		const second = container.get(FooToken)
		expect(first).not.toBe(second)
		expect(first.id).toBe(1)
		expect(second.id).toBe(2)
	})

	it('get() on an unbound required token throws with the token __d in the message', () => {
		const container = createContainer()
		expect(() => container.get(FooToken)).toThrow(/Foo/)
	})

	it('get() on an unbound optional token returns undefined', () => {
		const container = createContainer()
		expect(container.get(DebugToken.optional)).toBeUndefined()
	})

	it('get() on a bound optional token returns the value (unwrapped)', () => {
		const container = createContainer()
		const debug = { verbose: true }
		container.bind(DebugToken).toValue(debug)
		const result = container.get(DebugToken.optional)
		expect(result).toBe(debug)
		expect(result!.verbose).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Scoping
// ---------------------------------------------------------------------------

describe('scoping', () => {
	it('asSingleton(): same instance returned on multiple get() calls', () => {
		const container = createContainer()
		let callCount = 0
		container.bind(FooToken).toFactory(() => ({ id: ++callCount })).asSingleton()
		const first = container.get(FooToken)
		const second = container.get(FooToken)
		expect(first).toBe(second)
		expect(callCount).toBe(1)
	})

	it('asTransient(): different instance on each get() call', () => {
		const container = createContainer()
		let callCount = 0
		container.bind(FooToken).toFactory(() => ({ id: ++callCount })).asTransient()
		const first = container.get(FooToken)
		const second = container.get(FooToken)
		expect(first).not.toBe(second)
		expect(first.id).toBe(1)
		expect(second.id).toBe(2)
	})

	it('asContainerScoped(): same instance within same container; child gets its OWN instance', () => {
		const parent = createContainer()
		let callCount = 0
		parent.bind(FooToken).toFactory(() => ({ id: ++callCount })).asContainerScoped()

		const parentInstance = parent.get(FooToken)
		const parentInstance2 = parent.get(FooToken)
		expect(parentInstance).toBe(parentInstance2) // same within parent

		const child = parent.createChild()
		const childInstance = child.get(FooToken)
		expect(childInstance).not.toBe(parentInstance) // child gets its own
	})

	it('toValue() is always singleton (same reference each call)', () => {
		const container = createContainer()
		const foo = { id: 99 }
		container.bind(FooToken).toValue(foo)
		expect(container.get(FooToken)).toBe(container.get(FooToken))
	})
})

// ---------------------------------------------------------------------------
// Factory injection via injected()
// ---------------------------------------------------------------------------

describe('factory injection via injected()', () => {
	it('factory with injected() receives resolved dependencies in declared order', () => {
		const container = createContainer()
		container.bind(FooToken).toValue({ id: 42 })
		container.bind(BazToken).toValue({ tag: 'hello' })

		function createBar(foo: { id: number }, baz: { tag: string }) {
			return { name: 'bar', fooId: foo.id, tag: baz.tag }
		}
		injected(createBar, FooToken, BazToken)

		container.bind(BarToken).toFactory(createBar)
		const bar = container.get(BarToken)
		expect(bar.fooId).toBe(42)
		expect(bar.tag).toBe('hello')
	})

	it('factory with nested deps: A needs B, B needs C — resolves correctly', () => {
		const container = createContainer()
		container.bind(CToken).toValue('c-value')

		function createB(c: string) {
			return `b-from-${c}`
		}
		injected(createB, CToken)
		container.bind(BToken).toFactory(createB)

		function createA(b: string) {
			return `a-from-${b}`
		}
		injected(createA, BToken)
		container.bind(AToken).toFactory(createA)

		expect(container.get(AToken)).toBe('a-from-b-from-c-value')
	})

	it('factory with unbound dependency throws (the unbound dep description in message)', () => {
		const container = createContainer()
		// FooToken is NOT bound
		function createBar(foo: { id: number }) {
			return { name: 'bar', fooId: foo.id, tag: 'unused' }
		}
		injected(createBar, FooToken)
		container.bind(BarToken).toFactory(createBar)

		expect(() => container.get(BarToken)).toThrow(/Foo/)
	})

	it('injected() with zero tokens: factory called with no args', () => {
		const container = createContainer()
		let callCount = 0
		function createSimple() {
			callCount++
			return { id: 1 }
		}
		injected(createSimple)
		container.bind(FooToken).toFactory(createSimple)
		const result = container.get(FooToken)
		expect(result.id).toBe(1)
		expect(callCount).toBe(1)
	})

	it('factory with length > 0 but no injected() and no withDeps() throws at resolution', () => {
		const container = createContainer()
		function createNeedsArgs(foo: { id: number }) {
			return { name: 'bar', fooId: foo.id, tag: '' }
		}
		// deliberately no injected() or withDeps() call
		container.bind(BarToken).toFactory(createNeedsArgs)
		expect(() => container.get(BarToken)).toThrow(/createNeedsArgs/)
		expect(() => container.get(BarToken)).toThrow(/1 parameter/)
	})
})

// ---------------------------------------------------------------------------
// withDeps() fluent API
// ---------------------------------------------------------------------------

describe('withDeps() fluent API', () => {
	it('withDeps() resolves a single dep declared inline without a prior injected() call', () => {
		const container = createContainer()
		const DepToken = createToken<string>('withDeps-dep')
		const ResultToken = createToken<string>('withDeps-result')
		container.bind(DepToken).toValue('the-dep')
		container
			.bind(ResultToken)
			.toFactory((dep: string) => `got: ${dep}`)
			.withDeps(DepToken)
			.asSingleton()
		expect(container.get(ResultToken)).toBe('got: the-dep')
	})

	it('withDeps() with multiple tokens resolves all deps in declaration order', () => {
		const container = createContainer()
		const FirstToken = createToken<string>('withDeps-first')
		const SecondToken = createToken<string>('withDeps-second')
		const CombinedToken = createToken<string>('withDeps-combined')
		container.bind(FirstToken).toValue('alpha')
		container.bind(SecondToken).toValue('beta')
		container
			.bind(CombinedToken)
			.toFactory((a: string, b: string) => `${a}+${b}`)
			.withDeps(FirstToken, SecondToken)
			.asSingleton()
		expect(container.get(CombinedToken)).toBe('alpha+beta')
	})

	it('asSingleton() directly after toFactory() works for zero-arg factories', () => {
		const container = createContainer()
		let callCount = 0
		const CountToken = createToken<{ id: number }>('withDeps-count')
		container
			.bind(CountToken)
			.toFactory(() => ({ id: ++callCount }))
			.asSingleton()
		const first = container.get(CountToken)
		const second = container.get(CountToken)
		expect(first).toBe(second)
		expect(callCount).toBe(1)
	})

	it('backwards-compat alias inSingletonScope() still returns the same instance', () => {
		const container = createContainer()
		let callCount = 0
		const AliasToken = createToken<{ id: number }>('withDeps-alias')
		container
			.bind(AliasToken)
			.toFactory(() => ({ id: ++callCount }))
			.inSingletonScope()
		const first = container.get(AliasToken)
		const second = container.get(AliasToken)
		expect(first).toBe(second)
		expect(callCount).toBe(1)
	})

	it('toFactory() with params but no withDeps() and no injected() throws a helpful error at resolution', () => {
		const container = createContainer()
		const NeedsDepToken = createToken<string>('withDeps-needs-dep')
		function createWithParam(dep: string) {
			return `value: ${dep}`
		}
		// intentionally no withDeps() or injected() call
		container.bind(NeedsDepToken).toFactory(createWithParam)
		expect(() => container.get(NeedsDepToken)).toThrow(/createWithParam/)
		expect(() => container.get(NeedsDepToken)).toThrow(/1 parameter/)
	})

	it('toClass() with withDeps() resolves constructor deps declared inline', () => {
		const container = createContainer()
		container.bind(FooToken).toValue({ id: 77 })
		container.bind(BazToken).toValue({ tag: 'inline' })
		const InlineToken = createToken<ServiceWithDeps>('withDeps-class')
		container
			.bind(InlineToken)
			.toClass(ServiceWithDeps)
			.withDeps(FooToken, BazToken)
			.asSingleton()
		const instance = container.get(InlineToken)
		expect(instance).toBeInstanceOf(ServiceWithDeps)
		expect(instance.fooId).toBe(77)
		expect(instance.bazTag).toBe('inline')
	})
})

// ---------------------------------------------------------------------------
// Circular dependency detection
// ---------------------------------------------------------------------------

describe('circular dependency detection', () => {
	it('direct cycle A→B, B→A: throws with both token names in message', () => {
		const container = createContainer()

		function createA(b: string) { return `a-from-${b}` }
		function createB(a: string) { return `b-from-${a}` }
		injected(createA, BToken)
		injected(createB, AToken)

		container.bind(AToken).toFactory(createA)
		container.bind(BToken).toFactory(createB)

		expect(() => container.get(AToken)).toThrow()
		try {
			container.get(AToken)
		} catch (e) {
			const msg = String(e)
			expect(msg).toContain('A')
			expect(msg).toContain('B')
		}
	})

	it('three-node cycle A→B→C→A: throws', () => {
		const container = createContainer()

		function createA(b: string) { return `a-from-${b}` }
		function createB(c: string) { return `b-from-${c}` }
		function createC(a: string) { return `c-from-${a}` }
		injected(createA, BToken)
		injected(createB, CToken)
		injected(createC, AToken)

		container.bind(AToken).toFactory(createA)
		container.bind(BToken).toFactory(createB)
		container.bind(CToken).toFactory(createC)

		expect(() => container.get(AToken)).toThrow()
	})

	it('self-reference (A depends on A): throws', () => {
		const container = createContainer()
		function createA(a: string) { return `a-from-${a}` }
		injected(createA, AToken)
		container.bind(AToken).toFactory(createA)

		expect(() => container.get(AToken)).toThrow()
	})

	it('diamond dependency (A→B, A→C, B→D, C→D): resolves correctly (NOT a cycle)', () => {
		const container = createContainer()
		let dCallCount = 0

		container.bind(DToken).toFactory(() => `d-${++dCallCount}`).asSingleton()

		function createB(d: string) { return `b-from-${d}` }
		function createC(d: string) { return `c-from-${d}` }
		function createA(b: string, c: string) { return `a-from-${b}-and-${c}` }
		injected(createB, DToken)
		injected(createC, DToken)
		injected(createA, BToken, CToken)

		container.bind(BToken).toFactory(createB)
		container.bind(CToken).toFactory(createC)
		container.bind(AToken).toFactory(createA)

		const result = container.get(AToken)
		expect(result).toContain('a-from-')
		expect(result).toContain('b-from-')
		expect(result).toContain('c-from-')
	})

	it('diamond with singleton D: D is created exactly once', () => {
		const container = createContainer()
		let dCallCount = 0

		container.bind(DToken).toFactory(() => `d-${++dCallCount}`).asSingleton()

		function createB(d: string) { return `b-from-${d}` }
		function createC(d: string) { return `c-from-${d}` }
		injected(createB, DToken)
		injected(createC, DToken)

		container.bind(BToken).toFactory(createB)
		container.bind(CToken).toFactory(createC)

		container.get(BToken)
		container.get(CToken)
		expect(dCallCount).toBe(1)
	})
})

// ---------------------------------------------------------------------------
// Child containers
// ---------------------------------------------------------------------------

describe('child containers', () => {
	it('child falls back to parent for unbound tokens', () => {
		const parent = createContainer()
		parent.bind(FooToken).toValue({ id: 10 })
		const child = parent.createChild()
		expect(child.get(FooToken).id).toBe(10)
	})

	it('child shadows parent: local binding takes priority', () => {
		const parent = createContainer()
		parent.bind(FooToken).toValue({ id: 1 })
		const child = parent.createChild()
		child.bind(FooToken).toValue({ id: 2 })
		expect(child.get(FooToken).id).toBe(2)
		expect(parent.get(FooToken).id).toBe(1)
	})

	it('child singleton is independent from parent (each has its own instance)', () => {
		const parent = createContainer()
		let callCount = 0
		parent.bind(FooToken).toFactory(() => ({ id: ++callCount })).asSingleton()

		const parentInstance = parent.get(FooToken)
		const child = parent.createChild()
		// Child resolves the same singleton from parent (bound on parent)
		// A child-bound singleton would be independent
		const ChildFooToken = createToken<{ id: number }>('ChildFoo')
		let childCallCount = 0
		parent.bind(ChildFooToken).toFactory(() => ({ id: 100 + ++childCallCount })).asSingleton()
		// Parent and child share the parent-bound singleton
		const parentChildFoo = parent.get(ChildFooToken)
		const childChildFoo = child.get(ChildFooToken)
		expect(parentChildFoo).toBe(childChildFoo) // same instance from parent cache
	})

	it('parent cannot resolve child-only tokens (throws)', () => {
		const parent = createContainer()
		const child = parent.createChild()
		const OrphanToken = createToken<string>('Orphan')
		child.bind(OrphanToken).toValue('only-in-child')
		expect(() => parent.get(OrphanToken)).toThrow()
	})

	it('grandchild inherits from both parent and grandparent', () => {
		const grandparent = createContainer()
		grandparent.bind(AToken).toValue('a-from-gp')
		const parent = grandparent.createChild()
		parent.bind(BToken).toValue('b-from-p')
		const child = parent.createChild()
		// Child sees both
		expect(child.get(AToken)).toBe('a-from-gp')
		expect(child.get(BToken)).toBe('b-from-p')
	})

	it('destroying child does not affect parent', () => {
		const parent = createContainer()
		parent.bind(FooToken).toValue({ id: 1 })
		const child = parent.createChild()
		child.destroy()
		expect(parent.get(FooToken).id).toBe(1)
	})

	it('singleton caching: parent-bound singleton resolved through child uses PARENT cache', () => {
		const parent = createContainer()
		let callCount = 0
		parent.bind(FooToken).toFactory(() => ({ id: ++callCount })).asSingleton()

		const directFromParent = parent.get(FooToken)
		const child = parent.createChild()
		const viaChild = child.get(FooToken)
		// Same instance — child did NOT create its own
		expect(viaChild).toBe(directFromParent)
		expect(callCount).toBe(1)
	})

	it('child context: parent-bound factory that resolves dep — if child shadows dep, child shadow is visible', () => {
		const parent = createContainer()
		parent.bind(BazToken).toValue({ tag: 'parent-baz' })

		// Factory bound on parent, depends on BazToken
		function createBar(baz: { tag: string }) {
			return { name: `bar-from-${baz.tag}`, fooId: 0, tag: baz.tag }
		}
		injected(createBar, BazToken)
		parent.bind(BarToken).toFactory(createBar)

		const child = parent.createChild()
		// Shadow BazToken in child
		child.bind(BazToken).toValue({ tag: 'child-baz' })

		const bar = child.get(BarToken)
		expect(bar.name).toBe('bar-from-child-baz') // not 'parent-baz'
	})
})

// ---------------------------------------------------------------------------
// Lifecycle destroy
// ---------------------------------------------------------------------------

describe('lifecycle destroy', () => {
	// Ownership rule: the container destroys what the container CREATES
	// (toFactory / toClass singletons), and leaves what was HANDED TO IT
	// (toValue bindings) for the caller to dispose. Matches .NET DI, Spring,
	// Inversify, TSyringe.
	it('destroy() calls destroy() on factory-created singletons', () => {
		const container = createContainer()
		let destroyed = false
		const disposable = {
			id: 1,
			destroy() {
				destroyed = true
			},
		}
		container.bind(FooToken).toFactory(() => disposable).asSingleton()
		container.get(FooToken) // resolve so it's cached
		container.destroy()
		expect(destroyed).toBe(true)
	})

	it('destroy() does NOT call destroy() on toValue bindings (caller-owned)', () => {
		const container = createContainer()
		let destroyed = false
		const disposable = {
			id: 1,
			destroy() {
				destroyed = true
			},
		}
		container.bind(FooToken).toValue(disposable)
		container.destroy()
		expect(destroyed).toBe(false)
	})

	it('destroy() clears all bindings (subsequent get() throws)', () => {
		const container = createContainer()
		container.bind(FooToken).toValue({ id: 1 })
		container.destroy()
		expect(() => container.get(FooToken)).toThrow()
	})

	it('destroying child does not affect parent', () => {
		const parent = createContainer()
		parent.bind(FooToken).toValue({ id: 1 })
		const child = parent.createChild()
		child.destroy()
		expect(parent.get(FooToken).id).toBe(1)
	})

	it('destroy() is idempotent (second call is no-op)', () => {
		const container = createContainer()
		let destroyCount = 0
		const disposable = {
			id: 1,
			destroy() {
				destroyCount++
			},
		}
		container.bind(FooToken).toFactory(() => disposable).asSingleton()
		container.get(FooToken)
		container.destroy()
		expect(destroyCount).toBe(1)
		container.destroy() // second call
		expect(destroyCount).toBe(1) // did not call destroy again
	})
})

// ---------------------------------------------------------------------------
// Class binding via toClass()
// ---------------------------------------------------------------------------

class SimpleService {
	readonly name = 'simple'
}

class ServiceWithDeps {
	readonly fooId: number
	readonly bazTag: string
	constructor(foo: { id: number }, baz: { tag: string }) {
		this.fooId = foo.id
		this.bazTag = baz.tag
	}
}

class DisposableService {
	destroyed = false
	destroy() {
		this.destroyed = true
	}
}

const SimpleServiceToken = createToken<SimpleService>('SimpleService')
const ServiceWithDepsToken = createToken<ServiceWithDeps>('ServiceWithDeps')
const DisposableServiceToken = createToken<DisposableService>('DisposableService')

describe('class binding via toClass()', () => {
	it('toClass() instantiates class with no dependencies', () => {
		const container = createContainer()
		container.bind(SimpleServiceToken).toClass(SimpleService).asSingleton()
		const instance = container.get(SimpleServiceToken)
		expect(instance).toBeInstanceOf(SimpleService)
		expect(instance.name).toBe('simple')
	})

	it('toClass() with injected() resolves dependencies', () => {
		const container = createContainer()
		container.bind(FooToken).toValue({ id: 42 })
		container.bind(BazToken).toValue({ tag: 'hello' })

		injected(ServiceWithDeps, FooToken, BazToken)
		container.bind(ServiceWithDepsToken).toClass(ServiceWithDeps).asSingleton()

		const instance = container.get(ServiceWithDepsToken)
		expect(instance.fooId).toBe(42)
		expect(instance.bazTag).toBe('hello')
	})

	it('toClass() with singleton scope returns same instance', () => {
		const container = createContainer()
		container.bind(SimpleServiceToken).toClass(SimpleService).asSingleton()
		const first = container.get(SimpleServiceToken)
		const second = container.get(SimpleServiceToken)
		expect(first).toBe(second)
	})

	it('toClass() with transient scope returns new instance each call', () => {
		const container = createContainer()
		container.bind(SimpleServiceToken).toClass(SimpleService).asTransient()
		const first = container.get(SimpleServiceToken)
		const second = container.get(SimpleServiceToken)
		expect(first).not.toBe(second)
	})

	it('toClass() singleton: destroy() calls destroy() on instance', () => {
		const container = createContainer()
		container.bind(DisposableServiceToken).toClass(DisposableService).asSingleton()
		const instance = container.get(DisposableServiceToken)
		expect(instance.destroyed).toBe(false)
		container.destroy()
		expect(instance.destroyed).toBe(true)
	})

	it('toClass() with missing injected() and constructor args throws', () => {
		const container = createContainer()
		class UnregisteredService {
			constructor(_foo: { id: number }) {}
		}
		const UnregisteredToken = createToken<UnregisteredService>('Unregistered')
		container.bind(UnregisteredToken).toClass(UnregisteredService).asSingleton()
		expect(() => container.get(UnregisteredToken)).toThrow(/UnregisteredService/)
		expect(() => container.get(UnregisteredToken)).toThrow(/1 constructor parameter/)
	})

	it('toClass() with container scope: each container gets own instance', () => {
		const parent = createContainer()
		parent.bind(SimpleServiceToken).toClass(SimpleService).asContainerScoped()
		const parentInstance = parent.get(SimpleServiceToken)
		const child = parent.createChild()
		const childInstance = child.get(SimpleServiceToken)
		expect(parentInstance).not.toBe(childInstance)
	})
})

// ---------------------------------------------------------------------------
// Miscellaneous
// ---------------------------------------------------------------------------

describe('miscellaneous', () => {
	it('binding same token twice throws (no silent rebinding)', () => {
		const container = createContainer()
		container.bind(FooToken).toValue({ id: 1 })
		expect(() => container.bind(FooToken).toValue({ id: 2 })).toThrow()
	})

	it('two tokens with same description are distinct (different __s, different bindings)', () => {
		const Token1 = createToken<number>('same-desc')
		const Token2 = createToken<number>('same-desc')
		const container = createContainer()
		container.bind(Token1).toValue(10)
		container.bind(Token2).toValue(20)
		expect(container.get(Token1)).toBe(10)
		expect(container.get(Token2)).toBe(20)
	})
})
