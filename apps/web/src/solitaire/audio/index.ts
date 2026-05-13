/**
 * Solitaire audio bridge — pack-driven SFX wired to typed gameplay events.
 */

import { createSoundPlayer } from '@2817/audio'
import type { ISoundPlayer } from '@2817/audio'
import type { IEventsCenter } from '@2817/events-center'
import {
	AutoCompleteTickEventId,
	CardPickupEventId,
	CardTapEventId,
	DailyCompleteEventId,
	FoundationCompletedEventId,
	MoveExecutedEventId,
	MoveRejectedEventId,
	StockCycledEventId,
	type AutoCompleteTickEventData,
	type CardPickupEventData,
	type CardTapEventData,
	type DailyCompleteEventData,
	type FoundationCompletedEventData,
	type MoveExecutedEventData,
	type MoveRejectedEventData,
	type StockCycledEventData,
} from '../events'
import type { SolitaireAudioBlock, SolitaireAudioEvent, SolitaireContentPack } from '../types'

export type SolitaireAudio = {
	startAmbient: () => void
	stopAmbient: () => void
	setMute: (mute: boolean) => void
	destroy: () => void
}

export type CreateSolitaireAudioDeps = {
	pack: SolitaireContentPack
	eventsCenter: IEventsCenter
	player?: ISoundPlayer
}

const AUDIO_EVENTS: SolitaireAudioEvent[] = [
	'ui.hover',
	'ui.press',
	'card.flip',
	'card.pick-up',
	'card.place-valid',
	'card.place-invalid',
	'card.stock-draw',
	'card.stock-reset',
	'foundation.complete',
	'autocomplete.start',
	'autocomplete.card',
	'round.complete',
	'ambient.title',
]

const AMBIENT_TRACK: SolitaireAudioEvent = 'ambient.title'

export function createSolitaireAudio(deps: CreateSolitaireAudioDeps): SolitaireAudio {
	const { pack, eventsCenter } = deps
	const audio: SolitaireAudioBlock = pack.audio
	const player: ISoundPlayer = deps.player ?? createSoundPlayer()

	for (let i = 0; i < AUDIO_EVENTS.length; i++) {
		const name = AUDIO_EVENTS[i]!
		const track = audio.events[name]
		if (track.sample === null) continue
		player.add(name, `/${track.sample}`)
	}

	function effectiveVolume(name: SolitaireAudioEvent): number {
		const track = audio.events[name]
		const channel = track.loop ? audio.mix.music : audio.mix.sfx
		return track.volume * audio.mix.master * channel
	}

	function playOneShot(name: SolitaireAudioEvent): void {
		const track = audio.events[name]
		if (track.sample === null) return
		player.play(name, {
			volume: effectiveVolume(name),
			loop: false,
			playWhenReady: true,
		})
	}

	let ambientId = -1
	function startAmbient(): void {
		const track = audio.events[AMBIENT_TRACK]
		if (track.sample === null) return
		if (ambientId >= 0 && player.isSoundPlaying(ambientId)) return
		ambientId = player.play(AMBIENT_TRACK, {
			volume: effectiveVolume(AMBIENT_TRACK),
			loop: track.loop === true,
			playWhenReady: true,
		})
	}

	function stopAmbient(): void {
		if (ambientId >= 0) {
			player.stopById(ambientId)
			ambientId = -1
			return
		}
		player.stop(AMBIENT_TRACK)
	}

	const unsubCardTap = eventsCenter.addListener<CardTapEventData>(
		CardTapEventId,
		(data) => playOneShot(data.source === 'stock' ? 'ui.press' : 'card.flip'),
	)
	const unsubPickup = eventsCenter.addListener<CardPickupEventData>(
		CardPickupEventId,
		() => playOneShot('card.pick-up'),
	)
	const unsubMove = eventsCenter.addListener<MoveExecutedEventData>(
		MoveExecutedEventId,
		() => playOneShot('card.place-valid'),
	)
	const unsubRejected = eventsCenter.addListener<MoveRejectedEventData>(
		MoveRejectedEventId,
		() => playOneShot('card.place-invalid'),
	)
	const unsubStock = eventsCenter.addListener<StockCycledEventData>(
		StockCycledEventId,
		(data) => {
			if (data.kind === 'draw') playOneShot('card.stock-draw')
			if (data.kind === 'recycle') playOneShot('card.stock-reset')
			if (data.kind === 'empty') playOneShot('card.place-invalid')
		},
	)
	const unsubFoundation = eventsCenter.addListener<FoundationCompletedEventData>(
		FoundationCompletedEventId,
		() => playOneShot('foundation.complete'),
	)
	const unsubAuto = eventsCenter.addListener<AutoCompleteTickEventData>(
		AutoCompleteTickEventId,
		() => playOneShot('autocomplete.card'),
	)
	const unsubComplete = eventsCenter.addListener<DailyCompleteEventData>(
		DailyCompleteEventId,
		() => {
			stopAmbient()
			playOneShot('round.complete')
		},
	)

	function setMute(mute: boolean): void {
		player.setMute(mute)
	}

	function destroy(): void {
		unsubCardTap?.()
		unsubPickup?.()
		unsubMove?.()
		unsubRejected?.()
		unsubStock?.()
		unsubFoundation?.()
		unsubAuto?.()
		unsubComplete?.()
		stopAmbient()
		player.destroy()
	}

	return { startAmbient, stopAmbient, setMute, destroy }
}
