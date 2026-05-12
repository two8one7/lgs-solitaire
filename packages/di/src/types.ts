import type { Token, TokenValue, TokenType } from '@2817/token'

export type { Token, TokenValue, TokenType }

// Factory: any function that returns T. Exported with a loose default tuple so
// existing consumers keep working; the precise argument tuple is captured at
// the `.toFactory()` call site via inference, not this alias.
export type Factory<T, A extends readonly unknown[] = readonly any[]> = (...args: A) => T

// Class constructor: any class that can be instantiated with new. Same story as
// Factory — exported as a loose alias for back-compat; the real tuple is
// inferred at the `.toClass()` call site.
export type Class<T, A extends readonly unknown[] = readonly any[]> = new (...args: A) => T

// Scope determines instance lifetime
export type Scope = 'singleton' | 'transient' | 'container'

// Internal binding record
export interface Binding<T = unknown> {
	readonly token: Token<T>
	readonly type: 'value' | 'factory' | 'class'
	readonly value?: T
	readonly factory?: Factory<T>
	readonly ctor?: Class<T>
	scope: Scope
	// Singleton cache lives HERE (on the binding owner), not on the resolving container
	cachedInstance?: T
	hasCachedInstance: boolean
}

// Container public interface
export interface Container {
	bind<T>(token: Token<T>): BindingBuilder<T>
	get<V extends TokenValue>(token: V): TokenType<V>
	createChild(): Container
	destroy(): void
}

// ─── Token tuple helpers ─────────────────────────────────────────────────────
//
// Given a factory/class parameter tuple `A`, `TokensFor<A>` is a tuple of
// tokens that match `A` positionally. Mapped types over tuples preserve tuple
// structure, so this flows as a rest-parameter signature and TypeScript checks
// each `withDeps(...)` argument against the corresponding factory parameter.
//
//   factory: (world: IWorld, canvas: HTMLCanvasElement) => Sys
//   A       = [IWorld, HTMLCanvasElement]
//   TokensFor<A>
//           = [TokenValue<IWorld>, TokenValue<HTMLCanvasElement>]
//
// Passing tokens in the wrong order, with the wrong types, or with the wrong
// count is a compile error.
export type TokensFor<A extends readonly unknown[]> = {
	readonly [K in keyof A]: TokenValue<A[K]>
}

// Fluent binding builder
export interface BindingBuilder<T> {
	toValue(value: T): void
	toFactory<A extends readonly unknown[]>(factory: (...args: A) => T): DepsBuilder<T, A>
	toClass<A extends readonly unknown[]>(ctor: new (...args: A) => T): DepsBuilder<T, A>
}

// Returned from toFactory()/toClass() — declare deps inline then set scope.
// The second type parameter `A` is the captured parameter tuple of the
// injectable, so `withDeps` can enforce positional token types. Defaults to
// `readonly unknown[]` so existing consumers importing `DepsBuilder<T>` with
// one generic still work.
export interface DepsBuilder<T, A extends readonly unknown[] = readonly unknown[]> extends ScopeBuilder {
	withDeps(...tokens: TokensFor<A>): ScopeBuilder
}

export interface ScopeBuilder {
	asSingleton(): void
	asTransient(): void
	asContainerScoped(): void
	// Backwards-compat aliases
	inSingletonScope(): void
	inTransientScope(): void
	inContainerScope(): void
}
