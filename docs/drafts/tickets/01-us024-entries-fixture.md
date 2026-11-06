<!-- Filed 2026-11-06 as #122 (labels `ticket`, `US-024`) on the user's go. Title: "US-024: the generated entries chapter (fixture for #121)" -->

### User story

[US-024](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-024-synthetic-public-fixture.md) (amendment for epic #121), ACs addressed AC-13 to AC-19

### Description

The sample-vault generator also writes a synthetic catalogue chapter (`Menagerie.md`), its preset (`presets/Entries.md`), five icon shapes and six entry illustrations, and the manifest's `entries` facts, so that every story of #121 tests against public, generated data. `Book.md`, `Other.md` and `presets/Sample.md` stay byte for byte as they are.

### Acceptance criteria (from the user story)

- **AC-13 (new files):** `npm run fixtures` also writes, from the same seed
  and with the same determinism (AC-1, AC-1b):
  - `Menagerie.md`: the entries note (AC-14), written directly in the
    compiled form the Vault Compiler produces — headings with their
    `o2t-entry` blocks — with no separate entry notes (decision 2; the
    plugin reads only this form, G0-C14);
  - `presets/Entries.md`: a preset with `headingRules: {Menagerie: entries,
    Relics: entries}` and the `entries` settings of US-030's examples (stats
    `might`, `wits`, `speed`; traits `move`, `guard`; `boxes: vigour`; track
    Fine, Hurt, Down, Fading, Gone; `trackKey: states`; `trackLabel: STATE`;
    `trackDefault` without Fading; `tagLabels` for `beast` and `magical`;
    `sum: {total: vigour, of: [might, wits, speed]}`; `quickReference`,
    `encounterSheet`, `encounterSheetFile` on), A5, facing pages;
  - `assets/icons/fine.svg` … `gone.svg`: five simple shapes (circle,
    square, triangle, cross, bar), `fill="#000"`, under 400 bytes each; no
    third-party icon;
  - illustrations as solid-fill PNGs of fixed pixel sizes:
    `entry-wide.png` 1280 × 1006, `entry-tall.png` 358 × 736,
    `entry-square.png` 600 × 600, `entry-small.png` 272 × 334 (low
    resolution, US-034), `entry-long.png` 2000 × 500 (4:1) and
    `entry-slim.png` 300 × 1200 (1:4). The `entry-` prefix keeps them apart
    from the in-memory `Sample/assets/wide.png` and `tall.png` of
    `tests/support/book.ts`.

  `Book.md`, `Other.md`, their assets and `presets/Sample.md` are written
  byte for byte as today (AC-1b's check proves it).

- **AC-14 (what `Menagerie.md` holds):** Invented words only, from the
  generator's word list (AC-2), with every entry's `o2t-entry` block written
  in the fixed YAML form (US-030 AC-2: `yaml` `stringify` with
  `{nullStr: ''}`). The cases each story needs:

  | Case | Story |
  |---|---|
  | `# Menagerie` with an intro; sections `## Beasts`, `## Horrors`, `## Spirits`, each with an intro | US-031 AC-1, US-033 AC-1/2 |
  | 14 or more entries at level 3, covering all seven layouts and `auto` | US-031 AC-6/9, US-032 AC-2 |
  | each illustration ratio of AC-13 at least once; an entry using `entry-small.png` | US-031 AC-7, US-034 AC-3 |
  | text lengths just under and just over one page and two pages | US-032 AC-4/5 |
  | an explicit `page-text` entry that overflows, as the first of a pair | US-032 AC-7 |
  | an unpaired page entry at a section's end; a section ending on a right page | US-031 AC-10, US-033 AC-3 |
  | a section intro longer than one page | US-033 AC-4 |
  | box values 0, 11, 16, 45, 46 and `varies` | US-030 AC-12 |
  | `states`: missing, `none`, the default plus `Fading`, one unknown label, one word (`states: Fine`) | US-030 AC-5/13 |
  | tags: mapped, unmapped (`rare`) | US-030 AC-14 |
  | an attack without dice, an attack without `: `, a bold attack name, a long attack name | US-030 AC-10/17/18 |
  | a value with left-over link markup; a hand-typed map value (`- B: 2d6` written unquoted) | US-030 AC-5/6 |
  | a block whose content holds three backticks, in a four-backtick fence | US-030 AC-1 |
  | invalid YAML; a block not under a heading; a second block under a heading | US-030 AC-3/4 |
  | an entry that starts with a list (no lede); one with a lede under 10 words | US-030 AC-16 |
  | a nested entry (level 4 inside an entry), once with an explicit layout | US-030 AC-20, US-031 AC-1 |
  | a block inside a callout | US-030 AC-4 |
  | a list of 10 and one of 11 items; an entry with two `####` sub-headings | US-031 AC-11/12 |
  | a sum mismatch | US-030 AC-18 |
  | the writer's repeat comment between two entries, and one entry heading repeated | US-030 AC-21, US-033 AC-11 |
  | a second entries chapter `# Relics` with two entries | US-033 AC-14 |
  | `# Example Crypt` (no rule) holding a copy of one entry | US-031 AC-2 |
  | a `# Glossary` with one term holding an `o2t-entry` block | US-030 AC-21 |
  | links to entries from the body, at levels 1 to 6 | US-033 AC-8 |
  | one narrow-column paragraph known to gap, fixed as data (decision 1): chosen at G2 by compiling candidates; a US-034 test fails if it stops gapping | US-034 AC-7 |

- **AC-15 (manifest):** `manifest.json` gains `entries`, counted while
  writing (AC-3): per entry its heading text, level, chapter, section, line,
  `layout` value, illustration file with its pixel size, box value, track
  value, tags, and the case names of AC-14 it was written for; per chapter
  its sections and entry count; the icon files. Tests read their expected
  values from here, never from the plugin's own functions. Example: the
  test of US-030 AC-12's `46` row finds the entry by
  `manifest.entries.byCase["boxes-46"]`.

- **AC-16 (the local word list, G0-C13):** The forbidden-word check (AC-10)
  also reads `tests/fixtures/private-words.local.txt` (decision 3: inside
  the repository, git-ignored) when the file exists:
  one word per line, made by the author from the private vault (creature
  names, place names); every published file is checked against it, case
  insensitive, whole words. The file is in `.gitignore`; without it, that
  part of the check is skipped with an explicit `it.skipIf` and a comment
  naming this AC (the public copy has no list, AC-11). A planted word in a
  temporary copy is found (guard, SCAR-023).

- **AC-17 (manual checks):** `npm run install:scratch` (AC-8) also installs
  `Menagerie.md`, `presets/Entries.md` and the new assets, with the same
  backup and checksum rules.

- **AC-18 (no real data, SCAR-035):** No name, number or sentence of the
  author's book is in the generator or its output; the AC-16 check over
  `tests/fixtures/` proves it where the local list exists.

- **AC-19 (tests of the amendment):** AC-1b's comparison covers the new
  files; a test asserts that `Book.md`'s SHA-256 equals the value before the
  amendment; a test counts the AC-14 cases in the manifest (every row of the
  table has at least one entry); the YAML of every block parses with
  `yaml` 2.9.1 and re-serialises to the same text (US-030 AC-22).

Decisions of the amendment (2026-11-06): (1) one gap paragraph, fixed as data, chosen by compiling candidates; a US-034 test fails if it stops gapping; (2) `Menagerie.md` is written in the compiled form only; (3) the word list is `tests/fixtures/private-words.local.txt`, in `.gitignore`.

### Implementation notes

- `tests/fixtures/generate.ts`: a new `writeMenagerie(random)` with **its own** seeded stream (`seeded(SEED + 121)`), called after everything `Book.md` needs, so the existing stream and therefore `Book.md` are untouched (AC-19's hash test). It writes the headings, intros and entries of AC-14's table from the generator's word list; each `o2t-entry` block is `yaml` 2.9.1 `stringify(data, {nullStr: ''})` in a fence one backtick longer than the longest run inside (three at least); the cases `yaml-invalid`, `value-map` and `fence-four` write their text by hand.
- The manifest's `entries` (`list`, `byCase`, `chapters`, `icons`) is counted while writing (AC-3: no plugin function is called). Case names are the keys of `CASES` in `tests/tooling/us-024-entries.test.ts`.
- Icons: five SVG strings (circle, square, triangle, cross, bar), `fill="#000"`, under 400 bytes. Illustrations: the existing `png(w, h)` writer at the fixed sizes, names `entry-*.png` (the `entry-` prefix keeps them apart from `tests/support/book.ts`'s in-memory `wide.png`, `tall.png`).
- `presets/Entries.md`: the preset of AC-13, written as YAML frontmatter with `schemaVersion: 1`.
- The gap paragraph (decision 1): a one-off script in `spikes/` (git-ignored) compiles candidate paragraphs in a 45 % column and picks one whose widest gap is over 200 %; its words go into the generator as fixed data, with a comment naming the script's run. The US-034 test that guards it is written with US-034's ticket.
- `.gitignore`: `tests/fixtures/private-words.local.txt`; `tests/tooling/us-024-public.test.ts`'s `EXCLUDED` gains it (AC-11's list).
- Run `npm run fixtures` and commit the regenerated vault (AC-1b: the committed vault is what the generator writes).

### Tests

- `tests/tooling/us-024-entries.test.ts` (all, AC-13 to AC-19)
- Guards that must stay green: `tests/tooling/us-024-generator.test.ts` (AC-1, AC-1b), `tests/tooling/us-024-public.test.ts` (AC-4, AC-5, AC-10, AC-11), `tests/tooling/us-024-install-sample.test.ts` (AC-8), `tests/unit/us-024-census.test.ts` (the census of `Book.md`), and every test that reads the sample vault (the full `npm test` and `npm run test:integration`).

### SCAR check

- SCAR-018 (test tooling with proven undo): the generator overwrites `tests/fixtures/sample/`; before the run, a SHA-256 list of the folder; after, `Book.md`, `Other.md`, `presets/Sample.md` and every existing asset compared (AC-19 automates the three notes).
- SCAR-035 (real data as test data): invented words only; the local word list check (AC-16) runs on the author's machine before the commit, and its result is noted in the G4 entry.
- SCAR-011 (generated names clash with natural names): `entry-*` asset names; the note `Menagerie.md` and the preset `Entries.md` are new names in the vault (checked against `listFiles`).
- SCAR-027 (replacement specified from the replaced thing): the fixture's users were listed at G1 (the generator test's `toContain`, the asset-mapping tests, the manual checks' "73 files"); none asserts an exact file list.
- SCAR-015, SCAR-023: the tests read content (sizes, YAML round trip, the manifest's lines) and the hash guard is green before the change.
- SCAR-017: one writer for the manifest's facts; `byCase` and `list` are derived from the same records.
- SCAR-024: the YAML form is the measured one (`yaml` 2.9.1, `nullStr: ''`).
- SCAR-030: the generator's run time is measured before and after (it runs in `npm test` through AC-1b).
- Not applicable: SCAR-013, 014, 016, 022 (no UI); SCAR-008, 021 (no drawing, no self-referential output).

### Definition of done

- [ ] All listed tests pass.
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`), with the planned reds of #121 unchanged (none newly red).
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`, with the local word-list result.
