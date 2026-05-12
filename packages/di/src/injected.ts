import type { TokenValue } from '@2817/token'
import type { TokensFor } from './types'

// WeakMap from factory function / constructor → ordered token dependencies
const registry = new WeakMap<Function, readonly TokenValue[]>()

/**
 * Register dependency tokens for a factory function or class constructor.
 * The container resolves these tokens in order and passes them as arguments.
 *
 * The tuple `A` is inferred from the injectable's parameter list, so tokens
 * are checked positionally — passing them in the wrong order, with the wrong
 * types, or with the wrong count is a compile error.
 *
 * @example
 * // Factory function
 * function createShip(world: IWorld, keyboard: Keyboard): Ship { ... }
 * injected(createShip, WorldToken, KeyboardToken) // ✓
 * injected(createShip, KeyboardToken, WorldToken) // ✗ compile error
 *
 * // Class constructor
 * class PixiFadeSystem { constructor(manager: IProcessManager) { ... } }
 * injected(PixiFadeSystem, ProcessManagerToken) // ✓
 */
export function injected<A extends readonly unknown[]>(
	injectable: ((...args: A) => unknown) | (new (...args: A) => unknown),
	...tokens: TokensFor<A>
): void {
	registry.set(injectable as Function, tokens as readonly TokenValue[])
}

export function getInjectedTokens(factory: Function): readonly TokenValue[] | undefined {
	return registry.get(factory)
}
