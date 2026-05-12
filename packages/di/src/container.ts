import type { Token, TokenValue, TokenType } from '@2817/token'
import type { Container, BindingBuilder, DepsBuilder, ScopeBuilder, Binding, Factory, Class } from './types'
import { injected as registerInjected, getInjectedTokens } from './injected'
export { injected } from './injected'

// ─── Errors ──────────────────────────────────────────────────────────────────

export class MissingBindingError extends Error {
	constructor(description: string) {
		super(`No binding found for token: "${description}"`)
		this.name = 'MissingBindingError'
	}
}

export class DuplicateBindingError extends Error {
	constructor(description: string) {
		super(`Token "${description}" is already bound. Use a separate token or create a child container.`)
		this.name = 'DuplicateBindingError'
	}
}

export class CircularDependencyError extends Error {
	constructor(chain: string[]) {
		super(`Circular dependency detected: ${chain.join(' → ')}`)
		this.name = 'CircularDependencyError'
	}
}

// ─── Container scope cache ────────────────────────────────────────────────────

// Per-container-scope cache: WeakMap<Container, Map<symbol, unknown>>
const containerScopeCache = new WeakMap<object, Map<symbol, unknown>>()

function getContainerCache(container: object): Map<symbol, unknown> {
	let cache = containerScopeCache.get(container)
	if (cache === undefined) {
		cache = new Map()
		containerScopeCache.set(container, cache)
	}
	return cache
}

// ─── Container implementation ─────────────────────────────────────────────────

class ContainerImpl implements Container {
	// Local bindings for this container
	private readonly bindings = new Map<symbol, Binding>()
	// Parent container for fallback resolution
	private readonly parent: ContainerImpl | null
	// Resolving set shared from root — detects cycles across parent/child boundaries
	private readonly rootResolvingSet: Set<symbol>
	// Resolving chain for error messages (stack, push/pop in try/finally)
	private readonly resolvingChain: string[]
	// Whether this container has been destroyed
	private destroyed = false

	constructor(parent: ContainerImpl | null, rootResolvingSet: Set<symbol>, resolvingChain: string[]) {
		this.parent = parent
		this.rootResolvingSet = rootResolvingSet
		this.resolvingChain = resolvingChain
	}

	bind<T>(token: Token<T>): BindingBuilder<T> {
		if (this.destroyed) {
			throw new Error('Container has been destroyed')
		}
		const sym = token.__s
		if (this.bindings.has(sym)) {
			throw new DuplicateBindingError(token.__d)
		}

		const binding: Binding<T> = {
			token,
			type: 'factory', // overwritten by builder
			scope: 'transient',
			hasCachedInstance: false,
		}

		const makeScopeBuilder = (): ScopeBuilder => ({
			asSingleton: () => { binding.scope = 'singleton' },
			asTransient: () => { binding.scope = 'transient' },
			asContainerScoped: () => { binding.scope = 'container' },
			// Backwards-compat aliases
			inSingletonScope: () => { binding.scope = 'singleton' },
			inTransientScope: () => { binding.scope = 'transient' },
			inContainerScope: () => { binding.scope = 'container' },
		})

		// Runtime builder is erased — the container doesn't care about positional
		// parameter types, only tokens. The DepsBuilder<T, A> shape enforced by
		// BindingBuilder is a compile-time contract bridged here by a cast.
		const makeDepsBuilder = <A extends readonly unknown[]>(
			injectable: Factory<T> | Class<T>
		): DepsBuilder<T, A> => {
			const scopeBuilder = makeScopeBuilder()
			const depsBuilder = {
				withDeps: (...tokens: readonly TokenValue[]) => {
					;(registerInjected as (fn: Function, ...toks: readonly TokenValue[]) => void)(injectable, ...tokens)
					return scopeBuilder
				},
				...scopeBuilder,
			}
			return depsBuilder as unknown as DepsBuilder<T, A>
		}

		const builder: BindingBuilder<T> = {
			toValue: (value: T) => {
				;(binding as any).type = 'value'
				;(binding as any).value = value
				;(binding as any).scope = 'singleton'
				;(binding as any).cachedInstance = value
				;(binding as any).hasCachedInstance = true
				this.bindings.set(sym, binding as Binding)
			},
			toFactory: <A extends readonly unknown[]>(factory: (...args: A) => T) => {
				;(binding as any).type = 'factory'
				;(binding as any).factory = factory
				this.bindings.set(sym, binding as Binding)
				return makeDepsBuilder<A>(factory as Factory<T>)
			},
			toClass: <A extends readonly unknown[]>(ctor: new (...args: A) => T) => {
				;(binding as any).type = 'class'
				;(binding as any).ctor = ctor
				this.bindings.set(sym, binding as Binding)
				return makeDepsBuilder<A>(ctor as Class<T>)
			},
		}

		return builder
	}

	get<V extends TokenValue>(token: V): TokenType<V> {
		if (this.destroyed) {
			throw new Error('Container has been destroyed')
		}
		// Optional token: return undefined if unbound
		if (token.__o) {
			try {
				return this._resolve(token.__s, token.__d) as TokenType<V>
			} catch (e) {
				if (e instanceof MissingBindingError) {
					return undefined as TokenType<V>
				}
				throw e
			}
		}
		return this._resolve(token.__s, token.__d) as TokenType<V>
	}

	private _resolve(sym: symbol, description: string): unknown {
		// Cycle detection — shared set from root
		if (this.rootResolvingSet.has(sym)) {
			const chain = [...this.resolvingChain, description]
			throw new CircularDependencyError(chain)
		}

		// Find the binding owner (may be this container or an ancestor)
		const owner = this._findOwner(sym)
		if (owner === null) {
			throw new MissingBindingError(description)
		}

		const binding = owner.bindings.get(sym)!

		// Value bindings are always pre-cached
		if (binding.type === 'value') {
			return binding.cachedInstance
		}

		// Singleton: cache lives on the BINDING OWNER
		if (binding.scope === 'singleton') {
			if (binding.hasCachedInstance) {
				return binding.cachedInstance
			}
			this.rootResolvingSet.add(sym)
			this.resolvingChain.push(description)
			try {
				const instance = binding.type === 'class'
					? this._callClass(binding.ctor!)
					: this._callFactory(binding.factory!)
				;(binding as any).cachedInstance = instance
				;(binding as any).hasCachedInstance = true
				return instance
			} finally {
				this.rootResolvingSet.delete(sym)
				this.resolvingChain.pop()
			}
		}

		// Container scope: cache lives on the RESOLVING container
		if (binding.scope === 'container') {
			const cache = getContainerCache(this)
			if (cache.has(sym)) {
				return cache.get(sym)
			}
			this.rootResolvingSet.add(sym)
			this.resolvingChain.push(description)
			try {
				const instance = binding.type === 'class'
					? this._callClass(binding.ctor!)
					: this._callFactory(binding.factory!)
				cache.set(sym, instance)
				return instance
			} finally {
				this.rootResolvingSet.delete(sym)
				this.resolvingChain.pop()
			}
		}

		// Transient: new instance every call
		this.rootResolvingSet.add(sym)
		this.resolvingChain.push(description)
		try {
			return binding.type === 'class'
				? this._callClass(binding.ctor!)
				: this._callFactory(binding.factory!)
		} finally {
			this.rootResolvingSet.delete(sym)
			this.resolvingChain.pop()
		}
	}

	private _callFactory(factory: Factory<unknown>): unknown {
		const depTokens = getInjectedTokens(factory)
		if (depTokens === undefined) {
			if (factory.length > 0) {
				throw new Error(
					`Factory "${factory.name || '(anonymous)'}" has ${factory.length} parameter(s) but no deps were registered. Use .withDeps(TokenA, ...) when binding.`
				)
			}
			return factory()
		}
		if (depTokens.length === 0) {
			return factory()
		}
		const args = depTokens.map(depToken => this.get(depToken))
		return factory(...args)
	}

	private _callClass(ctor: Class<unknown>): unknown {
		const depTokens = getInjectedTokens(ctor)
		if (depTokens === undefined) {
			if (ctor.length > 0) {
				throw new Error(
					`Class "${ctor.name}" has ${ctor.length} constructor parameter(s) but no deps were registered. Use .withDeps(TokenA, ...) when binding.`
				)
			}
			return new ctor()
		}
		if (depTokens.length === 0) {
			return new ctor()
		}
		const args = depTokens.map(depToken => this.get(depToken))
		return new ctor(...args)
	}

	private _findOwner(sym: symbol): ContainerImpl | null {
		if (this.bindings.has(sym)) {
			return this
		}
		if (this.parent !== null) {
			return this.parent._findOwner(sym)
		}
		return null
	}

	createChild(): Container {
		return new ContainerImpl(this, this.rootResolvingSet, this.resolvingChain)
	}

	destroy(): void {
		if (this.destroyed) {
			return
		}
		this.destroyed = true
		// The container destroys what the container created — factory and class
		// singletons it cached. It does NOT destroy `toValue` bindings: those are
		// pre-built instances handed in from outside, and ownership of their
		// lifecycle stays with the caller (matches .NET DI, Spring, Inversify,
		// TSyringe). Disposing a caller-owned instance from inside the container
		// stomps on the caller's destroy ordering — see the gravity-dash Pixi
		// double-destroy case where v2-boot owns `app.destroy(true, {children:
		// true})` for full cleanup; the container must not pre-empt that with a
		// no-args destroy().
		for (const binding of this.bindings.values()) {
			if (binding.type === 'value') continue
			if (binding.hasCachedInstance) {
				const inst = binding.cachedInstance as any
				if (inst !== null && typeof inst === 'object' && typeof inst.destroy === 'function') {
					inst.destroy()
				}
			}
		}
		this.bindings.clear()
	}
}

// ─── Public factory ───────────────────────────────────────────────────────────

export function createContainer(): Container {
	// Root container: owns the resolving set and chain
	return new ContainerImpl(null, new Set<symbol>(), [])
}
