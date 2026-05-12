import { Howler } from 'howler'

export function createVisibilityHandler() {
	let debounceId: ReturnType<typeof setTimeout> | undefined

	function handleVisibility() {
		if (debounceId !== undefined) clearTimeout(debounceId)
		debounceId = setTimeout(() => {
			debounceId = undefined
			if (
				document.visibilityState === 'visible' &&
				Howler.ctx?.state !== 'running'
			) {
				Howler.ctx?.resume()
			}
		}, 100)
	}

	document.addEventListener('visibilitychange', handleVisibility)

	return {
		destroy() {
			if (debounceId !== undefined) {
				clearTimeout(debounceId)
				debounceId = undefined
			}
			document.removeEventListener('visibilitychange', handleVisibility)
		},
	}
}
