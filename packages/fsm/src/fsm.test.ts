import { describe, it, expect, vi } from 'vitest'
import { createMachine, createState } from './fsm'
import type { IState, IMachine } from './types'

type S = 'idle' | 'walking' | 'running' | 'jumping' | 'falling'
type T = 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'stop' | 'any-to-idle'

function setup() {
	const machine = createMachine<S, T>('test')

	const idleState: IState<S> = {
		name: 'idle',
		onEnter: vi.fn(),
		onUpdate: vi.fn(),
		onExit: vi.fn(),
		destroy: vi.fn(),
	}
	const walkingState: IState<S> = {
		name: 'walking',
		onEnter: vi.fn(),
		onUpdate: vi.fn(),
		onExit: vi.fn(),
		destroy: vi.fn(),
	}
	const runningState: IState<S> = {
		name: 'running',
		onEnter: vi.fn(),
		onUpdate: vi.fn(),
		onExit: vi.fn(),
		destroy: vi.fn(),
	}

	machine
		.addState(idleState)
		.addState(walkingState)
		.addState(runningState)
		.addTransition('walk', 'idle', 'walking')
		.addTransition('run', 'walking', 'running')
		.addTransition('stop', 'walking', 'idle')
		.addTransition('stop', 'running', 'idle')

	return { machine, idleState, walkingState, runningState }
}

describe('createMachine', () => {
	it('returns a machine with expected API', () => {
		const machine = createMachine<S, T>('test')
		expect(machine).toHaveProperty('addState')
		expect(machine).toHaveProperty('addTransition')
		expect(machine).toHaveProperty('go')
		expect(machine).toHaveProperty('update')
		expect(machine).toHaveProperty('isCurrentState')
		expect(machine).toHaveProperty('start')
		expect(machine).toHaveProperty('onTransition')
		expect(machine).toHaveProperty('reset')
		expect(machine).toHaveProperty('destroy')
		expect(machine.currentState).toBeUndefined()
	})

	it('addState/addTransition/start/go basic flow', () => {
		const { machine, idleState, walkingState } = setup()

		machine.start('idle')
		expect(machine.currentState).toBe('idle')
		expect(idleState.onEnter).toHaveBeenCalledOnce()

		machine.go('walk')
		expect(machine.currentState).toBe('walking')
		expect(idleState.onExit).toHaveBeenCalledOnce()
		expect(walkingState.onEnter).toHaveBeenCalledOnce()
	})

	it('update() calls current state onUpdate with dt', () => {
		const { machine, idleState } = setup()
		machine.start('idle')
		machine.update(16)
		expect(idleState.onUpdate).toHaveBeenCalledWith(16)
	})

	it('update() does nothing when no current state', () => {
		const machine = createMachine<S, T>('test')
		// should not throw
		machine.update(16)
	})

	it('onEnter fires when entering a state', () => {
		const { machine, idleState } = setup()
		machine.start('idle')
		expect(idleState.onEnter).toHaveBeenCalledOnce()
	})

	it('onExit fires when leaving a state', () => {
		const { machine, idleState } = setup()
		machine.start('idle')
		machine.go('walk')
		expect(idleState.onExit).toHaveBeenCalledOnce()
	})

	it('isCurrentState returns correct boolean', () => {
		const { machine } = setup()
		machine.start('idle')
		expect(machine.isCurrentState('idle')).toBe(true)
		expect(machine.isCurrentState('walking')).toBe(false)

		machine.go('walk')
		expect(machine.isCurrentState('idle')).toBe(false)
		expect(machine.isCurrentState('walking')).toBe(true)
	})
})

describe('transitions', () => {
	it('wildcard (*) transitions match any source state', () => {
		const { machine } = setup()
		machine.addTransition('any-to-idle', '*' as S, 'idle')
		machine.start('walking')
		machine.go('any-to-idle')
		expect(machine.currentState).toBe('idle')
	})

	it('exact match takes priority over wildcard', () => {
		const machine = createMachine<S, T>('test')
		const idleState: IState<S> = { name: 'idle' }
		const walkingState: IState<S> = { name: 'walking' }
		const runningState: IState<S> = { name: 'running' }

		machine
			.addState(idleState)
			.addState(walkingState)
			.addState(runningState)
			// wildcard goes to running, but exact from walking goes to idle
			.addTransition('stop', '*' as S, 'running')
			.addTransition('stop', 'walking', 'idle')

		machine.start('walking')
		machine.go('stop')
		// exact match (walking → idle) should win over wildcard (* → running)
		expect(machine.currentState).toBe('idle')
	})

	it('invalid transition throws', () => {
		const { machine } = setup()
		machine.start('idle')
		// 'run' requires from=walking, but we're in idle
		expect(() => machine.go('run')).toThrow('invalid transition')
	})

	it('unknown transition name throws', () => {
		const { machine } = setup()
		machine.start('idle')
		expect(() => machine.go('jump')).toThrow('unknown transition')
	})
})

describe('queue', () => {
	it('transitions queued during a transition are processed on next update', () => {
		const machine = createMachine<S, T>('test')
		const idleState: IState<S> = {
			name: 'idle',
			onEnter: () => {
				// queue a transition during onEnter (which fires during start())
				machine.go('walk')
			},
		}
		const walkingState: IState<S> = { name: 'walking' }

		machine
			.addState(idleState)
			.addState(walkingState)
			.addTransition('walk', 'idle', 'walking')

		machine.start('idle')
		// go('walk') was queued during start's onEnter; processed by _processNextInQueue at end of start()
		expect(machine.currentState).toBe('walking')
	})

	it('go(name, true) always queues', () => {
		const { machine } = setup()
		machine.start('idle')

		// force queue even though we're not transitioning
		machine.go('walk', true)
		// not yet processed
		expect(machine.currentState).toBe('idle')

		// update triggers _processNextInQueue
		machine.update(16)
		expect(machine.currentState).toBe('walking')
	})
})

describe('function states (createState + fromFunction)', () => {
	it('closure-based state receives props, hooks, and fsm reference', () => {
		const machine = createMachine<'a' | 'b', 'go'>('test')

		const stateFn = vi.fn(
			(
				props: { speed: number },
				hooks: { onUpdate: (cb: (dt: number) => void) => () => void; onDestroy: (cb: () => void) => void },
				fsm: IMachine
			) => {
				expect(props).toEqual({ speed: 5 })
				expect(hooks).toHaveProperty('onUpdate')
				expect(hooks).toHaveProperty('onDestroy')
				expect(fsm).toBe(machine)
				return undefined
			}
		)

		const stateA = createState<'a' | 'b', 'go', { speed: number }>(
			'a',
			stateFn
		)
		machine.addState(stateA, { with: { speed: 5 } })
		machine.addState({ name: 'b' })
		machine.addTransition('go', 'a', 'b')
		machine.start('a')

		expect(stateFn).toHaveBeenCalledOnce()
	})

	it('onUpdate hook registers update callbacks', () => {
		const machine = createMachine<'a' | 'b', 'go'>('test')
		const updateSpy = vi.fn()

		const stateA = createState<'a' | 'b', 'go', null>('a', (_props, hooks) => {
			hooks.onUpdate(updateSpy)
			return undefined
		})

		machine.addState(stateA, { with: null })
		machine.start('a')
		machine.update(16)
		expect(updateSpy).toHaveBeenCalledWith(16)
	})

	it('return value from state function is called on exit', () => {
		const machine = createMachine<'a' | 'b', 'go'>('test')
		const exitSpy = vi.fn()

		const stateA = createState<'a' | 'b', 'go', null>('a', () => {
			return exitSpy
		})

		machine
			.addState(stateA, { with: null })
			.addState({ name: 'b' })
			.addTransition('go', 'a', 'b')

		machine.start('a')
		expect(exitSpy).not.toHaveBeenCalled()

		machine.go('go')
		expect(exitSpy).toHaveBeenCalledOnce()
	})

	it('onDestroy hook called on destroy()', () => {
		const machine = createMachine<'a' | 'b', 'go'>('test')
		const destroySpy = vi.fn()

		const stateA = createState<'a' | 'b', 'go', null>('a', (_props, hooks) => {
			hooks.onDestroy(destroySpy)
			return undefined
		})

		machine.addState(stateA, { with: null })
		machine.start('a')
		expect(destroySpy).not.toHaveBeenCalled()

		machine.destroy()
		expect(destroySpy).toHaveBeenCalledOnce()
	})
})

describe('lifecycle', () => {
	it('start() on an already-running machine exits current state first', () => {
		const { machine, idleState, walkingState } = setup()
		machine.start('idle')
		machine.start('walking')
		expect(idleState.onExit).toHaveBeenCalledOnce()
		expect(walkingState.onEnter).toHaveBeenCalledOnce()
		expect(machine.currentState).toBe('walking')
	})

	it('reset() clears all states and transitions', () => {
		const { machine } = setup()
		machine.start('idle')
		machine.reset()

		expect(machine.currentState).toBeUndefined()
		// after reset, transitions are gone so this should throw
		expect(() => machine.go('walk')).toThrow()
	})

	it('destroy() exits current state and calls destroy on all states', () => {
		const { machine, idleState, walkingState, runningState } = setup()
		machine.start('idle')
		machine.destroy()

		expect(idleState.onExit).toHaveBeenCalledOnce()
		expect(idleState.destroy).toHaveBeenCalledOnce()
		expect(walkingState.destroy).toHaveBeenCalledOnce()
		expect(runningState.destroy).toHaveBeenCalledOnce()
		expect(machine.currentState).toBeUndefined()
	})

	it('onTransition callback fires with (nextState, prevState, transitionName)', () => {
		const { machine } = setup()
		const spy = vi.fn()
		machine.onTransition(spy)

		machine.start('idle')
		machine.go('walk')

		expect(spy).toHaveBeenCalledWith('walking', 'idle', 'walk')
	})

	it('onTransition returns an unsubscribe function', () => {
		const { machine } = setup()
		const spy = vi.fn()
		const unsub = machine.onTransition(spy)

		machine.start('idle')
		machine.go('walk')
		expect(spy).toHaveBeenCalledOnce()

		unsub()
		machine.go('run')
		// should not have been called again
		expect(spy).toHaveBeenCalledOnce()
	})
})

describe('duplicate transition name guard', () => {
	it('lastTransition check prevents re-running the same transition immediately', () => {
		const machine = createMachine<'a' | 'b' | 'c', 'go' | 'next'>('test')
		const bEnter = vi.fn()
		machine
			.addState({ name: 'a' })
			.addState({ name: 'b', onEnter: bEnter })
			.addState({ name: 'c' })
			.addTransition('go', 'a', 'b')
			.addTransition('go', 'b', 'c')

		machine.start('a')
		machine.go('go') // a → b
		expect(machine.currentState).toBe('b')

		// same transition name immediately — should be ignored
		machine.go('go')
		expect(machine.currentState).toBe('b')
		expect(bEnter).toHaveBeenCalledOnce()
	})
})

describe('addState replaces existing state', () => {
	it('destroys old state when adding a state with the same name', () => {
		const machine = createMachine<'a', never>('test')
		const destroySpy = vi.fn()
		const stateV1: IState<'a'> = { name: 'a', destroy: destroySpy }
		const stateV2: IState<'a'> = { name: 'a' }

		machine.addState(stateV1)
		machine.addState(stateV2)

		expect(destroySpy).toHaveBeenCalledOnce()
	})
})

describe('chaining', () => {
	it('addState and addTransition return the machine for chaining', () => {
		const machine = createMachine<'a' | 'b', 'go'>('test')
		const result = machine
			.addState({ name: 'a' })
			.addState({ name: 'b' })
			.addTransition('go', 'a', 'b')

		expect(result).toBe(machine)
	})
})
