// @lgs/audio-personality — pack-driven SFX/music controller shared by every
// LGS game. Universal events (ui.hover / ui.press / round.complete) are
// exported as the `UniversalAudioEventKey` literal type; per-game events
// extend by passing additional string literals to `bind` at the call site.

export { createAudioController } from './audio-controller'
export type {
	AudioBindings,
	AudioController,
	AudioControllerDeps,
	UniversalAudioEventKey,
} from './audio-controller'
