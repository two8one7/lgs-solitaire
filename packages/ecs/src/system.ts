export type SystemFunc = {
	(dt: number): void
	destroy?: () => void
}

export function createSys(func: SystemFunc, destroy?: () => void) {
	func.destroy = destroy
	return func
}
