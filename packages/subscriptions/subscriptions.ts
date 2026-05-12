export function createSubscriptions() {
	const list: (() => void)[] = []

	return {
		unsubscribe() {
			for (let i = 0, len = list.length; i < len; i++) {
				list[i]()
			}
			list.length = 0
		},
		push(unsubscribe: () => void) {
			list.push(unsubscribe)
		},
	}
}

export type Unsubscribe = (() => void) & {
	addTo(subscriptions: ReturnType<typeof createSubscriptions>): Unsubscribe
}

export function createUnsubscribe(func: (() => void) | undefined): Unsubscribe {
	let called = false
	function unsub() {
		if (called) return
		called = true
		func!()
		func = undefined
	}
	unsub.addTo = addToHelper
	return unsub as Unsubscribe
}

function addToHelper(
	this: Unsubscribe,
	subscriptions: ReturnType<typeof createSubscriptions>,
) {
	subscriptions.push(this)
	return this
}
