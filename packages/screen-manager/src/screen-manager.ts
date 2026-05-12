import { createUnsubscribe } from '@2817/subscriptions'
import type {
	GoOptions,
	IDisplayObject,
	IModal,
	IScreen,
	IScreenManager,
	ITransition,
	ScreenCallback,
	ScreenManagerConfig,
} from './types'

export function createScreenManager(
	config: ScreenManagerConfig
): IScreenManager {
	const { screenParent, modalParent, transitionParent } = config

	const screensByName: Record<string, IScreen> = {}
	const modalsByName: Record<string, IModal> = {}
	const transitionsByName: Record<string, ITransition> = {}

	const screenStack: string[] = []
	const modalsOpen: string[] = []

	let activeScreen: IScreen | undefined
	let defaultTransitionName = ''
	let navigating = false
	let pendingNavigation: { name: string; options: GoOptions } | null = null

	const willExitCallbacks: ScreenCallback[] = []
	const didExitCallbacks: ScreenCallback[] = []
	const willEnterCallbacks: ScreenCallback[] = []
	const didEnterCallbacks: ScreenCallback[] = []

	// --- Registration ---

	function addScreen(screen: IScreen): void {
		if (screensByName[screen.name]) {
			throw new Error(`Screen "${screen.name}" is already registered`)
		}
		screensByName[screen.name] = screen
	}

	function addModal(modal: IModal): void {
		if (modalsByName[modal.name]) {
			throw new Error(`Modal "${modal.name}" is already registered`)
		}
		modalsByName[modal.name] = modal
	}

	function addTransition(transition: ITransition): void {
		if (transitionsByName[transition.name]) {
			throw new Error(
				`Transition "${transition.name}" is already registered`
			)
		}
		transitionsByName[transition.name] = transition
		if (!defaultTransitionName) {
			defaultTransitionName = transition.name
		}
	}

	function removeScreen(name: string): void {
		delete screensByName[name]
		const idx = screenStack.indexOf(name)
		if (idx >= 0) {
			screenStack.splice(idx, 1)
		}
	}

	// --- Initialize ---

	async function initialize(): Promise<void> {
		for (const name of Object.keys(screensByName)) {
			await screensByName[name].initialize?.(manager)
		}
		for (const name of Object.keys(modalsByName)) {
			await modalsByName[name].initialize?.(manager)
		}
		for (const name of Object.keys(transitionsByName)) {
			await transitionsByName[name].initialize?.()
		}
	}

	async function exitScreen(
		screen: IScreen,
		removeFromHistory: boolean,
	): Promise<void> {
		fireCallbacks(willExitCallbacks, screen.name)
		await screen.exit?.(manager)
		screenParent.removeChild(screen.display)
		fireCallbacks(didExitCallbacks, screen.name)
		if (activeScreen === screen) {
			activeScreen = undefined
		}
		if (removeFromHistory) {
			const idx = screenStack.lastIndexOf(screen.name)
			if (idx !== -1) {
				screenStack.splice(idx, 1)
			}
		}
	}

	// --- Navigation ---

	async function go(name: string, options: GoOptions = {}): Promise<void> {
		// Same-screen check
		if (activeScreen?.name === name) {
			return
		}

		// Re-entrancy guard
		if (navigating) {
			pendingNavigation = { name, options }
			return
		}

		navigating = true

		try {
			const { skipTransition = false, excludeFromHistory = false } =
				options

			// Show transition
			const transition = !skipTransition ? await showTransition() : null

			// Exit current screen
			const currentScreen = activeScreen
			if (currentScreen) {
				await exitScreen(currentScreen, false)
			}

			// Enter new screen
			const newScreen = screensByName[name]
			if (!newScreen) {
				// Restore previous screen if we removed it
				if (currentScreen) {
					screenParent.addChild(currentScreen.display)
					activeScreen = currentScreen
				}
				await hideTransition(transition)
				throw new Error(`Screen "${name}" is not registered`)
			}

			screenParent.addChild(newScreen.display)
			activeScreen = newScreen
			fireCallbacks(willEnterCallbacks, name)

			try {
				await newScreen.enter?.(manager)
			} catch (error) {
				// Error recovery — clean up failed screen, restore previous
				await newScreen.exit?.(manager)
				screenParent.removeChild(newScreen.display)

				if (currentScreen) {
					screenParent.addChild(currentScreen.display)
					activeScreen = currentScreen
					await currentScreen.enter?.(manager)
				} else {
					activeScreen = undefined
				}

				await hideTransition(transition)

				if (currentScreen) {
					currentScreen.revealed?.(manager)
				}

				throw error
			}

			if (!excludeFromHistory) {
				screenStack.push(name)
			}

			fireCallbacks(didEnterCallbacks, name)
			await hideTransition(transition)
			newScreen.revealed?.(manager)
		} finally {
			navigating = false

			// Process pending navigation (last wins)
			if (pendingNavigation) {
				const pending = pendingNavigation
				pendingNavigation = null
				void go(pending.name, pending.options)
			}
		}
	}

	async function back(): Promise<boolean> {
		if (screenStack.length <= 1) {
			return false
		}

		// Pop current screen from stack
		screenStack.pop()
		const previous = screenStack[screenStack.length - 1]

		await go(previous, { excludeFromHistory: true })
		return true
	}

	async function dismissActive(): Promise<boolean> {
		if (!activeScreen) {
			return false
		}
		if (navigating) {
			throw new Error('Cannot dismiss active screen while navigation is in progress')
		}

		navigating = true
		try {
			await exitScreen(activeScreen, true)
			return true
		} finally {
			navigating = false
			if (pendingNavigation) {
				const pending = pendingNavigation
				pendingNavigation = null
				void go(pending.name, pending.options)
			}
		}
	}

	// --- Modals ---

	async function showModal(
		name: string
	): Promise<ReturnType<typeof createUnsubscribe>> {
		const modal = modalsByName[name]
		if (!modal) {
			throw new Error(`Modal "${name}" is not registered`)
		}

		modalParent.addChild(modal.display)
		await modal.enter?.(manager)
		modalsOpen.push(name)

		return createUnsubscribe(() => {
			void closeModal(name)
		})
	}

	async function closeModal(name: string): Promise<void> {
		const modal = modalsByName[name]
		if (!modal) {
			throw new Error(`Modal "${name}" is not registered`)
		}

		await modal.exit?.(manager)
		modalParent.removeChild(modal.display)

		const idx = modalsOpen.indexOf(name)
		if (idx >= 0) {
			modalsOpen.splice(idx, 1)
		}
	}

	async function closeAllModals(): Promise<void> {
		// Close in reverse order, properly awaiting each
		for (let i = modalsOpen.length - 1; i >= 0; --i) {
			await closeModal(modalsOpen[i])
		}
	}

	// --- Transitions ---

	async function showTransition(name?: string): Promise<ITransition | null> {
		const n = name || defaultTransitionName
		const transition = n ? transitionsByName[n] : undefined
		if (!transition) {
			return null
		}

		transitionParent.addChild(transition.display)
		await transition.enter()
		return transition
	}

	async function hideTransition(
		transition: ITransition | null
	): Promise<void> {
		if (!transition) {
			return
		}
		await transition.exit()
		transitionParent.removeChild(transition.display)
	}

	function useTransition(name: string): void {
		defaultTransitionName = name
	}

	// --- Update / Destroy ---

	function update(dt: number): void {
		activeScreen?.update?.(dt)
	}

	async function destroy(): Promise<void> {
		// Close all open modals
		await closeAllModals()

		// Exit the active screen
		if (activeScreen) {
			await exitScreen(activeScreen, false)
		}

		// Destroy all registered items
		for (const name of Object.keys(screensByName)) {
			screensByName[name].destroy?.()
		}
		for (const name of Object.keys(modalsByName)) {
			modalsByName[name].destroy?.()
		}
		for (const name of Object.keys(transitionsByName)) {
			transitionsByName[name].destroy?.()
		}
	}

	// --- Lifecycle callbacks ---

	function fireCallbacks(callbacks: ScreenCallback[], name: string): void {
		for (const cb of callbacks) {
			cb(name)
		}
	}

	function onScreenWillExit(cb: ScreenCallback) {
		willExitCallbacks.push(cb)
		return createUnsubscribe(() => {
			const idx = willExitCallbacks.indexOf(cb)
			if (idx !== -1) {
				willExitCallbacks.splice(idx, 1)
			}
		})
	}

	function onScreenDidExit(cb: ScreenCallback) {
		didExitCallbacks.push(cb)
		return createUnsubscribe(() => {
			const idx = didExitCallbacks.indexOf(cb)
			if (idx !== -1) {
				didExitCallbacks.splice(idx, 1)
			}
		})
	}

	function onScreenWillEnter(cb: ScreenCallback) {
		willEnterCallbacks.push(cb)
		return createUnsubscribe(() => {
			const idx = willEnterCallbacks.indexOf(cb)
			if (idx !== -1) {
				willEnterCallbacks.splice(idx, 1)
			}
		})
	}

	function onScreenDidEnter(cb: ScreenCallback) {
		didEnterCallbacks.push(cb)
		return createUnsubscribe(() => {
			const idx = didEnterCallbacks.indexOf(cb)
			if (idx !== -1) {
				didEnterCallbacks.splice(idx, 1)
			}
		})
	}

	const manager = {
		addScreen,
		addModal,
		addTransition,
		removeScreen,
		initialize,
		go,
		back,
		dismissActive,
		showModal,
		closeModal,
		closeAllModals,
		showTransition,
		hideTransition,
		useTransition,
		update,
		destroy,
		get activeScreenName() {
			return activeScreen?.name
		},
		onScreenWillExit,
		onScreenDidExit,
		onScreenWillEnter,
		onScreenDidEnter,
	} satisfies IScreenManager

	return manager
}
