#!/usr/bin/env node
/**
 * Lint gate: fail if any file under apps/web/src/ contains publisher-identity
 * comparisons like `slug === 'broche'` or `publisher === 'lake-nona'`.
 *
 * Personality customization MUST go through the content-pack schema.
 * If a personality needs an engine hook, extend the schema — never add
 * publisher-identity branches in engine code.
 *
 * See: plans/per-skin-personality.md §2.8 and apps/web/CLAUDE.md
 *
 * Usage (CI):
 *   node packages/personality-lint/lint-no-publisher-ifs.mjs [target-dir]
 *
 * Usage (module):
 *   import { checkSource } from './packages/personality-lint/lint-no-publisher-ifs.mjs'
 *   const violations = checkSource(source, filePath)
 */

import { readFileSync, readdirSync } from 'fs'
import { join, relative } from 'path'

/**
 * Pattern that detects publisher-identity comparisons.
 * Catches `publisher === ...`, `slug === ...`, and hardcoded slug string comparisons.
 *
 * Note: intentionally NOT a multiline regex — each line is checked independently.
 * Comment-line filtering below handles `//` and `*` prefixes.
 */
const PATTERN = /publisher\s*===|slug\s*===|===\s*['"]lake-nona|===\s*['"]broche|===\s*['"]west-orange/

/**
 * Check source text for publisher-if violations.
 * Lines starting with `//` or `*` (JSDoc / block comments) are skipped.
 *
 * @param source - TypeScript source text
 * @param filePath - Label for error messages (file path or `<input>`)
 * @returns Array of violation strings (empty = no violations)
 */
export function checkSource(source, filePath = '<input>') {
  const lines = source.split('\n')
  const violations = []
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart()
    // Skip single-line comment lines and JSDoc/block-comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
    if (PATTERN.test(lines[i])) {
      violations.push(`${filePath}:${i + 1}: ${lines[i].trim()}`)
    }
  }
  return violations
}

/**
 * Recursively collect production .ts/.tsx files under dir.
 * Excludes test files (*.test.ts, *.spec.ts, *.test.tsx, *.spec.tsx)
 * and __tests__ / __fixtures__ directories — the rule targets engine code, not test fixtures.
 */
function walkDir(dir) {
  let files = []
  const entries = readdirSync(dir, { withFileTypes: true })
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const fullPath = join(dir, e.name)
    if (e.isDirectory()) {
      // Skip test/fixture directories
      if (e.name === '__tests__' || e.name === '__fixtures__') continue
      const sub = walkDir(fullPath)
      for (let j = 0; j < sub.length; j++) files.push(sub[j])
    } else if (e.isFile()) {
      const n = e.name
      // Skip test and spec files
      if (n.endsWith('.test.ts') || n.endsWith('.spec.ts') ||
          n.endsWith('.test.tsx') || n.endsWith('.spec.tsx')) continue
      if (n.endsWith('.ts') || n.endsWith('.tsx')) {
        files.push(fullPath)
      }
    }
  }
  return files
}

// --- CLI entry point (only when run directly, not when imported) -----------

const isMain = import.meta.url === `file://${process.argv[1]}` ||
  // normalised path comparison for symlinked environments
  process.argv[1]?.endsWith('lint-no-publisher-ifs.mjs')

if (isMain && process.argv[1] != null) {
  const targetDir = process.argv[2] ?? 'apps/web/src'
  let tsFiles
  try {
    tsFiles = walkDir(targetDir)
  } catch (err) {
    console.error(`[lint-no-publisher-ifs] ERROR: cannot read directory ${targetDir}: ${err.message}`)
    process.exit(1)
  }

  const allViolations = []
  for (let i = 0; i < tsFiles.length; i++) {
    const source = readFileSync(tsFiles[i], 'utf8')
    const rel = relative(process.cwd(), tsFiles[i])
    const violations = checkSource(source, rel)
    for (let j = 0; j < violations.length; j++) {
      allViolations.push(violations[j])
    }
  }

  if (allViolations.length > 0) {
    console.error('[lint-no-publisher-ifs] FAIL: publisher-identity comparisons found:')
    for (let i = 0; i < allViolations.length; i++) {
      console.error('  ' + allViolations[i])
    }
    console.error('')
    console.error('Personality customization MUST go through content-pack schema fields.')
    console.error('See: plans/per-skin-personality.md §2.8 and apps/web/CLAUDE.md')
    process.exit(1)
  }

  const count = tsFiles.length
  console.log(`[lint-no-publisher-ifs] OK — ${count} file${count === 1 ? '' : 's'} checked, 0 violations`)
  process.exit(0)
}
