import { Howl, Howler } from 'howler'
import type {
	AddOptions,
	FadeOutAllOptions,
	IMusicPlayer,
	PlayOptions,
	PopOptions,
	ResumeOptions,
} from './types'
import { createVisibilityHandler } from './contextVisibility'

const MAX_QUEUE_SIZE = 64

type MusicPlayerAction = {
	type: 'play' | 'push' | 'pop' | 'fadeOutAll' | 'resume' | 'pause'
	name?: string
	options?: PlayOptions | FadeOutAllOptions | PopOptions | ResumeOptions
}

type ActiveTrack = {
	name: string
	track: Howl
	id: number
	isPaused?: boolean
}

type PlaybackState = {
	name: string
	onEnd: (() => void) | undefined
	loop: boolean
}

export function createMusicPlayer(): IMusicPlayer {
	const visibilityHandler = createVisibilityHandler()

	const tracks: Record<string, Howl> = {}
	const trackOptions: Record<string, PlayOptions> = {}

	// Stack for push/pop ordering
	const trackStack: ActiveTrack[] = []
	// O(1) name lookup into the stack
	const activeByName = new Map<string, ActiveTrack>()
	// Per-play-ID state for shared handlers
	const playbackStates = new Map<number, PlaybackState>()

	const suspendedStateQueue: MusicPlayerAction[] = []

	let hasInitialized = false

	// --- Shared handlers (zero closures in hot paths) ---

	function handleMusicEnd(id: number) {
		const state = playbackStates.get(id)
		if (!state) return

		if (state.onEnd) {
			state.onEnd()
		}

		if (!state.loop) {
			// Non-looping track ended: clean up
			const track = tracks[state.name]
			if (track) {
				track.off('end', handleMusicEnd, id)
			}
			playbackStates.delete(id)
			removeFromStack(state.name)
		}
	}

	function handleFadeComplete(id: number) {
		// Called when a fade-out completes — stop the track
		const state = playbackStates.get(id)
		if (!state) return

		const track = tracks[state.name]
		if (track) {
			track.off('fade', handleFadeComplete, id)
			track.off('end', handleMusicEnd, id)
			track.stop(id)
		}
		playbackStates.delete(id)
	}

	function removeFromStack(name: string) {
		const idx = trackStack.findIndex((t) => t.name === name)
		if (idx >= 0) {
			trackStack.splice(idx, 1)
		}
		activeByName.delete(name)
		delete trackOptions[name]
	}

	// --- Context state handling ---

	function handleContextStateChange() {
		if (suspendedStateQueue.length === 0) {
			return
		}

		if (!Howler.ctx || Howler.ctx.state !== 'running') {
			return
		}

		const queued = suspendedStateQueue.splice(0)
		for (const action of queued) {
			switch (action.type) {
				case 'play':
					play(action.name as string, action.options as PlayOptions)
					break
				case 'push':
					push(action.name as string, action.options as PlayOptions)
					break
				case 'pop':
					pop(action.options as PopOptions)
					break
				case 'fadeOutAll':
					fadeOutAll(action.options as FadeOutAllOptions)
					break
				case 'pause':
					pause()
					break
				case 'resume':
					resume(action.options as ResumeOptions)
					break
			}
		}
	}

	function queueAction(action: MusicPlayerAction) {
		if (suspendedStateQueue.length >= MAX_QUEUE_SIZE) {
			console.warn(
				`music suspended queue full (${MAX_QUEUE_SIZE}), dropping oldest`
			)
			suspendedStateQueue.shift()
		}
		suspendedStateQueue.push(action)
	}

	function init() {
		if (hasInitialized) {
			return
		}

		if (Howler.ctx) {
			Howler.ctx.addEventListener('statechange', handleContextStateChange)
		}

		hasInitialized = true
	}

	// --- Core API ---

	function play(name: string, options: Readonly<PlayOptions> = {}) {
		if (!Howler.ctx || Howler.ctx.state !== 'running') {
			queueAction({ type: 'play', name, options })
			return
		}

		const track = tracks[name]
		if (!track) {
			console.error(`could not find sound with name: ${name}`)
			return
		}

		if (track.playing() && track.volume() > 0) {
			console.warn(
				`trying to play a track that is still playing: ${name}`
			)
			return
		}

		if (activeByName.has(name)) {
			console.warn(
				`trying to play a track that's already playing at 0 volume with name: ${name}`
			)
			console.info('will attempt to resume')
			resume()
			return
		}

		const {
			loop = true,
			onEnd,
			volume = 0.2,
			fade = true,
			fadeDuration = 1000,
		} = options

		const id = track.play()

		if (loop) {
			track.loop(loop, id)
		}
		track.volume(volume, id)

		if (fade || trackStack.length > 0) {
			track.fade(0, volume, fadeDuration, id)
		}

		// Fade out the currently playing track
		const activeTrack = trackStack.pop()
		if (activeTrack) {
			// Clean old end handler
			const oldState = playbackStates.get(activeTrack.id)
			if (oldState) {
				activeTrack.track.off('end', handleMusicEnd, activeTrack.id)
				playbackStates.delete(activeTrack.id)
			}
			activeByName.delete(activeTrack.name)

			// Register fade-complete handler to stop after fade-out
			playbackStates.set(activeTrack.id, {
				name: activeTrack.name,
				onEnd: undefined,
				loop: false,
			})
			activeTrack.track.on(
				'fade',
				handleFadeComplete,
				activeTrack.id
			)
			activeTrack.track.fade(
				activeTrack.track.volume(activeTrack.id) as number,
				0,
				fadeDuration,
				activeTrack.id
			)
		}

		// Register new track
		const entry: ActiveTrack = { name, track, id }
		trackStack.push(entry)
		activeByName.set(name, entry)
		trackOptions[name] = options

		// End handler via shared function
		playbackStates.set(id, { name, onEnd, loop })
		track.on('end', handleMusicEnd, id)
	}

	function pause() {
		if (!Howler.ctx || Howler.ctx.state !== 'running') {
			queueAction({ type: 'pause' })
			return
		}

		for (const t of trackStack) {
			t.track.volume(0)
			t.track.pause()
			t.isPaused = true
		}
	}

	function fadeOutAll(options: Readonly<FadeOutAllOptions> = {}) {
		if (!Howler.ctx || Howler.ctx.state !== 'running') {
			queueAction({ type: 'fadeOutAll', options })
			return
		}

		const { duration = 10000 } = options

		for (const { track, id } of trackStack) {
			track.fade(track.volume(), 0, duration, id)
		}
	}

	function resume(options: Readonly<ResumeOptions> = {}) {
		if (!Howler.ctx || Howler.ctx.state !== 'running') {
			queueAction({ type: 'resume', options })
			return
		}

		if (trackStack.length <= 0) {
			return
		}
		const { fade = true, fadeDuration = 1000 } = options

		const len = trackStack.length
		const t = trackStack[len - 1]
		const { track, name, id, isPaused } = t
		const { volume = 0.2 } = trackOptions[name]
		if (fade) {
			track.fade(track.volume(), volume, fadeDuration, id)
		} else {
			track.volume(volume, id)
		}

		if (isPaused) {
			track.play(id)
			t.isPaused = false
		}

		for (let i = 0; i < len - 1; ++i) {
			const at = trackStack[i]
			at.isPaused = false
		}
	}

	function push(name: string, options: Readonly<PlayOptions> = {}) {
		if (!Howler.ctx || Howler.ctx.state !== 'running') {
			queueAction({ type: 'push', name, options })
			return
		}

		const track = tracks[name]
		if (!track) {
			console.error(`could not find sound with name: ${name}`)
			return
		}

		if (track.playing() && track.volume() > 0) {
			console.warn(
				`trying to push a track that was still playing: ${name}`
			)
			return
		}

		const { loop = true, onEnd, volume = 0.2 } = options

		track.volume(volume)
		const id = track.play()

		if (loop) {
			track.loop(loop, id)
		}

		if (trackStack.length > 0) {
			track.fade(0, volume, 500, id)
		}

		for (const at of trackStack) {
			const { track: t, id: atId } = at
			t.fade(t.volume(), 0, 500, atId)
		}

		const entry: ActiveTrack = { name, track, id }
		trackStack.push(entry)
		activeByName.set(name, entry)
		trackOptions[name] = options

		// End handler via shared function
		playbackStates.set(id, { name, onEnd, loop })
		track.on('end', handleMusicEnd, id)
	}

	function stop(name?: string) {
		if (trackStack.length === 0) {
			return
		}

		name = name || trackStack[trackStack.length - 1].name
		if (!name) {
			return
		}

		const track = tracks[name]
		if (!track) {
			console.error(`could not find sound with name: ${name}`)
			return
		}

		const idx = trackStack.findIndex((t) => t.name === name)
		if (idx < 0) {
			console.error(`could not find active track with name: ${name}`)
			return
		}

		const { id } = trackStack[idx]

		// Clean up handlers
		track.off('end', handleMusicEnd, id)
		track.off('fade', handleFadeComplete, id)
		playbackStates.delete(id)

		track.stop(id)

		// Remove from stack and map
		trackStack.splice(idx, 1)
		activeByName.delete(name)
	}

	function pop(options: Readonly<PopOptions> = {}) {
		if (!Howler.ctx || Howler.ctx.state !== 'running') {
			queueAction({ type: 'pop', options })
			return
		}

		if (trackStack.length <= 1) {
			return
		}

		const { duration = 1000 } = options

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const popped = trackStack.pop()!
		activeByName.delete(popped.name)

		const { track, id } = popped
		const vol = track.volume()
		if (track && vol) {
			// Register fade-complete to stop after fade-out
			// Reuse existing playback state or create minimal one
			const existing = playbackStates.get(id)
			if (existing) {
				// Clear onEnd so it doesn't fire during fade-out stop
				existing.onEnd = undefined
			} else {
				playbackStates.set(id, {
					name: popped.name,
					onEnd: undefined,
					loop: false,
				})
			}
			track.off('end', handleMusicEnd, id)
			track.on('fade', handleFadeComplete, id)
			track.fade(vol, 0, duration, id)
		} else {
			// Already silent — just clean up
			track.off('end', handleMusicEnd, id)
			playbackStates.delete(id)
		}

		if (trackStack.length <= 0) {
			return
		}

		const {
			name: nextName,
			track: nextTrack,
			id: nextId,
		} = trackStack[trackStack.length - 1]
		const { volume = 0.2 } = trackOptions[nextName]
		nextTrack.fade(nextTrack.volume(), volume, duration, nextId)
	}

	function remove(name: string) {
		// Stop if currently active
		if (activeByName.has(name)) {
			stop(name)
		}

		// Clean suspended queue
		for (let i = suspendedStateQueue.length - 1; i >= 0; --i) {
			if (suspendedStateQueue[i].name === name) {
				suspendedStateQueue.splice(i, 1)
			}
		}

		const track = tracks[name]
		if (track) {
			track.unload()
			delete tracks[name]
		}
		delete trackOptions[name]
	}

	function destroy() {
		visibilityHandler.destroy()

		if (Howler.ctx) {
			Howler.ctx.removeEventListener('statechange', handleContextStateChange)
		}

		for (const key in tracks) {
			const track = tracks[key]
			if (!track) {
				continue
			}
			track.stop()
			track.unload()
		}

		trackStack.length = 0
		activeByName.clear()
		playbackStates.clear()
		suspendedStateQueue.length = 0

		for (const key of Object.keys(trackOptions)) {
			delete trackOptions[key]
		}
		for (const key of Object.keys(tracks)) {
			delete tracks[key]
		}
	}

	return {
		add(name: string, src: string, options: Readonly<AddOptions> = {}) {
			const {
				preload = true,
				autoplay = true,
				onLoaded,
				onUnlock,
			} = options
			const track = new Howl({
				src: [src],
				preload,
				html5: false,
				autoplay,
				volume: 0.5,
			})
			tracks[name] = track
			if (autoplay) {
				// One-time setup closure (runs once per add, not per play)
				const h = (id: number) => {
					track.off('play', h)
					const entry: ActiveTrack = { name, track, id }
					trackStack.push(entry)
					activeByName.set(name, entry)
					trackOptions[name] = { volume: 0.2 }
				}
				track.on('play', h)
			}

			if (onLoaded) {
				track.once('load', onLoaded)
			}

			if (onUnlock) {
				track.once('unlock', onUnlock)
			}

			if (!hasInitialized) {
				init()
			}

			return this
		},
		play,
		stop,
		remove,
		fadeOutAll,
		pause,
		resume,
		push,
		pop,
		getActiveTracksCount() {
			return trackStack.length
		},
		destroy,
	}
}
