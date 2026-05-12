import { Howl, Howler } from 'howler'
import type { AddOptions, ISoundPlayer, PlayOptions } from './types'
import { createVisibilityHandler } from './contextVisibility'

const MAX_QUEUE_SIZE = 64

type PlaybackState = {
	name: string
	soundName: string
	onEnd: (() => void) | undefined
	randomPool: string[] | undefined
	options: Readonly<PlayOptions>
}

export function createSoundPlayer(): ISoundPlayer {
	const visibilityHandler = createVisibilityHandler()

	const sounds: Record<string, Howl> = {}
	const playbacks = new Map<number, PlaybackState>()

	const pendingQueue: { name: string; options: PlayOptions }[] = []
	let isListening = false

	let isMute = false

	function setMute(mute: boolean) {
		isMute = mute
	}

	function handleSoundEnd(id: number) {
		const state = playbacks.get(id)
		if (!state) return

		const sound = sounds[state.soundName]

		if (state.randomPool) {
			// randomPool loop: pick next random sound and play it
			playbacks.delete(id)
			if (sound) {
				sound.off('end', handleSoundEnd, id)
			}
			const r = Math.floor(Math.random() * state.randomPool.length)
			play(state.randomPool[r], state.options)
			return
		}

		// Looping sounds fire 'end' at each loop boundary — keep tracking alive
		if (state.options.loop && !state.randomPool) {
			// Re-register for next loop iteration
			if (sound) {
				sound.once('end', handleSoundEnd, id)
			}
			return
		}

		if (state.onEnd) {
			state.onEnd()
		}

		// Non-looping: clean up
		playbacks.delete(id)
		if (sound) {
			sound.off('end', handleSoundEnd, id)
		}
	}

	function flushPendingQueue() {
		if (Howler.ctx.state !== 'running') {
			return
		}

		Howler.ctx.removeEventListener('statechange', flushPendingQueue)
		isListening = false

		const queued = pendingQueue.splice(0)
		for (const { name, options } of queued) {
			play(name, options)
		}
	}

	function play(name: string, options: Readonly<PlayOptions> = {}) {
		if (isMute) {
			return -1
		}

		const sound = sounds[name]
		if (!sound) {
			console.error(`could not find sound with name: ${name}`)
			return -1
		}
		const { loop, onEnd, volume = 1, randomPool, playWhenReady } = options

		if (Howler.ctx.state !== 'running') {
			if (playWhenReady) {
				if (pendingQueue.length >= MAX_QUEUE_SIZE) {
					console.warn(
						`audio pending queue full (${MAX_QUEUE_SIZE}), dropping oldest`
					)
					pendingQueue.shift()
				}
				pendingQueue.push({ name, options })
				if (!isListening) {
					Howler.ctx.addEventListener(
						'statechange',
						flushPendingQueue
					)
					isListening = true
				}
			} else {
				console.warn(
					`audio context not running, dropping sound: ${name}`
				)
				onEnd?.()
			}
			return -1
		}

		if (loop && !randomPool) {
			sound.loop(true)
		}

		sound.volume(volume)
		const id = sound.play()

		const state: PlaybackState = {
			name: `${name}_${id}`,
			soundName: name,
			onEnd,
			randomPool: loop && randomPool ? randomPool : undefined,
			options,
		}
		playbacks.set(id, state)

		sound.once('end', handleSoundEnd, id)

		return id
	}

	function isSoundPlaying(id: number) {
		return playbacks.has(id)
	}

	function setVolumeById(id: number, volume: number) {
		const state = playbacks.get(id)
		if (!state) {
			return
		}

		const sound = sounds[state.soundName]
		if (sound) {
			sound.volume(volume, id)
		}
	}

	function fadeById(id: number, from: number, to: number, duration: number) {
		const state = playbacks.get(id)
		if (!state) {
			return
		}

		const sound = sounds[state.soundName]
		if (sound) {
			sound.fade(from, to, duration, id)
			// Auto-stop when fading to silence (looping sounds would play silently otherwise)
			if (to === 0) {
				sound.once('fade', () => {
					stopById(id)
				}, id)
			}
		}
	}

	function stopById(id: number) {
		const state = playbacks.get(id)
		if (!state) {
			return
		}

		const sound = sounds[state.soundName]
		if (sound) {
			sound.off('end', handleSoundEnd, id)
			sound.stop(id)
		}
		playbacks.delete(id)
	}

	function stop(name: string) {
		const sound = sounds[name]
		if (!sound) {
			console.error(`could not find sound with name: ${name}`)
			return
		}

		// Remove only our tracked handlers by play ID
		for (const [id, state] of playbacks) {
			if (state.soundName === name) {
				sound.off('end', handleSoundEnd, id)
				playbacks.delete(id)
			}
		}

		sound.stop()
	}

	function remove(name: string) {
		stop(name)

		// Clean pending queue
		for (let i = pendingQueue.length - 1; i >= 0; --i) {
			if (pendingQueue[i].name === name) {
				pendingQueue.splice(i, 1)
			}
		}

		const sound = sounds[name]
		if (sound) {
			sound.unload()
			delete sounds[name]
		}
	}

	function destroy() {
		if (isListening) {
			Howler.ctx.removeEventListener('statechange', flushPendingQueue)
			isListening = false
		}
		pendingQueue.length = 0

		visibilityHandler.destroy()

		for (const name of Object.keys(sounds)) {
			// Clean up tracked playbacks for this sound
			for (const [id, state] of playbacks) {
				if (state.soundName === name) {
					sounds[name].off('end', handleSoundEnd, id)
					playbacks.delete(id)
				}
			}
			sounds[name].stop()
			sounds[name].unload()
			delete sounds[name]
		}

		playbacks.clear()
	}

	return {
		add(name: string, src: string, options: Readonly<AddOptions> = {}) {
			const { preload = true, autoplay = false, onLoaded } = options
			const sound = new Howl({
				src: [src],
				preload,
				autoplay,
				html5: false,
			})
			sounds[name] = sound
			if (onLoaded) {
				sound.once('load', onLoaded)
			}
			return this
		},
		addBuffer(
			name: string,
			buffer: ArrayBuffer,
			options: Readonly<AddOptions> = {}
		) {
			const { autoplay = false, onLoaded } = options
			const blob = new Blob([buffer], { type: 'audio/mpeg' })
			const url = URL.createObjectURL(blob)
			const sound = new Howl({
				src: [url],
				format: ['mp3'],
				preload: true,
				autoplay,
				html5: false,
			})
			sounds[name] = sound
			if (onLoaded) {
				sound.once('load', onLoaded)
			}
			return this
		},
		play,
		stop,
		stopById,
		setVolumeById,
		fadeById,
		remove,
		isSoundPlaying,
		setMute,
		destroy,
	}
}
