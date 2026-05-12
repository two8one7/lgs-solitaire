// @lgs/content-pack — schema + validation + migration for LGS content packs.
//
// What lives here: the universal schema (types, validators), the migration
// step that fills v1 packs with v2 defaults, the personality theme shape,
// and pure helpers (`resolveCopy`, `buildDailyPack`) that transform a
// validated pack without touching the runtime.
//
// What does NOT live here: pack-registry mapping (publisher slug → raw
// JSON), the env-var read that picks which pack at build time, and the
// `contentPack` singleton — these are application-specific and stay in
// each game's runtime under a small loader module (e.g.
// `apps/web/src/trivia/pack-loader.ts`).

export * from './types'
export * from './content-pack'
