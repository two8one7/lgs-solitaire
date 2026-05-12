import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { IHaptics } from '@2817/platform'

const IMPACT_STYLE_MAP = {
	light: ImpactStyle.Light,
	medium: ImpactStyle.Medium,
	heavy: ImpactStyle.Heavy,
} as const

const NOTIFICATION_TYPE_MAP = {
	success: NotificationType.Success,
	warning: NotificationType.Warning,
	error: NotificationType.Error,
} as const

// Wraps @capacitor/haptics so callers get a sync void-returning API that
// matches IHaptics. Underlying calls are async (Capacitor IPC); we
// fire-and-forget — placement-feel snap haptic doesn't need a confirmation
// roundtrip, and a missed haptic is preferable to an awaited one stalling
// the input pipeline. Failures are logged (not silently swallowed) so a
// missing native bridge surfaces as a console warning instead of a black
// hole — see the slate-only-screen debugging session in commit 9b7a681.

function warn(label: string, err: unknown): void {
	console.warn(`[CapacitorHapticsAdapter] ${label} failed:`, err)
}

export class CapacitorHapticsAdapter implements IHaptics {
	impact(style: 'light' | 'medium' | 'heavy'): void {
		void Haptics.impact({ style: IMPACT_STYLE_MAP[style] }).catch((err: unknown) => warn('impact', err))
	}

	notification(type: 'success' | 'warning' | 'error'): void {
		void Haptics.notification({ type: NOTIFICATION_TYPE_MAP[type] }).catch((err: unknown) => warn('notification', err))
	}

	selection(): void {
		void Haptics.selectionStart().catch((err: unknown) => warn('selectionStart', err))
		void Haptics.selectionEnd().catch((err: unknown) => warn('selectionEnd', err))
	}
}
