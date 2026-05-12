export interface ISoundPlayer {
	add(name: string, src: string, options?: Readonly<AddOptions>): ISoundPlayer
	addBuffer(
		name: string,
		buffer: ArrayBuffer,
		options?: Readonly<AddOptions>
	): ISoundPlayer
	play(name: string, options?: Readonly<PlayOptions>): number
	stop(name: string): void
	stopById(id: number): void
	setVolumeById(id: number, volume: number): void
	fadeById(id: number, from: number, to: number, duration: number): void
	remove(name: string): void

	setMute(mute: boolean): void

	isSoundPlaying(id: number): boolean

	destroy(): void
}

export type FadeOutAllOptions = {
	duration?: number
}
export type ResumeOptions = {
	fade?: boolean
	fadeDuration?: number
}
export type PopOptions = {
	duration?: number
}
export interface IMusicPlayer {
	add(name: string, src: string, options?: Readonly<AddOptions>): IMusicPlayer
	play(name: string, options?: Readonly<PlayOptions>): void
	stop(name?: string): void
	remove(name: string): void

	fadeOutAll(options?: Readonly<FadeOutAllOptions>): void
	pause(): void
	resume(options?: Readonly<ResumeOptions>): void

	push(name: string, options?: Readonly<PlayOptions>): void
	pop(options?: PopOptions): void

	getActiveTracksCount(): number

	destroy(): void
}

export type AddOptions = {
	preload?: boolean
	autoplay?: boolean
	onLoaded?: () => void
	onUnlock?: () => void
}

export type PlayOptions = {
	loop?: boolean
	volume?: number
	fade?: boolean
	fadeDuration?: number
	onEnd?: () => void
	randomPool?: string[]
	playWhenReady?: boolean
}
