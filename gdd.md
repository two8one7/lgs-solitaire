# LGS Solitaire GDD

## 1. Pitch

LGS Solitaire is the Tier 1 daily classic that proves the card-stacking skin axis for Local Games Service.

It gives every publisher a recognizable, low-friction game while the visual surface becomes theirs: card backs, felt, pips, court-card styling, table trim, victory ceremony, audio texture, and copy voice all come from the content pack.

The first release ships a daily Klondike Draw-1 puzzle because it is the smallest surface that proves the axis without muddying the Phase 2 scaffold with variant branching.

**Decision:** v1 ships Klondike Draw-1 only.

**Why:** Draw-1 creates a familiar 60-90 second daily session, needs one rules path, uses the existing `star-spangled-solitaire` solvable-deal corpus, and keeps the art-swap proof sharp. Draw-3 and Spider are useful follow-ons, but they add rule, scoring, tutorial, and failure-state branches before the skin contract has been proven.

**Tradeoff considered:** shipping Draw-1 + Draw-3 on day one would make the game feel more complete to solitaire purists, but it doubles the daily-picker matrix and complicates score comparison. Shipping Spider would prove another game family, but Spider has a different layout, real fail states, and a larger mobile layout burden.

The LGS catalog already includes Sudoku, Trivia, Crossword, and Memory as daily habits.

Solitaire fills a different reader mood: quiet, tactile, self-paced, familiar.

The publisher personality comes through the table rather than through generated content.

Lake Nona can feel bright, civic, polished, and modern.

West Orange can feel like a classic newspaper card table with warm ink, sharper masthead typography, and brass-like accents.

Those two skins should pass the stranger-pair test: an editor seeing the other publisher's build should recognize solitaire, not recognize the same white-label implementation.

The game is intentionally content-light.

There is no RSS ingest, no clue generation, and no editorial review loop for v1.

The daily deal is deterministic, solvable, static, and shared by every player for a publisher on a given date.

That makes it a cheap habit-builder for each new publisher onboarded into LGS.

The daily session target is:

- 20-40 seconds for a fast player on an easy deal.
- 60-90 seconds for an ordinary completion.
- 2-4 minutes when the player explores a less obvious sequence.

The game should feel good even when the player plays slowly.

This is not a speed-runner-only design.

The clock measures performance, but the tactile card handling is the main pleasure.

The default player promise is simple:

- Open today's local deck.
- Play one guaranteed-solvable Draw-1 Klondike deal.
- Beat the pack par time if you can.
- Keep the daily streak alive.
- Share the result card if it was a good run.

## 2. Core Loop

The player lands on the publisher-branded title scene, sees today's date, their current streak, and a single primary action: play today's solitaire.

On start, the game hydrates a pre-baked daily deal for the active content pack and date.

The deal is Klondike Draw-1:

- Seven tableau columns dealt 1, 2, 3, 4, 5, 6, and 7 cards.
- The top card in each tableau column starts face up.
- Remaining cards become stock.
- Stock draws one card at a time to waste.
- Tableau builds down in alternating colors.
- Foundations build up by suit from Ace to King.
- Empty tableau columns accept Kings only.
- Win means every card reaches a foundation.

The player can move cards by drag or by tap-to-place.

Drag is the expressive desktop and tablet path.

Tap is the preferred mobile path.

Tap-to-place behavior:

- Tap a face-up card or movable run to select it.
- Tap a legal destination to move it.
- Double-tap a card that can move to foundation to send it there.
- Tap stock to draw.
- Tap waste when selected to auto-place to the highest-priority legal target.

The engine may offer auto-placement when a move is unambiguous, but it must never hide a meaningful choice.

Auto-complete appears only when every tableau card is face up and all remaining legal moves are foundation moves.

**Decision:** the v1 core loop includes auto-complete after all tableau cards are face up.

**Why:** auto-complete reduces endgame friction without changing solve quality. The interesting part of Klondike is uncovering and sequencing hidden tableau cards; once that phase is over, finishing foundations manually is busywork.

**Tradeoff considered:** requiring manual foundation completion would preserve a stricter classic feel, but it turns many wins into repetitive tapping and weakens the 60-90 second daily session target.

Draw-3 extension hook:

- `VariantConfig.drawCount` accepts `1` or `3`.
- The same deck serialization can hydrate both Draw-1 and Draw-3 deals.
- Waste visibility and recycling rules live behind `StockRules`.
- Daily artifact path includes variant.
- Score records include variant.
- Tutorial copy branches by variant.

Spider extension hook:

- `VariantConfig.family` accepts `klondike` now and reserves `spider`.
- Spider owns a separate layout adapter, rules validator, and win detector.
- Spider daily artifacts must come from a different solvable corpus.
- Spider gets a real `lost` scene because blocked states can happen.

**Decision:** Draw-3 is the first extension after v1; Spider waits until the Klondike skin and storage path have shipped cleanly.

**Why:** Draw-3 reuses almost every render and layout primitive from Draw-1. Spider changes the board shape and failure model, so it belongs after the core solitaire renderer has proven itself.

**Tradeoff considered:** Spider 1-suit would broaden the catalog label from "Klondike" to "Solitaire variants" earlier, but it would force the GDD's Phase 2 systems to reserve more behavior than v1 needs.

## 3. Daily Picker

The daily picker selects a deterministic, pre-solved deck for each publisher, date, and variant.

Solvability is non-negotiable.

The client never runs a solver.

The client never asks a live API for a random deck.

The v1 artifact is baked at build time into `public/daily/<packSlug>/<variant>/<yyyy-mm-dd>.json`, matching the static daily-file shape used by Crossword rather than the runtime API shape in `star-spangled-solitaire`.

**Decision:** ship daily JSON files baked from the SQLite corpus at build time.

**Why:** static bake makes the "same deal for everyone in this publisher today" guarantee trivial, works with immutable Firebase hosting, avoids a runtime API dependency, and keeps the client small. It also lets Phase 5 build separate publisher artifacts with `CONTENT_PACK=<slug>` while the daily deal path stays stable.

**Tradeoff considered:** runtime fetch from a central deck API would let one corpus serve every publisher without pre-baking files, but it creates availability, cache, and CORS surfaces for a game that does not need live data. Bundling the full index into the app would remove per-day files but would inflate every publisher bundle with many unused deals.

### Source Library Reference

`/Users/tommyato/Documents/projects/superhq/projects/star-spangled-solitaire/` contains the existing solvable-deal library.

The useful reusable pieces are:

- `packages/solitaire-solver/src/deserialize.ts`
- `packages/solitaire-solver/src/checker.ts`
- `packages/solitaire-solver/src/moves.ts`
- `packages/solitaire-solver/src/solver.ts`
- `packages/solitaire-consts/src/index.ts`
- `tools/generate-games/src/deck.ts`
- `tools/generate-games/src/main.ts`
- `tools/backfill-solutions/src/main.ts`
- `tools/check-solutions/src/main.ts`
- `test-deck.json`

The SQLite corpus table is created in `apps/api/src/sync.ts`:

```sql
CREATE TABLE IF NOT EXISTS solitaire_decks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deck TEXT NOT NULL,
  total_moves INTEGER NOT NULL,
  iterations INTEGER NOT NULL,
  play_actions TEXT NOT NULL
);
```

The same file creates:

```sql
CREATE INDEX IF NOT EXISTS idx_solitaire_decks_type ON solitaire_decks(type);
CREATE INDEX IF NOT EXISTS idx_solitaire_decks_iterations ON solitaire_decks(iterations);
```

`apps/api/src/services/sqliteSolitaireDecks.ts` also creates a local `daily_challenges` table:

```sql
CREATE TABLE IF NOT EXISTS daily_challenges (
  date_key TEXT PRIMARY KEY,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deck TEXT NOT NULL,
  total_moves INTEGER NOT NULL,
  iterations INTEGER NOT NULL,
  play_actions TEXT NOT NULL
);
```

LGS should not lift that runtime `daily_challenges` table as-is.

The LGS build bake should lift the corpus table and solver validation tools, then write static JSON.

The existing `dailyChallenge.ts` API chooses a random type with 70% Klondike Draw-1 and 30% Klondike Draw-3, then stores the date key on first request.

That is wrong for LGS because it is request-order dependent and not publisher-scoped.

LGS replaces it with deterministic selection.

### Serialized Deal Shape

`test-deck.json` shows the deal payload shape:

```json
{
  "deck": "2D,12C,13H,1S,13S,12D,2S,6S,7S,5C,1H,4H,10C,3S,11D,6H,6C,7C,4S,7D,8C,3D,12S,6D,13C,9D,5H,5S,4C,2C,8D,7H,1D,8S,2H,9H,11H,4D,9S,9C,11C,3H,10S,11S,10D,1C,10H,8H,5D,3C,12H,13D",
  "type": "klondike-1",
  "playActions": [
    { "type": "draw" },
    { "type": "move-to", "from": "waste", "to": "pile-6" },
    { "type": "reset-stock" }
  ]
}
```

The serialized `deck` is a comma-separated 52-card list.

Each card token is `<value><suit>`.

Values are `1` through `13`.

Suits are `S`, `H`, `C`, and `D`.

The solver deserializer maps the final character to suit and the prefix to numeric value.

`play_actions` is JSON text in SQLite and becomes `playActions` in API responses.

Actions include:

- `{ "type": "draw" }`
- `{ "type": "reset-stock" }`
- `{ "type": "move-to", "from": "waste", "to": "foundation-clubs" }`
- `{ "type": "move-to", "from": "pile-6", "to": "pile-5", "count": 2 }`

The LGS v1 client does not need to reveal the solver solution to the player.

It should keep `playActions` in the baked artifact for validation, analytics, and future hint generation.

### Selection Function

Seed input:

```text
lgs-solitaire:<packSlug>:<regionSlug>:<yyyy-mm-dd>:klondike-1:<dealCorpusVersion>
```

Hash:

```text
FNV-1a 32-bit
```

Selection:

1. Query eligible rows from `solitaire_decks` where `type = 'klondike-1'` and `play_actions <> '[]'`.
2. Filter out rows whose `total_moves` or `iterations` fall outside the v1 daily band.
3. Sort rows by stable `id` ascending during bake so selection is independent of SQLite row order.
4. Compute `index = hash(seedInput) % eligibleRows.length`.
5. Select the row at `index`.
6. Validate the row by replaying `play_actions` with `validateSolution(deck, actions, 1)`.
7. Write the static daily JSON artifact.

Daily difficulty band:

- `total_moves` minimum: 35.
- `total_moves` maximum: 140.
- `iterations` maximum: 5000.
- `play_actions` must validate.

The band intentionally avoids ultra-short trivial deals and very long solver-only deals.

The pack can tune par time, not the selected deal set.

Daily artifact:

```json
{
  "schemaVersion": 1,
  "game": "lgs-solitaire",
  "packSlug": "lakenona",
  "regionSlug": "lake-nona",
  "date": "2026-05-12",
  "variant": "klondike-1",
  "seed": "lgs-solitaire:lakenona:lake-nona:2026-05-12:klondike-1:v1",
  "source": {
    "repo": "star-spangled-solitaire",
    "table": "solitaire_decks",
    "id": "uuid-from-corpus",
    "type": "klondike-1"
  },
  "deck": "2D,12C,13H,...",
  "totalMoves": 88,
  "iterations": 427,
  "solutionActions": []
}
```

`solutionActions` stores the corpus `play_actions` array.

The player-facing app should not expose the full solution in v1.

The artifact keeps it so future hints can be built without recomputing solvability.

## 4. States / Scenes

The v1 scene path is:

```text
boot -> title -> onboarding -> playing -> won -> daily-locked
```

`network-failure` is an overlay.

`give-up-confirm` is an overlay.

There is no `lost` scene in v1 because Klondike Draw-1 deals are selected from a validated solvable corpus.

**Decision:** "lost" is not a v1 scene; "give up" returns to title and keeps the daily available.

**Why:** a player can get stuck, but the selected deal is still solvable. Calling that a loss would lie about the state. A give-up action is a convenience escape, not a result.

**Tradeoff considered:** treating a stuck board as a loss could create a cleaner arcade loop, but it would punish exploratory play and conflict with the guaranteed-solvable daily promise.

Scene details:

- `boot` loads the content pack, static daily artifact, card-back texture, felt texture, pips, audio manifest, save slot, and local clock rollover state.
- `title` shows publisher brand, date, current streak, best local time, and one primary play CTA.
- `onboarding` appears on first play only and shows a short interactive sequence: tap stock, drag or tap a card to tableau, double-tap to foundation, auto-complete when unlocked.
- `playing` owns the board, HUD, timer, stock, waste, tableau, foundations, drag ghost, move feedback, and pause/give-up controls.
- `won` shows time, par delta, streak update, share card, and "come back tomorrow" copy.
- `daily-locked` appears after today's win and shows the completed result, next unlock countdown, streak, and share action.
- `network-failure` appears if pack or daily artifact loading fails and offers retry.
- `give-up-confirm` appears from pause or title resume and confirms leaving the current board unsolved.

Save behavior:

- In-progress games are resumable for the same date and pack.
- Winning today's daily locks the daily for that date.
- Giving up does not lock the daily.
- Starting over resets the local board but preserves the same daily deal.
- Completion records are keyed by `lgs-solitaire:<packSlug>:<variant>:<yyyy-mm-dd>`.

Rollover:

- Rollover hour comes from the content pack.
- The title scene checks rollover at boot and on visibility resume.
- A completed previous-day daily remains visible in history data but the play CTA points to the new date.

Spider extension:

- Spider adds `lost` between `playing` and `daily-locked`.
- Spider `lost` means no legal progress remains or the player exhausts stock with no productive moves.
- Spider is not present in the v1 route table.

## 5. Win + Score

Win means all 52 cards are in the four foundations.

The game records:

- `timeElapsedMs`
- `movesMade`
- `stockDraws`
- `stockResets`
- `foundationMoves`
- `autoCompleteUsed`
- `parDeltaMs`
- `currentStreak`
- `bestStreak`
- `bestTimeMs`

**Decision:** the primary score is par-time delta, consistent with Memory.

**Why:** par-time deltas are easy to read, work locally without a leaderboard, and give every pack a tunable target. They also keep completion as success, which fits a guaranteed-solvable daily better than points penalties.

**Tradeoff considered:** classic solitaire scoring could award points for card moves and subtract time penalties, but it adds a rule layer most casual readers do not know and makes pack tuning harder.

Scoring formula:

```text
parDeltaMs = playerTimeMs - pack.solitaire.parTimeSeconds * 1000
```

Display:

- Negative delta: "18s under par"
- Positive delta: "27s over par"
- Zero delta: "right on par"

Move count is secondary.

The win scene can show "Won in 1:14 / 92 moves / 18s under par."

Streak:

- Completing today's daily increments streak if yesterday was completed.
- Completing today's daily sets streak to 1 if the player missed the prior daily.
- Replaying after completion is not supported in v1.
- The challenge never needs a remote identity for v1.

Share card:

- Share copy comes from `pack.share.template`.
- Share image uses publisher palette, card-back crop, date, time, par delta, and streak.
- The share result must not include a move-by-move solution.
- The share result may include a compact card emoji-style foundation row if the pack requests it.

No leaderboard v1.

**Decision:** v1 has no local or remote leaderboard surface.

**Why:** the current LGS catalog direction is daily completion and share first. A leaderboard adds account, moderation, data retention, and UI surface before pilot behavior proves that players want comparison.

**Tradeoff considered:** a local-only leaderboard would be cheap, but it still consumes UI space and creates a second success metric. Best local time in save data gives the useful part without making it a social feature.

## 6. Onboarding

Onboarding is first-play only.

It is stored in the save slot as `solitaireTutorialComplete: true`.

The tutorial is playable, not a text wall.

It uses a tiny scripted board state derived from the real renderer so the first interaction teaches the actual controls.

Required steps:

1. Tap stock to flip one card to waste.
2. Drag a legal card to a tableau column.
3. Tap a card, then tap a legal destination.
4. Double-tap or tap the foundation target for a legal foundation move.
5. Trigger auto-complete preview when all tableau cards are face up.

The tutorial does not explain every Klondike rule.

It teaches the input language and the win target.

Rules copy is short:

- Build tableau down by alternating colors.
- Build foundations up by suit.
- Empty spaces take Kings.
- Finish all foundations to win.

Skip behavior:

- A visible skip action appears in onboarding.
- Skip writes `solitaireTutorialComplete: true`.
- "How to play" from title reopens onboarding without mutating daily state.

Mobile onboarding:

- Tap-first copy appears under 640 CSS px.
- Drag copy appears on pointer-capable devices.
- The same tutorial sequence works with touch and mouse.

Accessibility:

- Every tutorial action has a text label in the DOM overlay or Pixi accessibility layer.
- Keyboard users can focus stock, waste, tableau columns, and foundations.
- Enter selects or places.
- Escape cancels selection.

**Decision:** tutorial completion is per browser and per game, not per publisher.

**Why:** Klondike controls do not change by publisher. A player who learned on Lake Nona should not see the same input tutorial again on West Orange.

**Tradeoff considered:** per-publisher tutorial would let each publication inject voice, but repeating basic controls is noise. Publisher voice still appears in title, win, and share copy.

## 7. Render Decisions

The renderer uses Pixi v8, matching the current LGS game direction.

Logic systems contain no Pixi imports.

Render systems consume ECS state and content-pack personality.

Card geometry is primitive-driven:

- Card rects come from Pixi Graphics or cached generated textures.
- Corner radius comes from `@lgs/render-personality` `getRadius('sm'|'md'|'lg'|'pill', pack)`.
- Stroke width comes from `getStroke('thin'|'regular'|'bold', pack)`.
- Shape primitive comes from `pack.personalityTheme.shape.primitive`.
- Typography comes from `pack.personalityTheme.typography`.

Existing render-personality slots to use:

- `layout.composition`: `stacked-vertical`, `centered-editorial`, `masthead-classic`, `gallery`.
- `layout.slots.header`: title/HUD masthead region.
- `layout.slots.questionBlock`: stock/waste/foundation band in solitaire v1.
- `layout.slots.answerGrid`: tableau field in solitaire v1.
- `layout.slots.timerBar`: timer and par-progress strip.
- `layout.slots.footer`: share, sponsor bug, or legal footer region.
- `layout.background.kind`: `solid`, `gradient`, `vignette`, `textureTile`, `motif`.
- `personalityTheme.shape.cornerRadius.sm|md|lg|pill`.
- `personalityTheme.shape.strokeWidth.thin|regular|bold`.
- `personalityTheme.shape.primitive`: `rounded`, `sharp`, `organic`.
- `personalityTheme.motion.easing.entrance|exit|feedback|transition|ambient`.
- `personalityTheme.motion.durationMultiplier`.
- `juice.particles.correct|incorrect|ambient`.
- `juice.glows.selectedAnswer|correctReveal`.
- `juice.transitions.questionEnter|questionExit|answerHoverIn|answerPress`.
- `juice.shake.incorrect`.

Solitaire-specific mapping:

- `juice.particles.correct` drives foundation completion, auto-complete steps, and final win bursts.
- `juice.particles.incorrect` drives invalid-placement sparks or dust.
- `juice.particles.ambient` drives subtle felt/table ambience on title and locked scenes.
- `juice.glows.selectedAnswer` becomes selected-card glow.
- `juice.glows.correctReveal` becomes legal-destination and foundation-complete glow.
- `juice.transitions.answerPress` becomes card press, stock tap, and drag pick-up feedback.
- `juice.transitions.answerHoverIn` becomes hover/target affordance.
- `juice.transitions.questionEnter` becomes deal-in animation.
- `juice.transitions.questionExit` becomes scene exit.
- `juice.shake.incorrect` becomes invalid placement shake.

Card-back rendering:

- Card backs are pack assets resolved through the content-pack texture cache path.
- The GDD names the field `solitaire.cardBack.texture`.
- Phase 2 can stub against a default texture.
- Phase 8-style content-pack extension should add the typed schema.

Pip rendering:

- Numeric and suit pips can start as vector/text primitives.
- `solitaire.pipGlyphSet` selects `classic`, `editorial`, or `custom`.
- `solitaire.suitPalette` controls red/black equivalents by pack.
- Custom pips resolve through `assets.cardPips`.

Felt/table rendering:

- `solitaire.feltColor` is the fallback fill.
- `solitaire.feltTexture` is optional and resolves through texture cache.
- `layout.background` still controls the full scene backdrop behind the table.

**Decision:** v1 uses primitive-generated card faces and asset-driven card backs.

**Why:** faces must stay crisp at every screen size and do not need 52 bespoke assets. Card backs and felt carry publisher identity more efficiently.

**Tradeoff considered:** full custom 52-card face art per publisher would maximize differentiation, but it creates asset volume and QA work before the base renderer is proven. The schema leaves `custom` pips and court-card overlays for later.

## 8. Audio Decisions

Audio is pack-driven via `@lgs/audio-personality`.

The controller already supports universal event keys and arbitrary game-specific keys through `pack.audio.events[<eventKey>]`.

Existing universal keys:

- `ui.hover`
- `ui.press`
- `round.complete`

Solitaire v1 binds these game-specific event keys:

- `card.flip`
- `card.pick-up`
- `card.place-valid`
- `card.place-invalid`
- `card.stock-draw`
- `card.stock-reset`
- `foundation.complete`
- `autocomplete.start`
- `autocomplete.card`
- `round.complete`

Required v1 audio decisions:

- Flip: short paper/card snap.
- Valid place: soft table tap.
- Invalid place: muted click or dull thud.
- Foundation complete: brighter chime or small flourish.
- Win fanfare: `round.complete`.
- UI press and hover: use existing universal keys.

Audio source:

- Phase 7 generates per-pack SFX through the established audiogen workflow.
- Phase 2 may ship silent defaults because `@lgs/audio-personality` no-ops when samples are absent.
- Phase 4 first-publisher pack should include at least flip, valid place, invalid place, and win.
- Phase 5 second-publisher pack must vary audio enough to support the stranger-pair test.

**Decision:** v1 has no continuous music by default.

**Why:** Solitaire is quiet and tactile. Short action sounds carry the feel without making a local-news page noisy.

**Tradeoff considered:** a subtle loop could make the game feel more premium, but it creates mute-default and autoplay questions. Ambient music can be added per pack through `pack.audio.music.gameplay` after SFX are working.

Audio pack example:

```json
{
  "audio": {
    "events": {
      "ui.press": { "sample": "audio/ui-press.mp3", "volume": 0.45 },
      "card.flip": { "sample": "audio/card-flip.mp3", "volume": 0.55, "pitchVariance": 0.04 },
      "card.place-valid": { "sample": "audio/card-place.mp3", "volume": 0.5, "pitchVariance": 0.03 },
      "card.place-invalid": { "sample": "audio/card-invalid.mp3", "volume": 0.45 },
      "foundation.complete": { "sample": "audio/foundation-complete.mp3", "volume": 0.62 },
      "round.complete": { "sample": "audio/win-fanfare.mp3", "volume": 0.78 }
    },
    "mix": { "master": 1, "music": 0.7, "sfx": 1 }
  }
}
```

## 9. Pack Schema Additions

The existing `@lgs/content-pack` v2 personality blocks cover a large part of Solitaire:

- `brand`
- `palette`
- `theme`
- `share`
- `leaderboard`
- `assets`
- `juice`
- `layout`
- `personalityTheme`
- `audio`
- `copy`

Solitaire needs one game-specific block beyond the current Trivia/Memory shape.

**Decision:** add a `solitaire` block in a Phase 8-style shared content-pack schema follow-up, while Phase 2 can type it locally in the game repo.

**Why:** card backs, felt, pip glyphs, par time, and variant availability are game-specific. Forcing them into generic Trivia fields such as `dailyQuiz` would make the shared schema less clear and would invite fragile casts.

**Tradeoff considered:** no schema change would let Phase 2 move faster by using `assets.questionCardFrame` and palette fields, but it would hide load-bearing solitaire data behind unrelated names.

Proposed `solitaire` block:

```ts
type SolitaireBlock = {
  seedPrefix: string
  enabledVariants: ['klondike-1']
  rolloverHour: number
  parTimeSeconds: number
  cardBack: {
    texture: string
    palette?: string[]
  }
  feltColor: string
  feltTexture?: string
  pipGlyphSet: 'classic' | 'editorial' | 'custom'
  suitPalette: {
    red: string
    black: string
    accent?: string
  }
  table: {
    edgeStyle: 'none' | 'thin' | 'inlaid' | 'masthead'
    shadow: 'soft' | 'crisp' | 'none'
  }
  dealCorpusVersion: string
}
```

Required fields:

- `seedPrefix`
- `enabledVariants`
- `rolloverHour`
- `parTimeSeconds`
- `cardBack.texture`
- `feltColor`
- `pipGlyphSet`
- `suitPalette.red`
- `suitPalette.black`
- `dealCorpusVersion`

Optional fields:

- `cardBack.palette`
- `feltTexture`
- `suitPalette.accent`
- `table`

Existing fields still used:

- `layout.slots.header`
- `layout.slots.questionBlock`
- `layout.slots.answerGrid`
- `layout.slots.timerBar`
- `layout.slots.footer`
- `personalityTheme.typography`
- `personalityTheme.shape`
- `personalityTheme.motion`
- `juice`
- `audio`
- `copy`
- `share`

The schema should not include daily deck data.

Daily deck data belongs in static artifacts under `public/daily`.

The pack names the corpus version and visual behavior; the bake step names the actual deck.

## 10. Content-Pack Manifest Example

The following stubs give Phase 4 a concrete target.

They intentionally include the proposed `solitaire` block even though the shared `@lgs/content-pack` package will need a later typed schema extension.

### Lake Nona / Nonahood News Stub

```json
{
  "schemaVersion": 2,
  "slug": "lakenona",
  "publisherName": "Nonahood News",
  "regionName": "Lake Nona",
  "locale": "en-US",
  "timeZone": "America/New_York",
  "brand": {
    "title": "Lake Nona Solitaire",
    "shortName": "Nona Solitaire",
    "tagline": "Today's deck for the neighborhood.",
    "logoAsset": "branding/lakenona/logo.svg"
  },
  "palette": {
    "bg": "#F3F7F5",
    "panel": "#FFFFFF",
    "text": "#1E2B3A",
    "muted": "#697783",
    "accent": "#18A0AA",
    "accentAlt": "#F5B642",
    "correct": "#2F8F4E",
    "incorrect": "#C33A3A",
    "neutral": "#D8E3E1",
    "success": "#2F8F4E"
  },
  "theme": {
    "motif": "lakefront sunrise, modern neighborhood geometry, polished civic energy",
    "surface": "clean felt on a light editorial table",
    "uiTone": "bright, friendly, modern",
    "backgroundArt": "art/lakenona/solitaire-background.webp"
  },
  "solitaire": {
    "seedPrefix": "lgs-solitaire:lakenona",
    "enabledVariants": ["klondike-1"],
    "rolloverHour": 5,
    "parTimeSeconds": 90,
    "cardBack": {
      "texture": "cards/lakenona/card-back.png",
      "palette": ["#18A0AA", "#F5B642", "#FFFFFF"]
    },
    "feltColor": "#0F6E72",
    "feltTexture": "table/lakenona/felt-tile.webp",
    "pipGlyphSet": "editorial",
    "suitPalette": {
      "red": "#C94747",
      "black": "#17313A",
      "accent": "#F5B642"
    },
    "table": {
      "edgeStyle": "inlaid",
      "shadow": "soft"
    },
    "dealCorpusVersion": "star-spangled-solitaire-v1"
  },
  "layout": {
    "composition": "stacked-vertical",
    "slots": {
      "header": { "height": 72, "padding": [12, 16] },
      "questionBlock": { "height": 112, "maxWidth": 920, "padding": [10, 12] },
      "answerGrid": { "maxWidth": 980, "gap": 10 },
      "timerBar": { "height": 28, "maxWidth": 920 },
      "footer": { "height": 44 }
    },
    "background": {
      "kind": "motif",
      "motifAsset": "art/lakenona/subtle-map-lines.webp"
    },
    "responsive": {
      "narrowBreakpoint": 640,
      "narrowOverrides": {
        "composition": "stacked-vertical",
        "cardScale": 0.78
      }
    }
  },
  "personalityTheme": {
    "typography": {
      "headingStack": "Montserrat, Arial, sans-serif",
      "bodyStack": "Inter, Arial, sans-serif",
      "googleFonts": ["Montserrat:700", "Inter:400", "Inter:600"],
      "scale": { "h1": 1.08, "h2": 1, "body": 1, "small": 0.96 },
      "weight": { "heading": 700, "body": 400, "emphasis": 600 }
    },
    "shape": {
      "cornerRadius": { "sm": 8, "md": 12, "lg": 18, "pill": 9999 },
      "strokeWidth": { "thin": 1, "regular": 2, "bold": 3 },
      "primitive": "rounded",
      "scale": 1
    },
    "motion": {
      "durationMultiplier": 0.92,
      "easing": {
        "entrance": "easeOutCubic",
        "exit": "easeInOutSine",
        "feedback": "easeOutBack",
        "transition": "easeInOutCubic",
        "ambient": "easeInOutSine"
      }
    },
    "surface": {
      "panelFill": "#FFFFFF",
      "panelAlpha": 0.94,
      "vignette": false,
      "noiseTexture": false
    }
  },
  "juice": {
    "particles": {
      "correct": {
        "kind": "spark",
        "count": 28,
        "lifetimeMs": [500, 900],
        "speed": [70, 180],
        "spread": "upward",
        "gravity": 60,
        "size": [3, 8],
        "shape": "circle",
        "colors": ["accentAlt", "success", "#FFFFFF"],
        "blend": "screen",
        "fadeCurve": "easeOutCubic"
      },
      "incorrect": {
        "kind": "dust",
        "count": 8,
        "lifetimeMs": [180, 320],
        "speed": [20, 60],
        "spread": "radial",
        "gravity": 20,
        "size": [2, 4],
        "colors": ["incorrect", "muted"],
        "blend": "normal",
        "fadeCurve": "easeOutQuad"
      },
      "ambient": {
        "kind": "bloom",
        "count": 4,
        "lifetimeMs": [1200, 1800],
        "speed": [4, 14],
        "spread": "drift",
        "gravity": 0,
        "size": [6, 16],
        "colors": ["accent", "accentAlt"],
        "blend": "screen",
        "fadeCurve": "easeInOutSine"
      }
    },
    "glows": {
      "selectedAnswer": { "color": "accentAlt", "alpha": 0.42, "blur": 10, "pulseMs": 900 },
      "correctReveal": { "color": "success", "alpha": 0.5, "blur": 14, "pulseMs": 650 }
    },
    "transitions": {
      "questionEnter": { "kind": "fade", "ms": 260, "ease": "easeOutCubic" },
      "questionExit": { "kind": "fade", "ms": 180, "ease": "easeInCubic" },
      "answerHoverIn": { "scale": 1.025, "ms": 120, "ease": "easeOutQuad" },
      "answerPress": { "scale": 0.975, "ms": 90, "ease": "easeOutBack" }
    },
    "shake": {
      "incorrect": { "amplitude": 5, "ms": 160, "axis": "horizontal" }
    }
  },
  "audio": {
    "events": {
      "ui.press": { "sample": "audio/lakenona/ui-press.mp3", "volume": 0.38 },
      "card.flip": { "sample": "audio/lakenona/card-flip.mp3", "volume": 0.52, "pitchVariance": 0.04 },
      "card.place-valid": { "sample": "audio/lakenona/card-place.mp3", "volume": 0.48, "pitchVariance": 0.03 },
      "card.place-invalid": { "sample": "audio/lakenona/card-invalid.mp3", "volume": 0.42 },
      "foundation.complete": { "sample": "audio/lakenona/foundation-complete.mp3", "volume": 0.6 },
      "round.complete": { "sample": "audio/lakenona/win.mp3", "volume": 0.75 }
    },
    "mix": { "master": 1, "music": 0.7, "sfx": 1 }
  },
  "copy": {
    "playButton": "Deal today's deck",
    "completeTitle": "You cleared today's Lake Nona deck",
    "completeFooter": "Tomorrow's deck lands after sunrise.",
    "scoreLabel": "Par delta",
    "shareLabel": "Share result",
    "streakLabel": "Daily streak"
  },
  "share": {
    "template": "I cleared today's Lake Nona Solitaire in {time}, {parDelta}. Streak: {streak}.",
    "hashTag": "#LakeNonaSolitaire"
  },
  "leaderboard": {
    "mode": "off"
  }
}
```

### West Orange / Observer Stub

```json
{
  "schemaVersion": 2,
  "slug": "westorange",
  "publisherName": "West Orange Times & Observer",
  "regionName": "West Orange",
  "locale": "en-US",
  "timeZone": "America/New_York",
  "brand": {
    "title": "West Orange Solitaire",
    "shortName": "Observer Solitaire",
    "tagline": "A daily card table for West Orange.",
    "logoAsset": "branding/westorange/logo.svg"
  },
  "palette": {
    "bg": "#F6F1E7",
    "panel": "#FFFDF8",
    "text": "#25211A",
    "muted": "#776F62",
    "accent": "#1F5D50",
    "accentAlt": "#B78A2F",
    "correct": "#497B46",
    "incorrect": "#9C3D33",
    "neutral": "#DED3BF",
    "success": "#497B46"
  },
  "theme": {
    "motif": "classic newspaper masthead, warm card table, crisp ink lines",
    "surface": "matte felt and printed paper",
    "uiTone": "classic, legible, restrained",
    "backgroundArt": "art/westorange/solitaire-background.webp"
  },
  "solitaire": {
    "seedPrefix": "lgs-solitaire:westorange",
    "enabledVariants": ["klondike-1"],
    "rolloverHour": 5,
    "parTimeSeconds": 95,
    "cardBack": {
      "texture": "cards/westorange/card-back.png",
      "palette": ["#1F5D50", "#B78A2F", "#FFFDF8"]
    },
    "feltColor": "#174A3F",
    "feltTexture": "table/westorange/felt-tile.webp",
    "pipGlyphSet": "classic",
    "suitPalette": {
      "red": "#9C3D33",
      "black": "#25211A",
      "accent": "#B78A2F"
    },
    "table": {
      "edgeStyle": "masthead",
      "shadow": "crisp"
    },
    "dealCorpusVersion": "star-spangled-solitaire-v1"
  },
  "layout": {
    "composition": "masthead-classic",
    "slots": {
      "header": { "height": 84, "padding": [10, 18] },
      "questionBlock": { "height": 118, "maxWidth": 960, "padding": [8, 10] },
      "answerGrid": { "maxWidth": 1000, "gap": 8 },
      "timerBar": { "height": 26, "maxWidth": 900 },
      "footer": { "height": 48 }
    },
    "background": {
      "kind": "textureTile",
      "motifAsset": "art/westorange/newsprint-tile.webp"
    },
    "responsive": {
      "narrowBreakpoint": 640,
      "narrowOverrides": {
        "composition": "stacked-vertical",
        "cardScale": 0.76
      }
    }
  },
  "personalityTheme": {
    "typography": {
      "headingStack": "Libre Baskerville, Georgia, serif",
      "bodyStack": "Source Sans 3, Arial, sans-serif",
      "googleFonts": ["Libre Baskerville:700", "Source Sans 3:400", "Source Sans 3:600"],
      "scale": { "h1": 1, "h2": 0.98, "body": 1, "small": 0.94 },
      "weight": { "heading": 700, "body": 400, "emphasis": 600 }
    },
    "shape": {
      "cornerRadius": { "sm": 3, "md": 5, "lg": 7, "pill": 9999 },
      "strokeWidth": { "thin": 1, "regular": 2, "bold": 4 },
      "primitive": "sharp",
      "scale": 1
    },
    "motion": {
      "durationMultiplier": 1.08,
      "easing": {
        "entrance": "easeInOutQuart",
        "exit": "easeInCubic",
        "feedback": "easeOutQuad",
        "transition": "easeInOutSine",
        "ambient": "linear"
      }
    },
    "surface": {
      "panelFill": "#FFFDF8",
      "panelAlpha": 0.96,
      "vignette": true,
      "noiseTexture": true
    }
  },
  "juice": {
    "particles": {
      "correct": {
        "kind": "confetti",
        "count": 20,
        "lifetimeMs": [650, 1100],
        "speed": [45, 130],
        "spread": "upward",
        "gravity": 90,
        "size": [3, 7],
        "shape": "rect",
        "colors": ["accentAlt", "success", "panel"],
        "blend": "normal",
        "fadeCurve": "easeOutQuad"
      },
      "incorrect": {
        "kind": "dust",
        "count": 6,
        "lifetimeMs": [140, 280],
        "speed": [16, 44],
        "spread": "radial",
        "gravity": 30,
        "size": [2, 4],
        "colors": ["incorrect", "muted"],
        "blend": "normal",
        "fadeCurve": "easeOutQuad"
      },
      "ambient": {
        "kind": "dust",
        "count": 3,
        "lifetimeMs": [1500, 2400],
        "speed": [3, 9],
        "spread": "drift",
        "gravity": 0,
        "size": [3, 8],
        "colors": ["neutral", "panel"],
        "blend": "normal",
        "fadeCurve": "linear"
      }
    },
    "glows": {
      "selectedAnswer": { "color": "accentAlt", "alpha": 0.34, "blur": 6, "pulseMs": 1100 },
      "correctReveal": { "color": "success", "alpha": 0.4, "blur": 8, "pulseMs": 780 }
    },
    "transitions": {
      "questionEnter": { "kind": "curtain-wipe", "ms": 330, "ease": "easeInOutQuart" },
      "questionExit": { "kind": "fade", "ms": 210, "ease": "easeInCubic" },
      "answerHoverIn": { "scale": 1.015, "ms": 140, "ease": "easeOutQuad" },
      "answerPress": { "scale": 0.985, "ms": 100, "ease": "easeOutQuad" }
    },
    "shake": {
      "incorrect": { "amplitude": 4, "ms": 150, "axis": "horizontal" }
    }
  },
  "audio": {
    "events": {
      "ui.press": { "sample": "audio/westorange/ui-press.mp3", "volume": 0.36 },
      "card.flip": { "sample": "audio/westorange/card-flip.mp3", "volume": 0.5, "pitchVariance": 0.02 },
      "card.place-valid": { "sample": "audio/westorange/card-place.mp3", "volume": 0.46, "pitchVariance": 0.02 },
      "card.place-invalid": { "sample": "audio/westorange/card-invalid.mp3", "volume": 0.42 },
      "foundation.complete": { "sample": "audio/westorange/foundation-complete.mp3", "volume": 0.56 },
      "round.complete": { "sample": "audio/westorange/win.mp3", "volume": 0.72 }
    },
    "mix": { "master": 1, "music": 0.65, "sfx": 1 }
  },
  "copy": {
    "playButton": "Deal today's hand",
    "completeTitle": "Today's West Orange hand is cleared",
    "completeFooter": "A new hand is printed tomorrow morning.",
    "scoreLabel": "Against par",
    "shareLabel": "Share your hand",
    "streakLabel": "Daily run"
  },
  "share": {
    "template": "I cleared today's West Orange Solitaire in {time}, {parDelta}. Daily run: {streak}.",
    "hashTag": "#WestOrangeSolitaire"
  },
  "leaderboard": {
    "mode": "off"
  }
}
```

## 11. Logic Systems Table

Logic systems own rules, state mutation, persistence, scoring, and events.

They contain no Pixi imports, no DOM writes, and no render-personality calls.

| System | Components read | Components written | Responsibility |
| --- | --- | --- | --- |
| `daily-deal-hydration` | `ContentPackRef`, `DailyDealRef`, `SaveSlot` | `Deck`, `Stock`, `Waste`, `Tableau`, `Foundation`, `Variant`, `GameState` | Load today's static JSON, validate deck length and card uniqueness, build initial Klondike layout, restore in-progress save if valid. |
| `deck-indexer` | `Deck` | `Card[0..51]`, `CardColor`, `CardSuit`, `CardRank` | Parse serialized tokens such as `12C` into data-only card entities and stable card IDs. |
| `stock-system` | `Stock`, `Waste`, `Variant`, `MoveRules` | `Stock`, `Waste`, `MoveHistory`, `AudioCue` | Handle stock draw, waste reveal, stock reset, draw counter, and invalid stock taps. |
| `drag-input-system` | `PointerInput`, `CardLocation`, `MoveRules`, `Selection` | `DragInput`, `Selection`, `MoveIntent`, `AudioCue` | Convert pointer/touch actions into selected card runs or destination intents. |
| `tap-input-system` | `TapInput`, `CardLocation`, `MoveRules`, `Selection` | `Selection`, `MoveIntent`, `AudioCue` | Convert tap-to-select, tap-to-place, double-tap-to-foundation, and cancel actions into move intents. |
| `move-validator` | `MoveIntent`, `Tableau`, `Foundation`, `Stock`, `Waste`, `Variant` | `MoveResult`, `InvalidMoveReason` | Decide whether the requested move is legal under Klondike Draw-1 rules. |
| `move-apply-system` | `MoveResult`, `CardLocation`, `Tableau`, `Foundation`, `Waste` | `CardLocation`, `Tableau`, `Foundation`, `Waste`, `MoveHistory`, `FaceUpState`, `AudioCue` | Apply legal moves, flip newly exposed tableau cards, and record move count. |
| `auto-foundation-system` | `CardLocation`, `Foundation`, `MoveRules` | `MoveIntent` | Support double-tap or selected-card auto-foundation when exactly one foundation destination is legal. |
| `auto-complete-detect` | `Tableau`, `Foundation`, `Stock`, `Waste`, `FaceUpState` | `AutoCompleteState` | Enable auto-complete once all tableau cards are face up and remaining moves are deterministic foundation progress. |
| `auto-complete-system` | `AutoCompleteState`, `CardLocation`, `Foundation` | `MoveIntent`, `AutoCompleteState`, `AudioCue` | Step through deterministic foundation moves at a readable cadence after the player accepts auto-complete. |
| `win-detect` | `Foundation`, `Deck`, `GameState` | `WonFlag`, `GameState`, `ScoreCalc`, `AudioCue` | Detect all 52 cards in foundation, stop timer, compute score, and transition to won scene. |
| `timer-system` | `Timer`, `GameState` | `Timer` | Start on first move, pause on overlays, stop on win, persist elapsed time. |
| `streak-system` | `WonFlag`, `SaveSlot`, `DailyDate` | `Streak`, `SaveSlot` | Increment or reset daily streak based on last completed date. |
| `save-system` | `Deck`, `Stock`, `Waste`, `Tableau`, `Foundation`, `Timer`, `Streak`, `GameState` | `SaveSlot` | Persist in-progress and completed daily state under pack/date/variant key. |
| `share-payload-system` | `ScoreCalc`, `Streak`, `ContentPackRef`, `DailyDate` | `SharePayload` | Create share copy and card metadata from pack template and result values. |
| `give-up-system` | `GiveUpRequest`, `GameState` | `GameState`, `SaveSlot` | Clear in-progress state only after confirmation; never mark the daily failed. |
| `daily-lock-system` | `SaveSlot`, `DailyDate`, `WonFlag` | `DailyLockState`, `GameState` | Route completed same-day players to daily-locked. |
| `variant-gate-system` | `ContentPackRef`, `Variant` | `VariantAvailability` | Expose only `klondike-1` in v1 while preserving the typed extension point. |

Primary components:

- `Deck`: source deck string, corpus ID, variant, date, validation state.
- `Card`: rank, suit, color, stable index, face-up flag.
- `CardLocation`: `stock`, `waste`, `tableau:<0..6>`, or `foundation:<suit>`.
- `Stock`: ordered face-down card IDs and draw count.
- `Waste`: ordered face-up card IDs, top-card pointer.
- `Tableau`: seven ordered columns with face-up boundaries.
- `Foundation`: four suit piles and top rank per suit.
- `DragInput`: pointer ID, origin card, dragged run, current coordinates, candidate destination.
- `Selection`: selected card/run and selected source.
- `MoveIntent`: source, destination, count, input method.
- `MoveResult`: valid flag, reason, affected cards.
- `AutoCompleteState`: available, active, nextCard, cadenceMs.
- `Timer`: elapsedMs, running, startedAt.
- `Streak`: current, best, lastCompletedDate.
- `ScoreCalc`: parTimeMs, playerTimeMs, parDeltaMs, moveCount.

## 12. Render Systems Table

Render systems consume state and personality.

They may import Pixi and `@lgs/render-personality`.

They do not decide game legality.

| Render system | Components read | Pack slots read | Responsibility |
| --- | --- | --- | --- |
| `table-render` | `GameState`, `LayoutState` | `layout.background`, `solitaire.feltColor`, `solitaire.feltTexture`, `personalityTheme.surface` | Draw full background, table/felt plane, subtle motif, and responsive play area. |
| `hud-render` | `Timer`, `Streak`, `ScoreCalc`, `DailyLockState` | `layout.slots.header`, `layout.slots.timerBar`, `brand`, `copy`, `personalityTheme.typography` | Draw masthead, clock, par delta preview, streak, and date. |
| `card-render` | `Card`, `CardLocation`, `FaceUpState`, `Selection` | `solitaire.cardBack.texture`, `solitaire.cardBack.palette`, `personalityTheme.shape`, `personalityTheme.typography` | Draw card backs, faces, frame, rank, suit, and selected state. |
| `pip-render` | `Card`, `FaceUpState` | `solitaire.pipGlyphSet`, `solitaire.suitPalette`, `assets.cardPips` | Draw suit pips and court placeholders as vector or cached glyph sprites. |
| `stack-layout-render` | `Tableau`, `Stock`, `Waste`, `Foundation`, `Viewport` | `layout.slots.questionBlock`, `layout.slots.answerGrid`, `layout.responsive` | Compute card positions, stack offsets, overlap, and mobile scaling. |
| `deal-animation-render` | `Deck`, `GameState` | `juice.transitions.questionEnter`, `personalityTheme.motion` | Animate initial card deal into tableau using pack entrance timing. |
| `drag-ghost-render` | `DragInput`, `CardLocation` | `juice.transitions.answerPress`, `juice.glows.selectedAnswer` | Draw dragged run above the board, snap origin, and target hover feedback. |
| `move-feedback-render` | `MoveResult`, `InvalidMoveReason` | `juice.shake.incorrect`, `juice.particles.incorrect`, `audio.events.card.place-invalid` | Shake invalid targets and emit invalid particles. |
| `foundation-flourish-render` | `Foundation`, `MoveResult` | `juice.particles.correct`, `juice.glows.correctReveal`, `audio.events.foundation.complete` | Animate foundation pile completions and legal foundation drops. |
| `auto-complete-render` | `AutoCompleteState`, `MoveHistory` | `personalityTheme.motion.easing.feedback`, `audio.events.autocomplete.card` | Pace auto-complete card movement and show cancel affordance until win locks. |
| `win-confetti-render` | `WonFlag`, `ScoreCalc`, `Streak` | `juice.particles.correct`, `audio.events.round.complete`, `layout.slots.footer` | Emit win burst, streak pop, and result card entrance. |
| `scene-transition-render` | `GameState` | `juice.transitions.questionExit`, `personalityTheme.motion.easing.transition` | Fade or wipe between title, playing, won, and locked scenes. |
| `share-card-render` | `SharePayload`, `ScoreCalc` | `brand`, `palette`, `solitaire.cardBack.texture`, `copy`, `personalityTheme.typography` | Render share image/canvas for local share sheet or copied result. |

Render acceptance gates:

- Card text must remain legible at 320 CSS px width.
- Tableau stacks must not overlap the HUD in portrait.
- Stock/waste/foundation band must fit above tableau in portrait.
- Drag ghost must not resize layout.
- Auto-complete motion must be cancellable before the win state finalizes.
- Every positive card move gets visible feedback.
- Invalid moves get feedback without feeling punitive.

## 13. Daily Content Cron

There is no daily content cron for v1.

Solitaire is procedural plus pre-validated corpus selection.

No LLM worker runs every morning.

No RSS feed is read.

No editorial review queue exists.

No generated clue or question file is committed.

**Decision:** Phase 5 deploy should not wire a daily-bake cron.

**Why:** daily deal JSON can be generated as part of build or pre-generated for a rolling window during release prep. A cron would add operational surface without providing fresh editorial value.

**Tradeoff considered:** a nightly bake cron could keep a long future window populated automatically, but v1 can bake 30-90 days per publisher during deployment and revisit automation once multiple publishers are live.

Build-time bake:

- Input: content pack slug, date window, variant, SQLite corpus path, deal corpus version.
- Output: static JSON files in `public/daily/<packSlug>/<variant>/`.
- Window: at least 30 future days per publisher in v1.
- Past days may be retained for 7 days to allow late client clocks and simple history.

Failure behavior:

- If today's artifact is missing, boot shows `network-failure`.
- The app must not synthesize a random fallback daily.
- The app must not call the solver.
- The app must not silently pick another date.

## 14. Mobile + Responsive

Solitaire is layout-sensitive because 52 cards need space.

The responsive goal is not to preserve desktop proportions.

The goal is to keep every legal target readable and tappable.

Minimum supported viewport:

- 320 CSS px wide.
- 568 CSS px tall.
- Portrait-first mobile support.
- Landscape support for short phones and tablets.

Portrait layout:

- Header/HUD at top.
- Stock, waste, and foundations in a compact band below header.
- Tableau columns fill remaining height.
- Card overlap increases as height shrinks.
- Card aspect ratio remains poker-like, approximately 0.714 width-to-height.
- Tap targets for stock, waste, foundations, and tableau column tops remain at least 36 CSS px.

Landscape layout:

- Header compresses into a left or top masthead depending on pack composition.
- Stock/waste/foundations may sit left of tableau if height is constrained.
- Tableau uses wider horizontal spacing and reduced vertical overlap.
- The footer can collapse to an icon-only share/settings row.

Desktop layout:

- Center table with generous side margins.
- Drag interactions get hover targets.
- Keyboard shortcuts work:
  - `Space`: draw stock.
  - `Enter`: place selected card if legal.
  - `Escape`: cancel selection or close overlay.
  - Arrow keys: move focus between piles.

Touch behavior:

- Tap stock to draw.
- Tap waste/top tableau card to select.
- Tap destination to place.
- Double tap to auto-foundation.
- Long press can show legal destinations as a subtle glow.

Drag behavior:

- Drag starts after a small movement threshold.
- Dragging a face-up run moves the run as a single group.
- Candidate destinations glow when legal.
- Releasing on invalid destination returns the run to origin with a small shake.

Auto-complete on mobile:

- Prompt appears as a compact bottom sheet or footer action.
- Auto-complete should not cover tableau state.
- The player can cancel until the final foundation move completes.

**Decision:** portrait mobile prioritizes tap-to-place over free dragging.

**Why:** drag distance across seven narrow columns is error-prone on phones. Tap-to-place keeps the game comfortable without removing drag for players who prefer it.

**Tradeoff considered:** drag-only would feel more physical, but it would make the most common mobile interaction worse. Tap-first still preserves drag as a richer optional control.

## 15. Per-Pack Juice Variation

Per-pack juice is mandatory for the stranger-pair test.

Solitaire cannot rely on palette swaps.

Lake Nona and West Orange should differ in shape, motion, sound, table surface, card backs, pips, copy, and victory ceremony.

Existing exact render-personality hooks:

- `juice.particles.correct`
- `juice.particles.incorrect`
- `juice.particles.ambient`
- `juice.glows.selectedAnswer`
- `juice.glows.correctReveal`
- `juice.transitions.questionEnter`
- `juice.transitions.questionExit`
- `juice.transitions.answerHoverIn`
- `juice.transitions.answerPress`
- `juice.shake.incorrect`
- `personalityTheme.motion.durationMultiplier`
- `personalityTheme.motion.easing.entrance`
- `personalityTheme.motion.easing.exit`
- `personalityTheme.motion.easing.feedback`
- `personalityTheme.motion.easing.transition`
- `personalityTheme.motion.easing.ambient`
- `personalityTheme.shape.primitive`
- `personalityTheme.shape.cornerRadius`
- `personalityTheme.shape.strokeWidth`
- `layout.composition`
- `layout.background.kind`
- `layout.slots.header`
- `layout.slots.questionBlock`
- `layout.slots.answerGrid`
- `layout.slots.timerBar`
- `layout.slots.footer`

Existing exact audio-personality hooks:

- `audio.events.ui.hover`
- `audio.events.ui.press`
- `audio.events.round.complete`
- `audio.events.card.flip`
- `audio.events.card.pick-up`
- `audio.events.card.place-valid`
- `audio.events.card.place-invalid`
- `audio.events.card.stock-draw`
- `audio.events.card.stock-reset`
- `audio.events.foundation.complete`
- `audio.events.autocomplete.start`
- `audio.events.autocomplete.card`
- `audio.mix.master`
- `audio.mix.music`
- `audio.mix.sfx`

Lake Nona personality:

- Rounded card corners.
- Bright teal felt.
- Sunrise-gold selected glow.
- Faster flip cadence.
- Smooth `easeOutCubic` deal-in.
- Spark/bloom win particles.
- Light paper snap card audio.
- Friendly share copy.

West Orange personality:

- Sharper card corners.
- Deep green felt.
- Masthead-style header.
- Slower, weightier card movement.
- Curtain-wipe scene transition.
- Rectangular confetti and newsprint dust.
- Dryer table-tap audio.
- Classic newspaper copy.

Card move juice:

- Pick-up scales the run to 1.02 for Lake Nona and 1.01 for West Orange.
- Valid placement uses a short snap-to-slot tween.
- Invalid placement uses `juice.shake.incorrect`.
- Foundation completion emits `juice.particles.correct`.
- Auto-complete uses a controlled cadence from `personalityTheme.motion.durationMultiplier`.

Win ceremony:

- Lake Nona uses an upward sparkle bloom with a bright share-card entrance.
- West Orange uses a masthead reveal, restrained confetti, and a printed-result-card feel.

**Decision:** every pack must override at least one setting in each of these categories: layout, shape, motion, particles, audio, copy, and card-back art.

**Why:** this creates real publisher personality and prevents the common failure mode where two skins only differ by color.

**Tradeoff considered:** making only card backs and palette required would speed onboarding, but it would fail the LGS skin premise. The content pack can still start from defaults; launch packs need deeper variation.

## 16. Out of Scope for v1

The following are explicitly out of scope for v1:

- Multiplayer.
- Remote leaderboards.
- Local leaderboard screen.
- Account login.
- Cross-publisher tournaments.
- Sponsored challenge events.
- Undo.
- Hint system.
- Solver UI.
- Showing the stored solution to players.
- Draw-3 gameplay.
- Spider 1-suit gameplay.
- Spider 2-suit gameplay.
- Spider 4-suit gameplay.
- Vegas scoring.
- Three-card waste preview.
- Custom full 52-card face art per publisher.
- User-selectable deck themes.
- User-selectable difficulty.
- Replay after daily completion.
- Calendar archive browsing.
- Daily cron.
- Runtime deck API.
- Runtime solver.
- LLM content generation.
- Editable publisher dashboard.
- Save sync across devices.
- Ads or sponsor cards in the playfield.
- In-app purchase or monetization UI.

**Decision:** v1 is one daily, one variant, one guaranteed-solvable result per publisher per date.

**Why:** this keeps Phases 2-5 focused on the reusable solitaire foundation: deterministic static deal, headless rules, pack-driven cards/felt/audio, responsive layout, and two publisher skins.

**Tradeoff considered:** a larger v1 would create a fuller solitaire product, but it would blur the proof. The catalog needs a reliable card-stacking classic first; variant richness can follow through the extension hooks already specified.

## Acceptance Mirror

This GDD satisfies the issue acceptance gates as follows:

- `gdd.md` exists at repo root and contains all 16 required sections.
- Every design decision has a concrete recommendation and rationale.
- `star-spangled-solitaire` SQLite shape is documented in the Daily Picker section with table names, columns, serialized deck format, and the existing runtime picker behavior.
- Per-pack juice and audio slot lists name exact `@lgs/render-personality` and `@lgs/audio-personality` hooks.
- No code, scaffold, package manifest, app, package, Pixi import, or LFS routing is introduced.
- The branch is expected to remain `task/bd91f889-6275`.

## Phase Handoff Notes

Phase 2 should scaffold only the app shell and local types needed to compile against this GDD.

Phase 2 should not modify shared `@lgs/content-pack` unless its issue explicitly includes the schema extension.

Phase 3 should implement logic systems headlessly before any render imports land.

Phase 4 should render Lake Nona first.

Phase 5 should render West Orange and run a side-by-side stranger-pair review.

Phase 6 should inspect whether `solitaire` belongs in shared `@lgs/content-pack` or stays as a game-local extension until another card game needs it.

Phase 7 should generate audio per pack for the exact event keys listed here.

Phase 8-style follow-up should type the `solitaire` block in shared content-pack after the first two skins prove the field names.
