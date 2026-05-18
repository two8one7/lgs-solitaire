#!/usr/bin/env node
/**
 * Verify gate: after `astro build`, fail if the emitted client bundle still
 * contains the literal token `PUBLIC_LGS_PACK`. Presence means Vite's
 * static-replace pass failed (typically because source aliased `import.meta`
 * to a local before reading `.env.PUBLIC_LGS_PACK`).
 *
 * See: failures/2026-05-18-vite-static-replace-alias-hid-pack-env.md
 *      failures/2026-05-10-vite-import-meta-alias-static-replace.md
 *      two8one7/two8one7#82
 *
 * Usage: node packages/personality-lint/verify-pack-bundle.mjs <expected-slug> [dist-dir]
 *
 * - <expected-slug>  Pack slug that should appear in the bundle (e.g. `lake-nona`, `broche`).
 *                    Currently only used for the success message.
 * - [dist-dir]       Defaults to `apps/web/dist/_astro`.
 *
 * Exits non-zero with a clear message if `PUBLIC_LGS_PACK` is found in any
 * `*.js` file under the dist dir.
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, relative } from 'path'

const TOKEN = 'PUBLIC_LGS_PACK'

/**
 * Recursively walk `dir` and collect all `*.js` files.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function walkJs(dir) {
	const files = []
	const entries = readdirSync(dir, { withFileTypes: true })
	for (let i = 0; i < entries.length; i++) {
		const e = entries[i]
		const full = join(dir, e.name)
		if (e.isDirectory()) {
			const sub = walkJs(full)
			for (let j = 0; j < sub.length; j++) files.push(sub[j])
		} else if (e.isFile() && e.name.endsWith('.js')) {
			files.push(full)
		}
	}
	return files
}

/**
 * Count non-overlapping occurrences of `needle` in `haystack`.
 *
 * @param {string} haystack
 * @param {string} needle
 * @returns {number}
 */
function countOccurrences(haystack, needle) {
	let count = 0
	let idx = 0
	while ((idx = haystack.indexOf(needle, idx)) !== -1) {
		count++
		idx += needle.length
	}
	return count
}

/**
 * Check all `*.js` files under `distDir` for the presence of `PUBLIC_LGS_PACK`.
 *
 * @param {string} distDir - Path to the `_astro` output directory.
 * @returns {{ violations: Array<{file: string, count: number}>, filesScanned: number }}
 */
export function checkBundle(distDir) {
	const jsFiles = walkJs(distDir)
	const violations = []
	for (let i = 0; i < jsFiles.length; i++) {
		const content = readFileSync(jsFiles[i], 'utf8')
		if (content.includes(TOKEN)) {
			const count = countOccurrences(content, TOKEN)
			violations.push({ file: jsFiles[i], count })
		}
	}
	return { violations, filesScanned: jsFiles.length }
}

// --- CLI entry point --------------------------------------------------------

const isMain =
	import.meta.url === `file://${process.argv[1]}` ||
	process.argv[1]?.endsWith('verify-pack-bundle.mjs')

if (isMain && process.argv[1] != null) {
	const expectedSlug = process.argv[2] ?? ''
	const distDir = process.argv[3] ?? 'apps/web/dist/_astro'

	if (!existsSync(distDir)) {
		console.error(`verify:pack-bundle: ${distDir} not found — did the build run?`)
		process.exit(1)
	}

	const { violations, filesScanned } = checkBundle(distDir)

	if (violations.length > 0) {
		for (let i = 0; i < violations.length; i++) {
			const rel = relative(process.cwd(), violations[i].file)
			console.error(`${rel} contains ${TOKEN} (${violations[i].count} occurrence${violations[i].count === 1 ? '' : 's'})`)
		}
		console.error(
			`source likely aliases import.meta — use canonical inline-cast pattern, see failures/2026-05-18-vite-static-replace-alias-hid-pack-env.md`
		)
		process.exit(1)
	}

	console.log(`✓ verify:pack-bundle ${expectedSlug} — no ${TOKEN} leakage in ${filesScanned} bundle file${filesScanned === 1 ? '' : 's'}`)
	process.exit(0)
}
