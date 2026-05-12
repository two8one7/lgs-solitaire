// Simplified store — no nanostores dep. GD is Pixi-only, no reactive UI layer needed.
let _width = 0
let _height = 0

export function setSize(width: number, height: number): void {
	_width = width
	_height = height
}

export function getSize(): { width: number; height: number } {
	return { width: _width, height: _height }
}
