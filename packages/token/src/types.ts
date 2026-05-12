// Base shape shared by required and optional tokens
export interface TokenValue<T = unknown> {
	/** Phantom type — exists only at compile time, never read at runtime */
	readonly __t: T
	/** Unique Symbol identity */
	readonly __s: symbol
	/** Human-readable description for error messages */
	readonly __d: string
	/** Whether this is an optional token */
	readonly __o: boolean
}

// Required token (default) — __o is always false
export interface RequiredToken<T = unknown> extends TokenValue<T> {
	readonly __o: false
}

// Optional token — __o is always true
export interface OptionalToken<T = unknown> extends TokenValue<T> {
	readonly __o: true
}

// Full token: required shape + .optional accessor
export interface Token<T = unknown> extends RequiredToken<T> {
	readonly optional: OptionalToken<T>
}

// Extract the resolved type from a token:
// required → T, optional → T | undefined
export type TokenType<V extends TokenValue> = V extends RequiredToken<infer T>
	? T
	: V extends OptionalToken<infer T>
		? T | undefined
		: never
