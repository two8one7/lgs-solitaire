# @2817/ecs

A performant, TypeScript-first Entity Component System (ECS) library with advanced query caching, change tracking, and multi-world support.

## Features

- **Struct of Arrays (SoA) storage** - Cache-friendly data layout for efficient iteration
- **Direct array access** - No wrapper functions; read/write component data at native speed
- **Multi-world support** - Run multiple ECS worlds with shared component definitions
- **Advanced query system** - Cached queries with OR logic, change tracking, and dirty flags
- **Query pipes** - Chain filter and sort operations on query results
- **Full serialization** - Save and restore world state including entity references
- **TypeScript generics** - Full type inference from component definitions
- **Zero external runtime dependencies** - Core logic is self-contained

## Installation

```bash
npm install @2817/ecs
```

## Quick Start

```typescript
import { createWorld, createEntity, createComponent, createQuery, addComponent } from '@2817/ecs'

// 1. Create a world
const world = createWorld()

// 2. Define components
const Position = createComponent({
	x: { type: 'number', default: 0 },
	y: { type: 'number', default: 0 },
})

const Velocity = createComponent({
	x: { type: 'number', default: 0 },
	y: { type: 'number', default: 0 },
})

// 3. Create a query for entities with both Position and Velocity
const movingEntities = createQuery(world, {
	with: [Position, Velocity],
})

// 4. Create entities
const player = createEntity(world)
addComponent(player, Position, { x: 100, y: 200 })
addComponent(player, Velocity, { x: 5, y: 0 })

// 5. Iterate and update using direct array access + query.indices
const wi = world.index
const posX = Position.x[wi], posY = Position.y[wi]
const velX = Velocity.x[wi], velY = Velocity.y[wi]
const indices = movingEntities.indices

movingEntities() // call to clear dirty flags
const len = indices.length
for (let i = 0; i < len; i++) {
	const idx = indices[i]
	posX[idx] += velX[idx]!
	posY[idx] += velY[idx]!
}
```

## API Reference

### World

```typescript
// Create a new world
const world = createWorld(options?)

// Options:
// - store: any          - Custom store object accessible via world.store
// - events: (world) => any  - Factory for custom events center
// - onSave: (world) => void - Callback when saveWorld() is called
// - onLoad: (world) => Promise<boolean> - Callback when loadWorld() is called
// - onDelete: (world) => void - Callback when deleteWorld() is called

// World operations
clearWorld(world)        // Remove all entities
destroyWorld(world)      // Full cleanup including queries and events
reuseWorld(world)        // Clear and assign new ID

// Update cycle helpers
startUpdating(world)     // Mark world as updating (defers dirty notifications)
endUpdating(world)       // End update cycle

// Persistence
saveWorld(world)
loadWorld(world)
deleteWorld(world)

// Serialization
const data = serializeWorld(world)
deserializeWorld(world, data)
```

### Entity

```typescript
// Create an entity
const entity = createEntity(world, { id?: string })

// Remove an entity (also removes all its components)
removeEntity(entity)

// Lookup
getEntityById(world, id)      // O(1) by ID
getEntityByIndex(world, index) // O(1) by index

// Display binding (for linking to renderer objects)
addEntityDisplay(entity, displayObject)
getEntityDisplay<T>(entity)
removeEntityDisplay(entity)
```

### Component

```typescript
// Define a component with typed fields
const Position = createComponent({
	x: { type: 'number', default: 0 },
	y: { type: 'number', default: 0 },
})

// Supported field types: 'string', 'number', 'boolean', 'object', 'entity'

// Create a tag (component with no fields)
const IsPlayer = createTag()

// Add/remove components
addComponent(entity, Position, { x: 10, y: 20 })
removeComponent(entity, Position)

// Check if entity has component
hasComponent(entity, Position) // boolean

// Read/write values via direct array access
const x = Position.x[entity.worldIndex][entity.index]
Position.x[entity.worldIndex][entity.index] = 100

// For hot loops, hoist the world-level array and use query.indices:
const wi = world.index
const posX = Position.x[wi]
const indices = query.indices
query()
for (let i = 0; i < indices.length; i++) {
	posX[indices[i]] += 1
}
```

### Query

Queries automatically update when components are added or removed.

```typescript
// Basic query - entities with Position AND Velocity
const query = createQuery(world, {
	with: [Position, Velocity],
})

// Exclusion - entities with Position but NOT Static
const query = createQuery(world, {
	with: [Position],
	without: [Static],
})

// OR logic - entities with Sprite OR Mesh
import { OR } from '@2817/ecs'

const renderables = createQuery(world, {
	with: [OR(Sprite, Mesh), Position],
})

// Iterate
for (const entity of query()) {
	// ...
}

// High-performance iteration using query.indices
// Returns a parallel number[] of entity indices, avoiding object dereference in hot loops
const indices = query.indices
query() // call once to clear dirty flags
for (let i = 0; i < indices.length; i++) {
	const entityIndex = indices[i]
	// use entityIndex with component arrays directly
}

// Check size without iterating
query.size()

// Change detection
query.added() // Entities added since last clear
query.removed() // Entities removed since last clear

// Clear change arrays
query.added.clear()
query.removed.clear()

// Dirty tracking (per query instance)
queryIsDirty(query) // Has query results changed?
query.clearDirty() // Mark as clean

// Subscribe to dirty events
query.dirty.on(() => {
	console.log('Query results changed')
})

// Cleanup
removeQuery(query) // Remove this instance, keep base query
destroyQuery(world, query) // Fully destroy query
```

### Query Pipes

Chain operations on query results with automatic caching:

```typescript
import { queryPipe, createFilter, createSort } from '@2817/ecs'

const sortedEnemies = queryPipe(
  enemyQuery,
  [
    createFilter((entity) => Health.current[entity.worldIndex][entity.index] > 0),
    createSort((a, b) => {
      return Position.x[a.worldIndex][a.index] - Position.x[b.worldIndex][b.index]
    }),
  ]
)

// Use in game loop
for (const entity of sortedEnemies()) {
  // Entities are filtered and sorted
}

// Can also pipe from change events
const newlyAdded = queryPipe(query, [createFilter(...)], { event: 'added' })
```

### System

Systems are simple functions - no built-in scheduler:

```typescript
import { createSys } from '@2817/ecs'

const movementSystem = createSys(
	(dt: number) => {
		for (const entity of movingEntities()) {
			// Update positions...
		}
	},
	() => {
		// Optional cleanup function
	}
)

// Call in your game loop
movementSystem(deltaTime)

// Cleanup when done
movementSystem.destroy?.()
```

## Architecture

### Storage Layout

Components use a Struct of Arrays (SoA) pattern for cache efficiency:

```
component[field][worldIndex][entityIndex] = value
```

This allows:

- Multiple worlds to share component definitions
- Cache-friendly iteration over single fields
- Lazy allocation per world

For maximum performance, hoist the world-level array and use `query.indices`:

```typescript
const posX = Position.x[world.index]
const indices = query.indices
query()
for (let i = 0; i < indices.length; i++) {
	posX[indices[i]] += 1
}
```

`query.indices` is a parallel `number[]` maintained alongside the query's `IEntity[]`. Each query mutation (add, swap-and-pop removal, clear) keeps both arrays in sync. The indices array stores raw `entity.index` values, so iteration avoids the object dereference that `entities[i].index` requires. V8 stores `number[]` with SMI (Small Integer) representation — no boxing, no pointer chasing — making sequential reads as fast as a typed array for practical sizes.

This is opt-in. Code using `query()` and iterating `IEntity` objects still works. `query.indices` is for performance-sensitive loops where every nanosecond counts.

### Query Caching

Queries are cached by their specification. Multiple `createQuery()` calls with the same parameters share the underlying entity array but maintain separate dirty state.

### Entity References

Components can store references to other entities:

```typescript
const Parent = createComponent({
	entity: { type: 'entity', default: undefined },
})

addComponent(child, Parent, { entity: parentEntity })
```

Entity references are preserved through serialization/deserialization.

## Benchmarks

Measured against bitecs, koota, and miniplex (higher is better):

| Benchmark | @2817/ecs | bitecs | koota | miniplex |
|-----------|-----------|--------|-------|----------|
| Simple Iter (1k) | **100%** | 70% | 3% | 25% |
| Simple Iter (10k) | **100%** | 69% | 3% | 22% |
| Packed Iter (1k) | **100%** | 36% | 1% | 6% |
| Frag Iter (2.6k) | 89% | **100%** | 3% | 8% |
| Add/Remove (1k) | **100%** | 42% | 42% | 12% |
| Entity Cycle (1k) | 30% | 48% | 46% | **100%** |

## Performance Tips

1. **Use `query.indices` for hot loops** - Iterating `indices[i]` is a single array read; `entities[i].index` requires an object dereference per entity. This matters most when iterating thousands of entities (frag iter went from 41% to 89% of bitecs with this change alone)
2. **Hoist world-level arrays** - Pull `Position.x[world.index]` outside hot loops
3. **Use direct array access** - `Position.x[wi][idx]` is the only way to read/write; there are no wrapper functions
4. **Reuse queries** - Create queries once, not every frame
5. **Use `startUpdating`/`endUpdating`** - Batch dirty notifications during frame updates
6. **Check `queryIsDirty`** - Skip processing if nothing changed
7. **Use tags for flags** - `createTag()` is cheaper than components with fields
8. **Clear change arrays** - Call `added.clear()` etc. to prevent unbounded growth

## Query Update Lifecycle

For correct frame-deferred change tracking, wrap your game loop's update phase with `startUpdating`/`endUpdating` and clear change arrays at the end:

```typescript
import { startUpdating, endUpdating, clearQueryAdded, clearQueryRemoved } from '@2817/ecs'

function update(dt: number) {
	startUpdating(world)

	// All systems run here...
	// query.added() returns entities added in the PREVIOUS frame
	// query.removed() returns entities removed in the PREVIOUS frame

	clearQueryAdded(world)   // clears added list, promotes queued → main
	clearQueryRemoved(world) // clears removed list, promotes queued → main
	endUpdating(world)
}
```

**Double-buffering:** When `isUpdating = true`, new query matches go to a queue (not the main added/removed list). On `clearQueryAdded`/`clearQueryRemoved`, the queue is flushed into the main list. This ensures all systems in the same frame see the same `added()`/`removed()` set — a system early in the frame sees the same newly-added entities as a system late in the frame.

**Without the lifecycle calls:** `added()` and `removed()` still work but show changes immediately (no double-buffering). Changes made by system A are visible to system B in the same frame, which can cause order-dependent bugs.

**Pattern: one-shot response systems.** Use `query.added()` to process newly-tagged entities exactly once:

```typescript
// Detection system adds Collected tag
addComponent(coinEntity, Collected)

// Response system (runs later in same frame) processes newly-collected coins
const collectedQuery = createQuery(world, { with: [Collected, Coin] })

function coinResponseSystem(dt: number) {
	const newlyCollected = collectedQuery.added()
	for (const entity of newlyCollected) {
		// Side effects: play sound, increment counter, spawn animation
	}
	// No manual clear needed — game loop's clearQueryAdded handles it
}
```

## Common Pitfalls

### Removing Entities During Iteration

**Do not** remove entities while iterating over a query directly - this can cause entities to be skipped:

```typescript
// BAD - may skip entities
for (const entity of query()) {
	removeEntity(entity) // Modifies underlying array during iteration
}

// GOOD - copy to array first
const entities = [...query()]
for (const entity of entities) {
	removeEntity(entity) // Safe - iterating over a copy
}
```

The same applies to any operation that might change query membership (adding/removing components that affect the query criteria).

## Dependencies

Internal workspace packages:

- `@2817/hash` - murmurhash3 for query keys
