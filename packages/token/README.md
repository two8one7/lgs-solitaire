# @2817/token

Type-safe dependency injection tokens with phantom type tracking.

## Usage

```ts
import { createToken } from '@2817/token'

// Create typed tokens
const WorldToken = createToken<IWorld>('world')
const KeyboardToken = createToken<Keyboard>('keyboard')

// Optional token (resolves to T | undefined)
const DebugToken = createToken<DebugTools>('debug')
DebugToken.optional  // Token<DebugTools | undefined>
```

## API

### `createToken<T>(description: string): Token<T>`

Creates a typed token with a human-readable description. The description is used in error messages.

### `token.optional`

Returns a derived token that resolves to `T | undefined` instead of throwing when unbound.

### `Token<T>`

```ts
interface Token<T> {
  readonly id: symbol
  readonly description: string
  readonly optional: Token<T | undefined>
  readonly __type: T  // phantom type for inference
}
```

## Design

- **Symbol-based identity** — each token is unique, no string collisions
- **Phantom types** — `__type` field enables TypeScript inference without runtime cost
- **Optional accessor** — single `.optional` property for nullable resolution
- **Shared across packages** — `@2817/di` and `@2817/systems` both use this token type
