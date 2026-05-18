#!/usr/bin/env node
/**
 * Smoke test for checkBundle().
 * Run: node packages/personality-lint/__tests__/verify-pack-bundle.smoke.mjs
 */
import { checkBundle } from '../verify-pack-bundle.mjs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '../__fixtures__/verify-pack-bundle')

// Clean fixture — no violations expected.
const clean = checkBundle(join(FIXTURES, 'clean/_astro'))
if (clean.violations.length !== 0) throw new Error(`clean fixture: expected 0 violations, got ${clean.violations.length}`)
if (clean.filesScanned !== 1) throw new Error(`clean fixture: expected 1 file scanned, got ${clean.filesScanned}`)

// Leaked fixture — exactly 1 violation expected.
const leaked = checkBundle(join(FIXTURES, 'leaked/_astro'))
if (leaked.violations.length !== 1) throw new Error(`leaked fixture: expected 1 violation, got ${leaked.violations.length}`)
if (leaked.filesScanned !== 1) throw new Error(`leaked fixture: expected 1 file scanned, got ${leaked.filesScanned}`)

console.log('verify-pack-bundle smoke: all assertions passed')
