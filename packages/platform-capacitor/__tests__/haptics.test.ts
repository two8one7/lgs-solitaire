/**
 * Contract tests for CapacitorHapticsAdapter (native implementation).
 *
 * IHaptics methods return void — the underlying @capacitor/haptics APIs are
 * async, but the adapter must fire-and-forget so the puzzle layer never awaits
 * a haptic.
 *
 * RED today: ../src/haptics does not exist. Tests go GREEN once Sprint 1 lands
 * the real CapacitorHapticsAdapter class.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@capacitor/haptics', () => ({
	Haptics: {
		impact: vi.fn().mockResolvedValue(undefined),
		notification: vi.fn().mockResolvedValue(undefined),
		selectionStart: vi.fn().mockResolvedValue(undefined),
		selectionEnd: vi.fn().mockResolvedValue(undefined),
	},
	ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
	NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}))

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { CapacitorHapticsAdapter } from '../src/haptics'

describe('CapacitorHapticsAdapter', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('impact("light") calls Haptics.impact with ImpactStyle.Light', () => {
		const haptics = new CapacitorHapticsAdapter()
		haptics.impact('light')
		expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Light })
	})

	it('impact("medium") calls Haptics.impact with ImpactStyle.Medium', () => {
		const haptics = new CapacitorHapticsAdapter()
		haptics.impact('medium')
		expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Medium })
	})

	it('impact("heavy") calls Haptics.impact with ImpactStyle.Heavy', () => {
		const haptics = new CapacitorHapticsAdapter()
		haptics.impact('heavy')
		expect(Haptics.impact).toHaveBeenCalledWith({ style: ImpactStyle.Heavy })
	})

	it('notification("success") maps to NotificationType.Success', () => {
		const haptics = new CapacitorHapticsAdapter()
		haptics.notification('success')
		expect(Haptics.notification).toHaveBeenCalledWith({ type: NotificationType.Success })
	})

	it('notification("warning") maps to NotificationType.Warning', () => {
		const haptics = new CapacitorHapticsAdapter()
		haptics.notification('warning')
		expect(Haptics.notification).toHaveBeenCalledWith({ type: NotificationType.Warning })
	})

	it('notification("error") maps to NotificationType.Error', () => {
		const haptics = new CapacitorHapticsAdapter()
		haptics.notification('error')
		expect(Haptics.notification).toHaveBeenCalledWith({ type: NotificationType.Error })
	})

	it('selection() calls selectionStart() then selectionEnd() in order', () => {
		const haptics = new CapacitorHapticsAdapter()
		haptics.selection()
		expect(Haptics.selectionStart).toHaveBeenCalledTimes(1)
		expect(Haptics.selectionEnd).toHaveBeenCalledTimes(1)
		const startOrder = (Haptics.selectionStart as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
		const endOrder = (Haptics.selectionEnd as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
		expect(startOrder).toBeLessThan(endOrder)
	})

	it('all methods return void (fire-and-forget, not Promise)', () => {
		const haptics = new CapacitorHapticsAdapter()
		expect(haptics.impact('light')).toBeUndefined()
		expect(haptics.notification('success')).toBeUndefined()
		expect(haptics.selection()).toBeUndefined()
	})
})
