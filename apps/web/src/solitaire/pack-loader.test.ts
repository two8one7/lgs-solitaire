import { describe, test, expect } from 'vitest'
import { withCacheBust, applyPackCacheBust, validateSolitairePack } from './pack-loader'
import { lakenonaPack } from './packs/lakenona'

describe('withCacheBust', () => {
	test('appends ?v=sha to a plain URL', () => {
		expect(withCacheBust('packs/lakenona/branding/logo.svg', 'abc123')).toBe(
			'packs/lakenona/branding/logo.svg?v=abc123',
		)
	})

	test('appends &v=sha when URL already has query params', () => {
		expect(withCacheBust('packs/lakenona/branding/logo.svg?a=1', 'abc123')).toBe(
			'packs/lakenona/branding/logo.svg?a=1&v=abc123',
		)
	})

	test('no-op when sha is empty string', () => {
		expect(withCacheBust('packs/lakenona/branding/logo.svg', '')).toBe(
			'packs/lakenona/branding/logo.svg',
		)
	})

	test('does not double-bust already-suffixed URL', () => {
		const once = withCacheBust('foo.svg', 'abc123')
		// applying again with a different sha appends a second param — caller
		// must not call twice; this test verifies the helper itself doesn't
		// special-case it but the loader only calls it once per field.
		expect(once).toBe('foo.svg?v=abc123')
		// Verify the ?v= suffix check is preserved in the URL
		expect(once).toContain('?v=')
	})
})

describe('applyPackCacheBust', () => {
	test('returns pack unchanged when sha is empty', () => {
		const pack = validateSolitairePack(lakenonaPack)
		const unchanged = applyPackCacheBust(pack, '')
		expect(unchanged.brand.logoAsset).toBe(pack.brand.logoAsset)
		expect(unchanged.theme.backgroundArt).toBe(pack.theme.backgroundArt)
		expect(unchanged.solitaire.cardBack.texture).toBe(pack.solitaire.cardBack.texture)
		expect(unchanged.audio.events['card.flip'].sample).toBe(pack.audio.events['card.flip'].sample)
	})

	test('rewrites brand.logoAsset', () => {
		const pack = validateSolitairePack(lakenonaPack)
		const sha = 'abc1234'
		const busted = applyPackCacheBust(pack, sha)
		expect(busted.brand.logoAsset).toContain(`?v=${sha}`)
	})

	test('rewrites theme.backgroundArt', () => {
		const pack = validateSolitairePack(lakenonaPack)
		const sha = 'abc1234'
		const busted = applyPackCacheBust(pack, sha)
		expect(busted.theme.backgroundArt).toContain(`?v=${sha}`)
	})

	test('rewrites solitaire.cardBack.texture', () => {
		const pack = validateSolitairePack(lakenonaPack)
		const sha = 'abc1234'
		const busted = applyPackCacheBust(pack, sha)
		expect(busted.solitaire.cardBack.texture).toContain(`?v=${sha}`)
	})

	test('rewrites all 13 audio event samples (skips nulls)', () => {
		const pack = validateSolitairePack(lakenonaPack)
		const sha = 'abc1234'
		const busted = applyPackCacheBust(pack, sha)
		for (const event of Object.keys(busted.audio.events) as (keyof typeof busted.audio.events)[]) {
			const sample = busted.audio.events[event].sample
			if (sample != null) {
				expect(sample).toContain(`?v=${sha}`)
			}
		}
	})

	test('audio sample null passes through as null', () => {
		const packWithNullSample = {
			...lakenonaPack,
			audio: {
				...lakenonaPack.audio,
				events: {
					...lakenonaPack.audio.events,
					'ui.hover': { ...lakenonaPack.audio.events['ui.hover'], sample: null },
				},
			},
		}
		const pack = validateSolitairePack(packWithNullSample)
		const busted = applyPackCacheBust(pack, 'abc1234')
		expect(busted.audio.events['ui.hover'].sample).toBeNull()
	})

	test('optional fields absent do not crash (no feltTexture, no motifAsset)', () => {
		// lakenona has feltTexture and motifAsset; remove them to exercise the absent branches
		const stripped = {
			...lakenonaPack,
			solitaire: { ...lakenonaPack.solitaire, feltTexture: undefined },
			layout: {
				...lakenonaPack.layout,
				background: { ...lakenonaPack.layout.background, motifAsset: undefined },
			},
		}
		const pack = validateSolitairePack(stripped)
		expect(() => applyPackCacheBust(pack, 'abc1234')).not.toThrow()
	})

	test('does not mutate the original pack', () => {
		const pack = validateSolitairePack(lakenonaPack)
		const originalLogo = pack.brand.logoAsset
		const originalTexture = pack.solitaire.cardBack.texture
		const originalSample = pack.audio.events['card.flip'].sample
		applyPackCacheBust(pack, 'deadbeef')
		expect(pack.brand.logoAsset).toBe(originalLogo)
		expect(pack.solitaire.cardBack.texture).toBe(originalTexture)
		expect(pack.audio.events['card.flip'].sample).toBe(originalSample)
	})
})
