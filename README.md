# lgs-solitaire

LGS Solitaire — daily Klondike + Spider variants for Local Games Service publishers.

Part of the Local Games Service catalog (`projects/local-games-service.md`). Same engine packages as `lgs-sudoku` / `lgs-trivia` / `lgs-crossword` / `lgs-memory`:

- `@lgs/content-pack` — pack schema + daily rotation
- `@lgs/render-personality` — shape tokens / particles / transitions / typography / texture cache
- `@lgs/audio-personality` — pack-driven audio resolver
- `@lgs/personality-lint` — no-publisher-ifs CI gate

Build sequence per `playbook/lgs-game-build-process.md`:

1. Phase 1 — GDD
2. Phase 2 — scaffold (Astro + pixi v8 + `@2817/*` packages + `@lgs/*` workspace deps)
3. Phase 3 — logic systems (ECS)
4. Phase 4 — render + first pack
5. Phase 5 — per-publisher Firebase deploy
6. Phase 6 — personality engine port (typography / shape / particles / transitions / audio)
7. Phase 7 — per-publisher personality packs + stranger-pair acceptance
8. Phase 8 — package consumption (`@lgs/*` workspace deps wired)
