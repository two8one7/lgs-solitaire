# @2817/process — Usage Guide

## Architecture

**Process = data. ProcessSystem = logic.**

A `Process` is a plain data object that describes *what* should happen. A `ProcessSystem` owns the *how* — it reads process fields each frame and drives the work. This separation enables:

- **Tight loops over homogeneous data** — systems iterate their own array of process instances with zero virtual dispatch
- **Shared precomputed values** — a system can compute expensive values once per frame and reuse across all its processes (e.g. a shared spin angle for all animating coins)
- **Swap-and-pop removal** — `removeAt()` is O(1) because process ordering within a system doesn't matter

### Domain-specific over generic

Prefer creating domain-specific process types when the system can optimize. A `CoinAnimProcessSystem` that precomputes shared state and iterates `CoinAnim[]` directly is faster and clearer than a generic "tween" system that dispatches callbacks.

Use the built-in generic processes (`WaitForSeconds`, `ExecuteAction`) for one-off actions and simple delays.

## Lifecycle

```
Idle → Running → Succeeded
                → Failed
                → Aborted
```

- **Idle**: just created, not yet started. Systems transition to Running on first update.
- **Running**: actively processing. Systems accumulate time, apply effects, etc.
- **Succeeded**: completed normally. System calls `handleNextProcesses()` to advance chain, then removes.
- **Failed**: error or condition not met. Chain does NOT advance. System removes.
- **Aborted**: externally cancelled (e.g. via `subscriptions.push()`). System removes.

### Chaining

Every process has a `.next` pointer. When a process succeeds, `handleNextProcesses()` adds `.next` to the manager. This creates lightweight sequential chains without wrapper objects.

## API

### ProcessManager

```ts
const manager = createProcessManager()
```

#### `manager.add(...processes)`

Fire one or more processes. Each is routed to its matching system by `process.type`.

```ts
manager.add(new WaitForSeconds(1.0))
```

#### `manager.chain(...processes)`

Link processes sequentially via `.next` pointers, then add the first one. Use for simple sequences.

```ts
manager.chain(
    new WaitForSeconds(0.5),
    new ExecuteAction(() => console.log('done')),
)
```

#### `manager.addSystem(system)`

Register a ProcessSystem. Only register systems for process types you actually use.

```ts
manager.addSystem(new WaitForSecondsSystem(manager))
manager.addSystem(new ExecuteActionSystem(manager))
```

#### `manager.update(dt)`

Tick all registered systems. Call once per frame in your game loop.

#### `manager.destroy()`

Clear all systems and pending queues.

### Built-in Processes

#### WaitForSeconds

Wait a duration, then succeed.

```ts
new WaitForSeconds(1.5)
```

#### ExecuteAction

Run a callback immediately, then succeed.

```ts
new ExecuteAction(() => entity.destroy())
```

#### ExecuteActionInterval

Run a callback repeatedly at a fixed interval.

```ts
new ExecuteActionInterval(() => spawnParticle(), 0.1)
    .withMaxExecutions(5) // stop after 5 executions
```

#### WhenAll

Run children in parallel. Succeeds when ALL children succeed. If any child fails or aborts, remaining children are aborted and the WhenAll fails.

```ts
new WhenAll(
    new WaitForSeconds(1.0),
    new WaitForSeconds(2.0),
) // succeeds after 2 seconds
```

#### WhenChain

Wrap a sequence as a single composite process. Use when a chain needs to be a *child* of another composite (e.g. one branch of a `WhenAll`). For standalone sequences, prefer `manager.chain()`.

```ts
new WhenAll(
    new WhenChain(
        new WaitForSeconds(0.5),
        new ExecuteAction(() => console.log('branch A done')),
    ),
    new WaitForSeconds(1.0),
)
```

## Creating New Process Types

### 1. Define a shared TYPE constant

```ts
const TYPE = 'MyEffect'
```

Both the Process and ProcessSystem reference this constant. This prevents silent routing mismatches — a typo becomes a compile error.

### 2. Process class (data)

Extend `Process`. Define all fields the system needs to read. Keep it pure data — no callbacks, no side effects.

```ts
class MyEffect extends Process {
    readonly type = TYPE
    accumulatedTime = 0

    constructor(
        public readonly duration: number,
        public readonly intensity: number,
    ) {
        super()
    }
}
```

### 3. ProcessSystem class (logic)

Extend `ProcessSystem<T>`. Implement `update(dt)` with a reverse loop and state machine.

```ts
class MyEffectSystem extends ProcessSystem<MyEffect> {
    readonly type = TYPE

    constructor(manager: IProcessManager) {
        super(manager)
    }

    update(dt: number): void {
        for (let i = this.processes.length - 1; i >= 0; --i) {
            const p = this.processes[i]
            switch (p.state) {
                case ProcessState.Idle:
                    p.state = ProcessState.Running
                    break
                case ProcessState.Running:
                    p.accumulatedTime += dt
                    // ... apply effect using p.intensity ...
                    if (p.accumulatedTime >= p.duration) {
                        p.state = ProcessState.Succeeded
                    }
                    break
                case ProcessState.Succeeded:
                    this.handleNextProcesses(p)
                    this.removeAt(i)
                    break
                case ProcessState.Failed:
                case ProcessState.Aborted:
                    this.removeAt(i)
                    break
            }
        }
    }
}
```

The reverse loop + `removeAt()` (swap-and-pop) is the standard pattern. Never iterate forward when removing — it skips elements.

### 4. Register with manager

```ts
manager.addSystem(new MyEffectSystem(manager))
```

## Examples

### Simple chain: delay then action

```ts
manager.chain(
    new WaitForSeconds(2.0),
    new ExecuteAction(() => showMessage('Time is up!')),
)
```

### Parallel fork: multiple effects at once

```ts
manager.add(new WhenAll(
    new WaitForSeconds(1.0), // fade out audio
    new WaitForSeconds(0.5), // fade out visual
))
```

### Mixed composition: parallel branches with sequences

```ts
manager.add(new WhenAll(
    // Branch A: wait then cleanup
    new WhenChain(
        new WaitForSeconds(1.0),
        new ExecuteAction(() => removeEntity(entityA)),
    ),
    // Branch B: immediate cleanup
    new ExecuteAction(() => removeEntity(entityB)),
))
```

### Domain-specific process in a chain

```ts
manager.chain(
    new CoinAnim({ /* phase 1: pop */ }),
    new CoinAnim({ /* phase 2: float + shrink */ }),
    new ExecuteAction(() => {
        renderer.removeCoin(entityIndex)
        removeEntity(entity)
    }),
)
```
