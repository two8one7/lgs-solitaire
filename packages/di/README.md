# @2817/di

Lightweight, type-safe dependency injection container. No decorators, no reflection.

## Usage

```ts
import { createContainer } from '@2817/di'
import { createToken } from '@2817/token'

// 1. Define tokens
const WorldToken = createToken<IWorld>('world')
const CanvasToken = createToken<HTMLCanvasElement>('canvas')
const CameraSystemToken = createToken<SystemFunc>('camera-system')

// 2. Create container and bind everything in one place
const container = createContainer()
container.bind(WorldToken).toValue(world)
container.bind(CanvasToken).toValue(canvas)

// 3. Bind factory with inline dep declaration
container
    .bind(CameraSystemToken)
    .toFactory(createCameraSystem)
    .withDeps(WorldToken, CanvasToken)
    .asSingleton()

// 4. Resolve
const cameraSystem = container.get(CameraSystemToken)
```

## API

### Container

```ts
const container = createContainer()

// Bind a concrete value (always singleton)
container.bind(Token).toValue(value)

// Bind a factory — declare deps inline with withDeps(), then set scope
container.bind(Token).toFactory(factory).withDeps(DepAToken, DepBToken).asSingleton()
container.bind(Token).toFactory(factory).withDeps(DepAToken).asTransient()

// Zero-arg factory — skip withDeps(), set scope directly
container.bind(Token).toFactory(factory).asSingleton()

// Bind a class (same pattern)
container.bind(Token).toClass(MyClass).withDeps(DepAToken).asSingleton()

// Resolve
container.get(Token)           // throws if unbound
container.get(Token.optional)  // returns undefined if unbound

// Hierarchy
const child = container.createChild()  // inherits parent bindings
container.destroy()                     // clears all bindings, calls destroy() on singletons
```

### `.withDeps(...tokens)`

Declares which tokens a factory or class needs, resolved in order. Returns a `ScopeBuilder` to set the lifetime.

```ts
container
    .bind(CameraSystemToken)
    .toFactory(createCameraSystem)     // (world: IWorld, canvas: HTMLCanvasElement) => SystemFunc
    .withDeps(WorldToken, CanvasToken) // resolved and passed in order
    .asSingleton()
```

**Positional type safety.** `withDeps` captures the factory or constructor parameter tuple and checks each token positionally. Wrong order, wrong type, or wrong count is a compile error:

```ts
// factory: (world: IWorld, canvas: HTMLCanvasElement) => SystemFunc

.withDeps(CanvasToken, WorldToken)     // ✗ position 0 expects TokenValue<IWorld>
.withDeps(WorldToken)                  // ✗ missing canvas token
.withDeps(WorldToken, KeyboardToken)   // ✗ KeyboardToken can't satisfy HTMLCanvasElement
.withDeps(WorldToken, CanvasToken)     // ✓
```

Inline lambdas need explicit parameter types so inference can flow:

```ts
container.bind(EcsContextToken)
    .toFactory((world: IWorld): EcsContext => ({ world }))
    .withDeps(WorldToken)
    .asSingleton()
```

Named factory functions (with typed parameters) already work without annotations.

### `injected(factory, ...tokens)`

Alternative to `.withDeps()` — registers deps separately before binding. Useful when sharing a factory across multiple containers or registering deps at module load time. Enforces the same positional type safety as `.withDeps()`.

```ts
injected(createCameraSystem, WorldToken, CanvasToken)              // ✓
injected(createCameraSystem, CanvasToken, WorldToken)              // ✗ wrong order
container.bind(CameraSystemToken).toFactory(createCameraSystem).asSingleton()
```

Both approaches produce the same result. Prefer `.withDeps()` in new code — it keeps deps and binding in one place.

## Scopes

- **Singleton** — cached after first resolution (`.asSingleton()`)
- **Transient** (default) — new instance on every `get()` (`.asTransient()`)
- **Container** — cached per container; child containers get their own (`.asContainerScoped()`)

## Factory vs Class Binding

Use `toFactory()` for factory functions:

```ts
function createCameraSystem(world: IWorld, canvas: HTMLCanvasElement): SystemFunc {
    return (dt) => { /* ... */ }
}
container
    .bind(CameraSystemToken)
    .toFactory(createCameraSystem)
    .withDeps(WorldToken, CanvasToken)
    .asSingleton()
```

Use `toClass()` for class constructors:

```ts
class PixiFadeProcessSystem extends ProcessSystem<PixiFadeProcess> {
    constructor(manager: IProcessManager) { super(manager) }
}
container
    .bind(PixiFadeSystemToken)
    .toClass(PixiFadeProcessSystem)
    .withDeps(ProcessManagerToken)
    .asSingleton()
```

Both call `.withDeps()` to declare constructor/factory parameters. The difference is `toFactory()` calls `factory(...args)` while `toClass()` calls `new Class(...args)`.

## Child Containers

```ts
const parent = createContainer()
parent.bind(ConfigToken).toValue(config)

const child = parent.createChild()
child.bind(LoggerToken).toValue(logger)

child.get(ConfigToken)  // resolves from parent
child.get(LoggerToken)  // resolves from child
```

## Error Handling

- **Unbound token** — throws `MissingBindingError` with token description
- **Circular dependency** — detected at resolution time, throws `CircularDependencyError` with cycle path
- **Missing deps registration** — throws when factory has parameters but no `.withDeps()` or `injected()` was called
- **Duplicate binding** — throws `DuplicateBindingError` if the same token is bound twice

## Migration from `inSingletonScope()` / `inTransientScope()` / `inContainerScope()`

The old scope method names still work (backwards-compatible aliases). Prefer the new names in new code:

| Old | New |
|-----|-----|
| `.inSingletonScope()` | `.asSingleton()` |
| `.inTransientScope()` | `.asTransient()` |
| `.inContainerScope()` | `.asContainerScoped()` |

## Design Principles

- **No decorators** — `injected()` and `.withDeps()` are plain function calls
- **No reflection** — token→deps mapping via WeakMap
- **Fail-fast** — throws immediately on missing bindings, missing dep registrations, or cycles
- **Composition root pattern** — all bindings happen at startup, not scattered through modules
