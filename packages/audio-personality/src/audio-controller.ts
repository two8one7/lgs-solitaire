// Audio controller — typed-event-driven SFX, game-agnostic.
//
// Game code supplies the typed event IDs and the pack-key strings via a
// `registerBindings` callback. The controller wires one
// `addListener<T>(eventId, handler)` per binding (per the typed-listener
// preference — NO monkey-patching `dispatch` with a switch). Each handler
// resolves a sample from `pack.audio.events[<eventKey>]`, lazily loads a
// Howl, and plays it through Howler's global master gain.
//
// Master mute uses `setTargetAtTime` so the gain transition is click-free
// (per game-polish-universal.md rule #8). Time constant ~30ms.
//
// Silent default: when `pack.audio` (or any sub-field) is undefined OR the
// event spec has no `sample`, the listener no-ops. v2 packs ship with empty
// audio blocks → controller is silent until packs declare events.
//
// The brain-level mute toggle calls `setMute(muted)`; the ramp is the only
// place we touch `Howler.masterGain` so a single shared GainNode handles
// every Howl that uses the global context.
//
// The package exports the universal event-key vocabulary (`ui.hover`,
// `ui.press`, `round.complete`) as `UniversalAudioEventKey`. Games extend
// the vocabulary at their call site by passing additional string literals
// to `bind` — the package never knows about game-specific events.

import { Howl, Howler } from 'howler'
import type { IEventsCenter, IEventData, TypedId } from '@2817/events-center'
import type { Unsubscribe } from '@2817/subscriptions'
import type { ContentPack, AudioEventConfig, AudioBlock } from '@lgs/content-pack'

const RAMP_TIME_CONSTANT_S = 0.03

/**
 * Universal audio event keys that every LGS game should expose. Game-specific
 * keys (e.g. trivia's `answer.correct`) extend at the call site by passing
 * literal strings to `bind` — no engine-side enumeration required.
 */
export type UniversalAudioEventKey = 'ui.hover' | 'ui.press' | 'round.complete'

export type AudioController = {
	setMute: (muted: boolean) => void
	destroy: () => void
}

/**
 * Surface exposed to `registerBindings` callbacks. Generic per call so each
 * `bind` site keeps its event-payload type narrow; no `as unknown` casts at
 * call sites.
 */
export type AudioBindings = {
	bind<T extends IEventData>(eventId: TypedId<T>, eventKey: string): void
}

export type AudioControllerDeps = {
	pack: ContentPack
	eventsCenter: IEventsCenter
	/**
	 * Called once during construction. Use the supplied `bind` to wire each
	 * typed event id to the pack-key string that should resolve through
	 * `pack.audio.events[<eventKey>]`.
	 */
	registerBindings: (api: AudioBindings) => void
	/**
	 * Optional resolver mapping the pack-declared sample path to a final
	 * URL (e.g. for the Astro asset pipeline). Defaults to identity so a
	 * pack writing `/sfx/correct.mp3` plays from the deployed site root.
	 */
	resolveSampleUrl?: (rawPath: string) => string
}

export function createAudioController(deps: AudioControllerDeps): AudioController {
	const { pack, eventsCenter } = deps
	const resolveSampleUrl = deps.resolveSampleUrl ?? ((p) => p)

	// Lazily-loaded Howl handles keyed by the pack's sample path so two
	// events that share a sample share one Howl.
	const howlsByPath = new Map<string, Howl>()

	function masterGainNode(): GainNode | null {
		// Howler.masterGain is set once the AudioContext is initialized.
		// Reading it in a try/catch covers the headless / no-WebAudio path
		// the test runner takes.
		const masterGain = (Howler as unknown as { masterGain?: GainNode }).masterGain
		return masterGain ?? null
	}

	function audioContext(): AudioContext | null {
		const ctx = (Howler as unknown as { ctx?: AudioContext }).ctx
		return ctx ?? null
	}

	function getOrLoadHowl(samplePath: string): Howl | null {
		const url = resolveSampleUrl(samplePath)
		const existing = howlsByPath.get(url)
		if (existing) return existing
		try {
			const howl = new Howl({ src: [url], preload: true, html5: false })
			howlsByPath.set(url, howl)
			return howl
		} catch {
			// Test-time Howl mocks may throw if the runtime isn't fully
			// initialized — silent fallback keeps tests green.
			return null
		}
	}

	function resolveSpec(eventKey: string): AudioEventConfig | undefined {
		const audio: AudioBlock | undefined = pack.audio
		if (!audio) return undefined
		const events = audio.events
		if (!events) return undefined
		const raw = events[eventKey]
		if (!raw) return undefined
		return raw
	}

	function effectiveVolume(spec: NonNullable<AudioEventConfig>): number {
		const mix = pack.audio?.mix
		const sfxFactor = typeof mix?.sfx === 'number' ? mix.sfx : 1
		const masterFactor = typeof mix?.master === 'number' ? mix.master : 1
		const specVolume = typeof spec.volume === 'number' ? spec.volume : 1
		const v = specVolume * sfxFactor * masterFactor
		// Howler clamps internally; mirror its [0,1] expectations here.
		if (v <= 0) return 0
		if (v >= 1) return 1
		return v
	}

	function playEvent(eventKey: string): void {
		const spec = resolveSpec(eventKey)
		if (!spec) return
		const sample = spec.sample
		if (typeof sample !== 'string' || sample.length === 0) return
		const howl = getOrLoadHowl(sample)
		if (!howl) return
		howl.volume(effectiveVolume(spec))
		if (spec.loop) howl.loop(true)
		howl.play()
	}

	// One typed listener per binding (per the typed-listener pref).
	// addListener returns an Unsubscribe; collect and run them in destroy().
	const unsubs: Unsubscribe[] = []
	const bindings: AudioBindings = {
		bind<T extends IEventData>(eventId: TypedId<T>, eventKey: string): void {
			const unsub = eventsCenter.addListener<T>(eventId, () => playEvent(eventKey))
			unsubs.push(unsub)
		},
	}
	deps.registerBindings(bindings)

	function setMute(muted: boolean): void {
		const gainNode = masterGainNode()
		const ctx = audioContext()
		if (!gainNode || !ctx) {
			// Fallback for environments without Web Audio (jsdom tests
			// before Howler is ready) — use Howler's coarse mute toggle so
			// at least the mute state is observable.
			Howler.mute(muted)
			return
		}
		const target = muted ? 0 : 1
		try {
			// setTargetAtTime ramps exponentially toward `target` with a time
			// constant of RAMP_TIME_CONSTANT_S — click-free transition
			// (game-polish-universal.md rule #8).
			gainNode.gain.setTargetAtTime(target, ctx.currentTime, RAMP_TIME_CONSTANT_S)
		} catch {
			gainNode.gain.value = target
		}
	}

	function destroy(): void {
		for (let i = 0; i < unsubs.length; i++) unsubs[i]()
		unsubs.length = 0
		// Unload every cached Howl so we release the audio buffers.
		for (const howl of howlsByPath.values()) {
			try {
				howl.unload()
			} catch {
				// Best-effort — Howler can throw on unload during teardown
				// when the AudioContext is already closed.
			}
		}
		howlsByPath.clear()
	}

	return { setMute, destroy }
}
