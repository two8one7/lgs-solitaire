import type { IHaptics } from '@2817/platform'

// Web has no first-class haptic API on iOS Safari (and `navigator.vibrate`
// is Android-only and ignored on iOS). The web adapter is a no-op; haptic
// feedback only fires on Capacitor iOS via @capacitor/haptics. Web games
// stay audio-only — see GDD North Star 4.

export class NoOpHaptics implements IHaptics {
	impact(_style: 'light' | 'medium' | 'heavy'): void {
		// no-op
	}

	notification(_type: 'success' | 'warning' | 'error'): void {
		// no-op
	}

	selection(): void {
		// no-op
	}
}
