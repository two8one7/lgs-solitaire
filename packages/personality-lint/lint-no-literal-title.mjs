#!/usr/bin/env node
/**
 * Lint gate: fail if `apps/web/src/pages/index.astro` ships hard-coded
 * `<title>` / `<meta name="description">` / `<meta property="og:title">` /
 * `<meta property="og:description">` literals.
 *
 * Pack-loader-driven games MUST flow brand text through `pack.brand.title`
 * (or destructured equivalents) so per-publisher dual-pack deploys produce
 * distinct HTML. Hard-coding any of these heads has shipped 7 times
 * (lgs-solitaire #7, lgs-memory dual-deploy, lgs-sudoku/word-hunt/wordle/
 * scavenger-hunt manual sweeps, lgs-florida-man-frenzy latent), each
 * caught only on Tommy review. See two8one7/two8one7#71.
 *
 * Rule shape:
 *   <title>X</title>          → X must be `{expr}`, not a literal string
 *   <meta name="description"  content="X"> or content={X}
 *   <meta property="og:title" ...>            same
 *   <meta property="og:description" ...>      same
 *
 * Usage (CI):
 *   node packages/personality-lint/lint-no-literal-title.mjs [target-file]
 *
 * Usage (module):
 *   import { checkSource } from './packages/personality-lint/lint-no-literal-title.mjs'
 *   const violations = checkSource(source, filePath)
 */

import { readFileSync } from 'fs'

const DEFAULT_TARGET = 'apps/web/src/pages/index.astro'

/**
 * Check the parsed Astro source for literal head metadata.
 *
 * @param {string} source - File text
 * @param {string} filePath - Label for error messages
 * @returns {string[]} Array of violation strings (empty = clean)
 */
export function checkSource(source, filePath = '<input>') {
	const violations = []

	// <title>...</title>: inner text must be a single Astro expression.
	const titleMatch = source.match(/<title>([\s\S]*?)<\/title>/i)
	if (titleMatch) {
		const inner = titleMatch[1].trim()
		if (!inner.startsWith('{') || !inner.endsWith('}')) {
			violations.push(`${filePath}: <title> must use {expr}, found literal: ${JSON.stringify(inner)}`)
		}
	}

	// <meta ... content="literal"> for description / og:title / og:description.
	// Expression form is content={expr}; literal form is content="..." or content='...'.
	const metaPatterns = [
		{ label: 'meta description', re: /<meta\s+name=["']description["']\s+content=([^>\s][^>]*?)\s*\/?>/gi },
		{ label: 'og:title',         re: /<meta\s+property=["']og:title["']\s+content=([^>\s][^>]*?)\s*\/?>/gi },
		{ label: 'og:description',   re: /<meta\s+property=["']og:description["']\s+content=([^>\s][^>]*?)\s*\/?>/gi },
	]
	for (const { label, re } of metaPatterns) {
		let m
		while ((m = re.exec(source)) !== null) {
			const raw = m[1].trim()
			// Astro expression form: content={ ... }
			if (raw.startsWith('{') && raw.endsWith('}')) continue
			// Literal form: content="..." or content='...'
			if (/^["'].*["']$/s.test(raw)) {
				violations.push(`${filePath}: <${label}> must use content={expr}, found literal ${raw}`)
			}
		}
	}

	return violations
}

function main() {
	const target = process.argv[2] || DEFAULT_TARGET
	let source
	try {
		source = readFileSync(target, 'utf8')
	} catch (err) {
		// Missing file is not a violation — some scaffolds may not have an index.astro yet.
		// (Fail loudly only if it's a real read error; ENOENT we tolerate.)
		if (err.code === 'ENOENT') {
			console.log(`lint-no-literal-title: ${target} not found, skipping`)
			process.exit(0)
		}
		throw err
	}
	const violations = checkSource(source, target)
	if (violations.length) {
		console.error('lint-no-literal-title FAILED:')
		for (const v of violations) console.error('  -', v)
		console.error('')
		console.error('Fix: import the pack-loader and use pack.brand.title / pack.brand.tagline.')
		console.error('See two8one7/two8one7#71 for the recurring-bug history.')
		process.exit(1)
	}
	console.log(`lint-no-literal-title: ${target} clean`)
}

// Run as CLI when invoked directly (not when imported as a module).
if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}
