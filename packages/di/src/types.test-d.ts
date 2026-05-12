// Type-level tests for withDeps() / injected() positional enforcement.
//
// This file is not executed — it exists solely to exercise the type checker.
// Every `@ts-expect-error` below must fail to compile; if any of them start
// compiling clean, `tsc --noEmit` will report an "unused '@ts-expect-error'
// directive" and the suite fails.
//
// Convention: one section per kind of error we want to catch.

import { createContainer, injected } from './container'
import { createToken } from '@2817/token'

// ─── Fixtures ────────────────────────────────────────────────────────────────

interface IWorld { readonly __world: unique symbol }
interface Keyboard { readonly __keyboard: unique symbol }
interface Canvas { readonly __canvas: unique symbol }
interface Sys { readonly __sys: unique symbol }

const WorldToken = createToken<IWorld>('world')
const KeyboardToken = createToken<Keyboard>('keyboard')
const CanvasToken = createToken<Canvas>('canvas')
const SysToken = createToken<Sys>('sys')

function createSys(world: IWorld, keyboard: Keyboard): Sys {
	void world
	void keyboard
	return {} as Sys
}

function createZeroArg(): Sys {
	return {} as Sys
}

class SysClass {
	readonly __sys!: Sys['__sys']
	constructor(world: IWorld, keyboard: Keyboard) {
		void world
		void keyboard
	}
}

const container = createContainer()

// ─── 1. Correct order / types / count compiles ──────────────────────────────

container.bind(SysToken).toFactory(createSys).withDeps(WorldToken, KeyboardToken).asSingleton()
container.bind(SysToken).toClass(SysClass).withDeps(WorldToken, KeyboardToken).asSingleton()
injected(createSys, WorldToken, KeyboardToken)
injected(SysClass, WorldToken, KeyboardToken)

// Zero-arg factory: withDeps() not required, scope directly allowed
container.bind(SysToken).toFactory(createZeroArg).asSingleton()

// ─── 2. Wrong order is a compile error ──────────────────────────────────────

container
	.bind(SysToken)
	.toFactory(createSys)
	// @ts-expect-error — KeyboardToken cannot satisfy position 0 (IWorld)
	.withDeps(KeyboardToken, WorldToken)
	.asSingleton()

// @ts-expect-error — injected() with swapped tokens
injected(createSys, KeyboardToken, WorldToken)

// ─── 3. Wrong type is a compile error ──────────────────────────────────────

container
	.bind(SysToken)
	.toFactory(createSys)
	// @ts-expect-error — CanvasToken has no relation to IWorld
	.withDeps(CanvasToken, KeyboardToken)
	.asSingleton()

// ─── 4. Wrong count (too few) is a compile error ───────────────────────────

container
	.bind(SysToken)
	.toFactory(createSys)
	// @ts-expect-error — missing keyboard token
	.withDeps(WorldToken)
	.asSingleton()

// ─── 5. Wrong count (too many) is a compile error ──────────────────────────

container
	.bind(SysToken)
	.toFactory(createSys)
	// @ts-expect-error — extra token
	.withDeps(WorldToken, KeyboardToken, CanvasToken)
	.asSingleton()

// ─── 6. toClass positional enforcement ─────────────────────────────────────

container
	.bind(SysToken)
	.toClass(SysClass)
	// @ts-expect-error — swapped constructor args
	.withDeps(KeyboardToken, WorldToken)
	.asSingleton()
