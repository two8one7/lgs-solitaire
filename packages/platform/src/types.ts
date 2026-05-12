// Surface-agnostic platform adapter interfaces. Implementations live in
// sibling packages (@2817/platform-web, @2817/platform-capacitor).
//
// Puzzle code receives these by DI token and treats them as opaque.
// `Capacitor.isNativePlatform()` branching belongs in the createPlatform()
// factory at the composition root — never inside game code.

export interface ISaveAdapter {
	get(key: string): string | null
	set(key: string, value: string): boolean
	remove(key: string): void
	keys(): string[]
}

export interface IHaptics {
	impact(style: 'light' | 'medium' | 'heavy'): void
	notification(type: 'success' | 'warning' | 'error'): void
	selection(): void
}

export type LifecycleEvent = 'foreground' | 'background'

export interface ILifecycle {
	addListener(event: LifecycleEvent, cb: () => void): () => void
}

export interface IPlatform {
	readonly name: 'web' | 'capacitor-ios' | 'capacitor-android'
	readonly save: ISaveAdapter
	readonly haptics: IHaptics
	readonly lifecycle: ILifecycle
}
