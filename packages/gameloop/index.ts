// 250ms — prevents accumulator blowout from tab-switch or debugger pauses
// Source: mainloop.js (Isaac Sukin), Glenn Fiedler "Fix Your Timestep" (gafferongames.com)
const MAX_DT = 0.25

// Eliminates per-frame branch checks from optional chaining
// Source: mainloop.js pattern (assigns NOOPs for unset callbacks)
const NOOP = () => {}

type LoopFunc = (dt: number) => void

// Interpolation alpha enables smooth visual interpolation between fixed timesteps
// on variable-refresh displays (120Hz+)
// Source: Glenn Fiedler "Fix Your Timestep"; mainloop.js draw(interpolation) pattern
export type RenderFunc = (alpha: number) => void

// Mutable singleton — avoids per-frame object allocation; callers should not hold refs across frames
// Source: Construct Engine blog on zero-allocation hot paths
export type FrameInfo = { fps: number; dt: number; panic: boolean }

export type GameLoop = ReturnType<typeof createRaf>
export enum LoopState {
	Running,
	Paused,
	Stopped,
	Step,
}

type RAFOptions = {
	onBegin?: () => void
	onEnd?: (info: FrameInfo) => void
	renderFPS?: number
	getAlpha?: () => number
	autoVisibility?: boolean
	onVisibilityChange?: (hidden: boolean) => void
}

export function createRaf(
	funcs: LoopFunc[],
	renderFunc?: RenderFunc,
	options?: RAFOptions
) {
	const onBegin = options?.onBegin ?? NOOP
	const onEnd = options?.onEnd
	const getAlpha = options?.getAlpha ?? (() => 1)

	// Render function list — supports multiple render passes (Three.js, Pixi, debug)
	// called in order with the interpolation alpha
	const renderFuncs: RenderFunc[] = renderFunc ? [renderFunc] : []
	let renderLen = renderFuncs.length

	let rafId = 0
	let timeScale = 1
	let state = LoopState.Stopped

	// rAF callback timestamp is aligned with the browser's rendering pipeline,
	// more accurate than calling performance.now() or using Three.js Clock
	// Source: MDN requestAnimationFrame docs; W3C HTML spec (github.com/w3c/html/issues/785)
	let prevTime = 0

	let len = funcs.length

	// Debug update list — runs every frame regardless of pause state so
	// editor/inspection code (freecam, debug HUDs, profilers) stays live
	// while the main game loop is frozen. Not intended for game logic.
	const debugFuncs: LoopFunc[] = []
	let debugLen = 0

	const renderStep = options?.renderFPS ? 1 / options.renderFPS : 0
	let renderAccumulator = 0

	// FPS tracking via 1-second sampling window (no per-frame allocations)
	let frameCount = 0
	let fpsAccumulator = 0
	let currentFps = 0

	// Reusable FrameInfo object — mutated each frame, never reallocated
	const frameInfo: FrameInfo = { fps: 0, dt: 0, panic: false }

	// Visibility auto-pause: pause when tab is hidden, unpause when visible
	let wasRunningBeforeHidden = false
	const onVisibilityChange = options?.onVisibilityChange

	function handleVisibilityChange() {
		if (document.hidden) {
			wasRunningBeforeHidden = state === LoopState.Running
			if (wasRunningBeforeHidden) {
				state = LoopState.Paused
			}
			currentFps = 0
		} else {
			if (wasRunningBeforeHidden) {
				state = LoopState.Running
				prevTime = 0
				renderAccumulator = 0
			}
		}
		onVisibilityChange?.(document.hidden)
	}

	if (options?.autoVisibility) {
		document.addEventListener('visibilitychange', handleVisibilityChange)
	}

	function animate(time: number) {
		// Schedule next frame first — ensures we don't miss vsync when work approaches budget
		// Source: mainloop.js pattern; Isaac Sukin "A Detailed Explanation of JavaScript Game Loops and Timing"
		rafId = requestAnimationFrame(animate)

		onBegin()

		const rawDt = prevTime ? (time - prevTime) / 1000 : 0
		prevTime = time
		const dt = Math.min(rawDt, MAX_DT) * timeScale

		// Update FPS counter
		++frameCount
		fpsAccumulator += rawDt
		if (fpsAccumulator >= 1) {
			currentFps = frameCount
			frameCount = 0
			fpsAccumulator -= 1
		}

		if (state === LoopState.Running || state === LoopState.Step) {
			for (let i = 0; i < len; ++i) {
				funcs[i](dt)
			}

			if (state === LoopState.Step) {
				state = LoopState.Paused
			}
		}

		// Debug updates run unconditionally so editor/inspection code
		// stays live while the main loop is paused. Ordered after normal
		// updates so debug callbacks observe post-update state.
		for (let i = 0; i < debugLen; ++i) {
			debugFuncs[i](dt)
		}

		const alpha = getAlpha()

		if (renderStep) {
			renderAccumulator += dt
			if (renderAccumulator >= renderStep) {
				// Carry remainder to prevent timing drift over many frames
				// Source: Glenn Fiedler "Fix Your Timestep" accumulator pattern (gafferongames.com)
				renderAccumulator -= renderStep
				for (let r = 0; r < renderLen; ++r) {
					renderFuncs[r](alpha)
				}
			}
		} else {
			for (let r = 0; r < renderLen; ++r) {
				renderFuncs[r](alpha)
			}
		}

		if (onEnd) {
			frameInfo.fps = currentFps
			frameInfo.dt = dt
			frameInfo.panic = false
			onEnd(frameInfo)
		}
	}

	return {
		start() {
			if (state !== LoopState.Stopped) {
				console.warn(
					'Cannot start loop that is not stopped. Did you mean to unpause?'
				)
				return
			}

			state = LoopState.Running
			// Reset so first frame produces dt=0, preventing teleport after time gaps
			// Source: mainloop.js resetFrameDelta() pattern
			prevTime = 0
			rafId = requestAnimationFrame(animate)
		},
		stop() {
			state = LoopState.Stopped
			cancelAnimationFrame(rafId)
		},
		pause() {
			state = LoopState.Paused
		},
		unpause() {
			state = LoopState.Running
			// Prevent dt spike from time elapsed while paused
			prevTime = 0
			renderAccumulator = 0
		},
		step() {
			state = LoopState.Step
		},
		isPaused() {
			return state === LoopState.Paused
		},
		setTimeScale(scale: number) {
			timeScale = scale
		},
		add(...list: LoopFunc[]) {
			const size = list.length
			for (let i = 0; i < size; ++i) {
				funcs.push(list[i])
				++len
			}
		},
		// Swap-and-pop: O(1) removal, avoids the garbage array splice() returns
		// Source: Construct Engine blog "How to Write Low Garbage Real-Time JavaScript"
		remove(func: LoopFunc) {
			const idx = funcs.indexOf(func)
			if (idx !== -1) {
				funcs[idx] = funcs[len - 1]
				funcs.pop()
				--len
			}
		},
		addRender(...list: RenderFunc[]) {
			const size = list.length
			for (let i = 0; i < size; ++i) {
				renderFuncs.push(list[i])
				++renderLen
			}
		},
		removeRender(func: RenderFunc) {
			const idx = renderFuncs.indexOf(func)
			if (idx !== -1) {
				renderFuncs[idx] = renderFuncs[renderLen - 1]
				renderFuncs.pop()
				--renderLen
			}
		},
		// Debug updates run unconditionally — use for editor/inspection
		// code that must survive loop.pause() (freecam, debug HUDs).
		addDebugUpdate(...list: LoopFunc[]) {
			const size = list.length
			for (let i = 0; i < size; ++i) {
				debugFuncs.push(list[i])
				++debugLen
			}
		},
		removeDebugUpdate(func: LoopFunc) {
			const idx = debugFuncs.indexOf(func)
			if (idx !== -1) {
				debugFuncs[idx] = debugFuncs[debugLen - 1]
				debugFuncs.pop()
				--debugLen
			}
		},
		// Reset timing state — call after level loads or other long pauses
		// to prevent accumulator spikes. Produces dt=0 on next frame.
		// Source: mainloop.js resetFrameDelta() pattern
		resetFrameDelta() {
			prevTime = 0
			renderAccumulator = 0
		},
		getFps() {
			return currentFps
		},
		destroy() {
			this.stop()
			funcs.length = 0
			len = 0
			debugFuncs.length = 0
			debugLen = 0
			renderFuncs.length = 0
			renderLen = 0
			if (options?.autoVisibility) {
				document.removeEventListener(
					'visibilitychange',
					handleVisibilityChange
				)
			}
		},
	}
}

export function createLoop(
	updateFunc: (dt: number) => void,
	fps = 60,
	panicCount = 3
) {
	const STEP = 1 / fps // in seconds

	let accumulator = 0
	let count = 0
	let panicked = false

	function update(dt: number) {
		if (dt <= MAX_DT) {
			count = 0
			panicked = false

			accumulator += dt

			while (accumulator >= STEP) {
				++count
				updateFunc(STEP)
				accumulator -= STEP

				if (count >= panicCount && accumulator >= STEP) {
					// prevent spiral of death
					accumulator = 0
					panicked = true
					console.warn('game loop panic')
				}
			}
		}
	}

	update.reset = () => {
		accumulator = 0
		count = 0
		panicked = false
	}
	update.getAccumulator = () => accumulator
	update.getStep = () => STEP
	update.didPanic = () => panicked

	return update
}

type GameLoopOptions = {
	onBegin?: () => void
	onEnd?: (info: FrameInfo) => void
	renderFPS?: number
	autoVisibility?: boolean
	onVisibilityChange?: (hidden: boolean) => void
}

export function createGameLoop(
	updateFunc: (dt: number) => void,
	renderFunc: RenderFunc,
	fps = 60,
	options?: GameLoopOptions
) {
	const update = createLoop(updateFunc, fps)

	const userOnEnd = options?.onEnd
	return createRaf([update], renderFunc, {
		...options,
		getAlpha: () => update.getAccumulator() / update.getStep(),
		// Inject panic status from the fixed-timestep loop into FrameInfo
		onEnd: userOnEnd
			? (info) => {
					info.panic = update.didPanic()
					userOnEnd(info)
				}
			: undefined,
	})
}
