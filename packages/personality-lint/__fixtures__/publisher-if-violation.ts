// FIXTURE FILE — used by lint-no-publisher-ifs.test.ts to verify the lint rule catches violations.
// This file intentionally contains a banned publisher-identity comparison.
// DO NOT import or execute this file in production code.

export function badRenderDecision(slug: string): string {
  if (slug === 'broche') {
    return 'dark-glass'
  }
  return 'default'
}
