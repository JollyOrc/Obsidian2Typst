# TICKET-063 — Which line is a heading or holds images (`lineContext`)

**Status:** Done (2026-10-22, with the amendment of the same day)
**User story:** [US-022](../user-stories/US-022-heading-and-image-menus.md)
**ACs addressed:** AC-1, AC-3 (the line, in the core)
**Depends on:** —
**SCARs:** SCAR-001, SCAR-002, SCAR-009, SCAR-017, SCAR-018, SCAR-019

---

## Description

A pure function that tells, for one line of a note, whether it is a heading
US-017 can match (and its visible text) and which vault images it holds.

---

## Acceptance criteria (from user story)

- **AC-1:** a top-level heading, not empty, not inside an open glossary
  section; its visible text (images left out); none for a paragraph, a
  callout heading, a term, a heading inside an open section.
- **AC-3:** the line's images of a supported type found by the asset
  resolver, as vault paths, in the order of the line; none for remote,
  unsupported or missing ones.

---

## Implementation notes

- New `src/core/convert/line-context.ts` (`convert` may use parse, markers and
  assets; no upward import): `lineContext(source, line, notePath, files)` —
  `parse`, `indexHeadings(root, {dropImages: true})`, `findGlossary` with
  `headingRuleTable()` (built-in rules), the heading whose line is `line +
  1` among the top-level blocks and not a term or in-term role and not inside
  a section that is open at that line; the images: the inline image and embed
  nodes of the blocks on that line, through `createAssetResolver` (its
  `uses()` give the vault path of each found image).
- The section check needs the open sections, which `GlossaryPlan` does not
  list today: a small exported helper in `markers/glossary.ts` (the section
  of a top-level block, or null), reported; `findGlossary` stays the only
  place that decides sections (SCAR-017).

---

## Tests

- `tests/unit/us-022-preset-edits.test.ts`: the `AC-1` and `AC-3` line tests.
- Mutation checks (SCAR-018): callouts counted; terms counted; the open
  section ignored; images out of order; remote images counted; the file name
  instead of the vault path.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1) new call sites: `indexHeadings`, `findGlossary`,
  `visibleText`, `createAssetResolver`; their transforms read (`dropImages`;
  the resolver's lookup and destinations — the vault path taken from
  `uses()`); (2) fit; (3) no flag; (4) edge: `<assets/the map.png>`, an
  embed by file name, `*A–Z*` in a heading.
- **SCAR-002** (1–3) composed: a heading in a callout, a term, a heading
  after a closed section; (4) checked against US-003 and US-017; (5) n/a.
- **SCAR-003** (1) tests red; (2) AC list again; (3) table.
- **SCAR-006** (1–4) gate, no skip, counts, tracked.
- **SCAR-007** (1) the lines of the test note are numbered; (2–3) yes.
- **SCAR-008** n/a (no third-party API).
- **SCAR-009** (1) headings and images at the start, middle and end of the
  note, two images on one line; (2–4) n/a.
- **SCAR-010, SCAR-011, SCAR-012, SCAR-013, SCAR-014, SCAR-015, SCAR-016** n/a.
- **SCAR-017** (1) grep before coding: who decides glossary sections
  (`findGlossary` only); (2–3) the helper keeps one decider; (4–7) n/a.
- **SCAR-018** (1–7) backups of `line-context.ts`, `glossary.ts`, checksums,
  checked restores, one match, arrays, baseline, survivors read first.
- **SCAR-019** (1) heading levels 1 and 2, sections open and closed;
  (2–4) n/a.

---

## Definition of done

- [x] Tests named above green; the US-017 tests green
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)

---

## Result (2026-10-22)

Changed: new `src/core/convert/line-context.ts` (`LineContext`,
`lineContext(source, line, notePath, files, rules = {})`);
`src/core/markers/glossary.ts` (`GlossaryPlan.inSection`: every top-level
heading inside a section, terms included, decided in `findGlossary` only,
SCAR-017); `src/core/emit/image.ts` (new exported `imageRequest(node)`: the
request the emitter makes, or why there is none — remote or unsupported;
`emitImage` calls it) and `src/core/emit/index.ts` (export). Register rows
"Heading slug", "Asset resolver", "Image emitter", "Glossary plan" name the
new call sites.

- Gate (scratchpad `gate063.log`): typecheck, build (`main.js` sha256
  `12e5bac85b36…`), lint green; `npm test` 1727 passed, 14 failed, 1 todo;
  integration 370 passed, 1 skipped. All 14 red tests are TICKET-064's
  (`tests/plugin/us-022-menus-write.test.ts`). The US-003 and US-017 tests
  green.
- AC → tests: AC-1 (top-level headings with visible text; a paragraph, a
  callout heading, a term, a heading inside an open section give none; a
  deeper heading before the first term; the preset's rules), AC-3 (images in
  the order of the line as vault paths; remote, unsupported, missing and
  invalid give none) — green.
- Changes against the plan (reported):
  - The plan exported `isRemote` and `decode` from `references.ts`. Instead,
    `imageRequest` in `emit/image.ts` is the one decision which image node is
    a vault file, so `lineContext` asks exactly what the emitter asks.
    `references.ts` is unchanged.
  - `lineContext` takes the active preset's heading rules (`rules`, default
    none = the built-in mapping), so a section that a preset defines counts.
    The ticket's signature had no rules; test added (SCAR-019: none, a preset
    `none` switching the built-in rule off, a preset `glossary`).
  - `inSection` holds headings only: non-heading blocks had no reader, and a
    term is in it too, so `lineContext` needs no separate `roles` check (the
    mutation run showed that check was redundant).
- Tests added while coding: the preset rules (above); a `### Notes` heading
  inside an open section before its first term; an image whose bytes are not
  its type (`broken.png`) on the line of refused images.
- Mutants (scratchpad `mut063/run.py`; US-022, US-017, US-003 unit tests;
  baseline 0 failed, 133 passed): 11; 9 caught — callouts counted; the open
  section ignored; only terms left out; the preset rules ignored; the line
  off by one; images out of order; remote images counted (in
  `imageRequest`); the file name instead of the vault path; section headings
  not marked. 2 survive as equivalent mutants (SCAR-018 item 7, read as
  inputs that cannot reach the rule): asking the resolver for refused
  images, and counting an `invalid` result. The resolver itself gives
  `invalid` for `a.pdf` and `broken.png` and `missing` for a remote address
  (probe scratchpad `p063/probe.test.ts`), and an `invalid` result has no
  path. Both guards stay: the first is required by the type of
  `imageRequest`, the second by the result's type. Backups by full path,
  `shasum -a 256 -c` after every restore and at the end: three files OK.
- SCAR-017 greps: `findGlossary(` — `convert/index.ts` and `line-context.ts`,
  both with `headingRuleTable(<the preset's rules>)`; `imageRequest(` —
  `emitImage` and `lineContext`. Found and not changed (existed before the
  ticket, out of scope): private copies of `decode` in `parse/links.ts`,
  `emit/image.ts`, `convert/references.ts`, `convert/cover.ts`, and of
  `isRemote` in `emit/image.ts`, `convert/references.ts`, `cover/find.ts`.

---

## Amendment (2026-10-22): the file list instead of file heads

**Why:** Obsidian's `editor-menu` callback is synchronous
(`obsidian.d.ts:11092`) and the plugin reads bytes only with
`vault.readBinary` (async). The menu therefore has the vault's file list,
not the files' first bytes (US-022 AC-3, AC-9, AC-10 amended; the user's
"go for it", 2026-10-22). The byte check moves to the action (TICKET-064).

**ACs addressed:** AC-3 (amended: found in the file list by the resolver's
lookup, without reading the file; a file whose bytes are not its type is
listed), AC-10 (amended: one lookup, the resolver's own).

### Implementation notes

- `src/core/assets/index.ts`: `AssetResolverOptions` gains `checkBytes?:
  boolean` (default `true`). With `false`, `check(path)` is not called: a
  path in `files` is `found` (or `ambiguous`), whatever its head; `missing`
  stays as it is. Every current caller passes nothing, so its behaviour is
  unchanged (the US-003 and US-015 tests are the proof).
- `src/core/convert/line-context.ts`: `lineContext(source, line, notePath,
  paths: readonly string[], rules = {})`; the resolver is built over
  `paths` with empty heads and `checkBytes: false`. The doc comment says that
  invalid images are listed.
- Register row "Asset resolver": the option, its default, and its one caller
  (`lineContext`).

### Tests

- `tests/unit/us-022-preset-edits.test.ts`: the line tests (file list), the
  line-13 test (`The Rules/broken.png` listed), the resolver test (option
  off, default, on).
- Mutation checks (SCAR-018), on top of the first run: the option ignored
  (bytes checked anyway); the option inverted (default off); `missing`
  turned into `found` when the check is off; `lineContext` without the
  option. The first run's mutants are run again.

### SCAR check of the amendment (2026-10-22, item by item)

- **SCAR-001** (1) the resolver's transforms are listed in its register row;
  the new mode is added there; (2) read for the new call site: the lookup
  (exact path for images, file name for embeds, own folder first) fits, the
  byte check does not, so (3) it is switched off by an option rather than a
  copy of the lookup; (4) edge input: a `.png` holding text, a name in two
  folders (ambiguous) unchanged.
- **SCAR-002** (1–5) composed: two images on one line, an angle-bracket
  path with a blank, an image inside a sentence (the existing line tests);
  checked against US-003 (the resolver's callers unchanged) and US-015 (the
  first pass passes no option).
- **SCAR-003** (1) red tests exist (G2); (2) the AC list read again: AC-3,
  AC-10; (3) the AC → test table is in `docs/technical/tests.md`.
- **SCAR-006** (1–4) full gate before Done, no skip, counts in the result,
  TICKET-064's red tests tracked in the map.
- **SCAR-007** (1–3) the tests give exact statuses and paths.
- **SCAR-008** (1) the callback type read (`obsidian.d.ts:11092`); (2–3) the
  core is tested by program; (4–7) n/a (no canvas, no layout).
- **SCAR-009** (1–4) n/a: no generated text.
- **SCAR-010** (1–6) n/a: no concatenated output.
- **SCAR-011** (1–5) n/a: `uses()` destinations unchanged; no new names.
- **SCAR-012** (1–5) n/a here (TICKET-065).
- **SCAR-013** (1–6) n/a: no dialog.
- **SCAR-014** (1–6) n/a here: the refusal is TICKET-064's.
- **SCAR-015** (1–5) n/a: no output content.
- **SCAR-016** (1–8) the line context is computed when the menu opens; that
  it is not trusted at the click is TICKET-064's.
- **SCAR-017** (1) grep `createAssetResolver(`: `convert/index.ts`,
  `line-context.ts` — only the latter passes the option; (2–3) one lookup;
  (4–7) n/a.
- **SCAR-018** (1–7) backups of `assets/index.ts`, `line-context.ts` by full
  path with checksums, checked restores, one match per edit, the baseline in
  the same run, survivors read first.
- **SCAR-019** (1) the option at off, default and on.

### Definition of done (amendment)

- [x] The amended tests green; US-003, US-015, US-017 green
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Register row "Asset resolver" names `checkBytes`

### Result of the amendment (2026-10-22)

Changed: `src/core/assets/index.ts` (`AssetResolverOptions.checkBytes`,
default true; off, `check(path)` is true without `sniffImage`; the doc
comments); `src/core/convert/line-context.ts` (`paths: readonly string[]`;
the resolver over empty heads with `checkBytes: false`; the doc comments).
Register row "Asset resolver" names the option and its caller.

- Gate (scratchpad `gate063b.log`): typecheck, build (`main.js` sha256
  `461c4dd424f6…`), lint green; `npm test` 1728 passed, 22 failed, 1 todo;
  integration 370 passed, 1 skipped. All 22 red tests are TICKET-064's
  (`tests/plugin/us-022-menus-write.test.ts`). US-003, US-015, US-017 green:
  the two callers that pass no option behave as before.
- AC → tests: AC-3 (the line tests over the file list; `broken.png` listed),
  AC-10 (the resolver test at off, default, on) — green.
- Mutants (scratchpad `mut063b/run.py`; US-022, US-017, US-003 images and
  resolver unit tests; baseline 0 failed, 164 passed): 15 — the 11 of the
  first run and 4 new (the option ignored; the default off; the check
  inverted; `lineContext` without the option). 14 caught. `refused images
  asked`, equivalent in the first run, is now caught (without the byte
  check the resolver finds `a.pdf`, so `imageRequest`'s refusal is the only
  guard). 1 survives as equivalent: `invalid counted` — with `checkBytes:
  false` the resolver never answers `invalid`. Backups by full path,
  `shasum -a 256 -c` after every restore and at the end: four files OK.
- SCAR-017 grep: `createAssetResolver(` — `convert/index.ts` (no option),
  `line-context.ts` (`checkBytes: false`); no other caller.
