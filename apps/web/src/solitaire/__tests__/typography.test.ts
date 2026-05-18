import { describe, it, expect } from 'vitest'
import { getTextStyle } from '@lgs/render-personality'
import type { ContentPack } from '@lgs/content-pack'

function makeTypoPack(
typo: NonNullable<NonNullable<ContentPack['personalityTheme']>['typography']> = {},
): ContentPack {
return {
personalityTheme: { typography: typo },
} as ContentPack
}

describe('fontSize — pack scale.<role> is px, not a multiplier', () => {
it('h1 pack scale value is used as px directly', () => {
const pack = makeTypoPack({ scale: { h1: 36 } })
expect(getTextStyle('h1', pack).fontSize).toBe(36)
})

it('h2 pack scale value is used as px directly', () => {
const pack = makeTypoPack({ scale: { h2: 26 } })
expect(getTextStyle('h2', pack).fontSize).toBe(26)
})

it('body pack scale value is used as px directly', () => {
const pack = makeTypoPack({ scale: { body: 18 } })
expect(getTextStyle('body', pack).fontSize).toBe(18)
})

it('small pack scale value is used as px directly', () => {
const pack = makeTypoPack({ scale: { small: 14 } })
expect(getTextStyle('small', pack).fontSize).toBe(14)
})

it('falls back to BASE_FONT_SIZES.h1 (32) when pack omits scale.h1', () => {
const pack = makeTypoPack()
expect(getTextStyle('h1', pack).fontSize).toBe(32)
})

it('falls back to BASE_FONT_SIZES.h2 (22) when pack omits scale.h2', () => {
const pack = makeTypoPack()
expect(getTextStyle('h2', pack).fontSize).toBe(22)
})

it('falls back to BASE_FONT_SIZES.body (16) when pack omits scale.body', () => {
const pack = makeTypoPack()
expect(getTextStyle('body', pack).fontSize).toBe(16)
})

it('falls back to BASE_FONT_SIZES.small (12) when pack omits scale.small', () => {
const pack = makeTypoPack()
expect(getTextStyle('small', pack).fontSize).toBe(12)
})

it('mono always uses BASE_FONT_SIZES.mono (14) regardless of pack scale', () => {
const pack = makeTypoPack({ scale: { h1: 999, h2: 999 } })
expect(getTextStyle('mono', pack).fontSize).toBe(14)
})

it('lake-nona representative: h1=36, h2=26, body=18, small=14', () => {
const pack = makeTypoPack({ scale: { h1: 36, h2: 26, body: 18, small: 14 } })
expect(getTextStyle('h1', pack).fontSize).toBe(36)
expect(getTextStyle('h2', pack).fontSize).toBe(26)
expect(getTextStyle('body', pack).fontSize).toBe(18)
expect(getTextStyle('small', pack).fontSize).toBe(14)
})
})
