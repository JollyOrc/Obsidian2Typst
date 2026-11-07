<!-- Filed 2026-11-06 as #123 on the user's go (epic #121, ticket 2 of 16). -->

### User story

[US-030](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-030-entry-data-and-statblock.md), ACs addressed AC-1 to AC-7, AC-19 (the codes of this ticket), AC-20 to AC-22

### Description

Read every `o2t-entry` block as the data of the heading above it, never print it, report misplaced and malformed blocks, and hand the data to the statblock helper call `#o2t-statblock(…)`; write the block's contract once in `docs/technical/entry-block.md`. The drawing itself is #125.

### Acceptance criteria (from the user story)

The examples use one invented entry, `Fen Hare`, and a preset with these
`entries` settings (synthetic field names; the built-in defaults are empty):

```yaml
entries:
  statblock:
    stats: [{key: might, label: Might}, {key: wits, label: Wits}, {key: speed, label: Speed}]
    traits: [{key: move, label: Move}, {key: guard, label: Guard}]
    boxes: vigour
    track: [{label: Fine, icon: "Icons/fine.svg"}, {label: Hurt, icon: "Icons/hurt.svg"},
            {label: Down, icon: "Icons/down.svg"}, {label: Fading, icon: "Icons/fading.svg"},
            {label: Gone, icon: "Icons/gone.svg"}]
    trackKey: states
    trackLabel: STATE
    trackDefault: [Fine, Hurt, Down, Gone]
  tagLabels: {beast: Beast, magical: Magical}
```

and this compiled Markdown:

````markdown
### Fen Hare
```o2t-entry
vigour: 11
might: 4
wits: 2
speed: 5
attacks:
  - "Kick: 2d6"
  - "**Bite**: 1d6"
skills:
  - Quick Step
  - Keen Nose
tags:
  - beast
illustration: "![Drawn by A. Nobody](assets/hare.png)"
layout: auto
```
Fen hares are quick and shy. They live in reed beds and flee at the first sound.

#### Habits

They gather at dusk.
````

- **AC-1 (the block is data, never text):** A fenced code block whose info
  string is `o2t-entry` is not printed. Its YAML is the data of the nearest
  heading above it, at any level 1 to 6, when only blank lines lie between
  the heading and the block. Fences of any length (three or more backticks,
  or three or more tildes) are recognised, so a block whose content holds
  three backticks in a four-backtick fence is read whole. Example: the PDF
  text of the example contains `Fen Hare` and `Fen hares are quick` and none
  of `vigour:`, `o2t-entry`, `- "Kick: 2d6"`.

- **AC-2 (the contract is written once):** `docs/technical/entry-block.md`
  specifies the block for its writer, the Obsidian Vault Compiler
  (JollyOrc/ObsidianVaultCompiler#108): the info string, the fence rule,
  where it goes, the fixed YAML form (`yaml` 2.9.1, YAML 1.2,
  `stringify(value, {nullStr: ''})`), lowercase keys, every property except
  the writer's exclusion list, the illustration's alt text as its credit,
  and that link markup is flattened by the writer. It names this plugin as
  its reader (SCAR-040). The reader accepts any valid YAML 1.2 mapping, not
  only the fixed form.

- **AC-3 (invalid YAML):** YAML that does not parse, or a block that is not a
  mapping (a list, a single value), gives `ENTRY_YAML_INVALID "<heading>"`
  with the block's first line; the heading and body are then laid out as
  ordinary text (no statblock). Example: `vigour: [11` →
  `ENTRY_YAML_INVALID "Fen Hare" (line 2)`.

- **AC-4 (blocks in the wrong place):**
  - a block with text (not only blank lines) between it and the heading
    above, or with no heading above, gives `ENTRY_ORPHAN_BLOCK` with its
    line and is not printed;
  - a second block under the same heading gives `ENTRY_BLOCK_TWICE
    "<heading>"` with its line; the first block counts, the second is not
    printed;
  - a block inside a quote or callout (any depth) is not an entry block: it
    gives `ENTRY_BLOCK_IN_CONTAINER` with its line and is not printed (the
    writer never puts one there; SCAR-041).

- **AC-5 (values):** Keys are compared in lowercase. Unknown keys are ignored
  without a warning (the block carries every property). A key the preset
  uses whose value has the wrong shape gives `ENTRY_VALUE_NOT_TEXT
  "<heading>": <key>` and that value is left out:
  - a single value (stat, trait, box value): text or a number; `4` and `"4"`
    print the same;
  - a list (attacks, skills, tags, the track key): a list of text or numbers,
    or one text that is treated as a one-item list (decision 2:
    `states: Fine` is `[Fine]`; `none` is the one word that means no track).

  Example: `attacks: [{B: 2d6}]` (from `- B: 2d6` typed without quotes) →
  `ENTRY_VALUE_NOT_TEXT "Fen Hare": attacks`, no attack printed for it.
  `null` and empty values count as not set.

- **AC-6 (formatting in values):** `**bold**` and `*italic*` / `_italic_` in
  values are typeset (`**Bite**: 1d6` → `Bite` in bold). Link markup that
  reaches a value (`[[Quick Step]]`, `[[Skills/Keen Nose|Keen Nose]]`,
  `[Keen Nose](x.md)`) prints its display text as plain text, never as a
  link and without a page number (`Quick Step`, `Keen Nose`). All value text
  goes through the one escaping function (US-013): `#`, `$`, `<`, `@` and
  `\` in a value print as written.

- **AC-7 (the illustration value):** The value names one image as
  `![alt](path)` or `![[path|alt]]` (or a bare path). The alt text is the
  credit (`Drawn by A. Nobody`). In the wikilink form, an alias that is only
  digits, or digits `x` digits (`300`, `300x200`), is a size in Obsidian and
  not a credit. The image and its credit are used by US-031; this story only
  reads them. An image that is not found gives the existing missing-image
  warning (US-003) and counts as no illustration.

- **AC-19 (warnings):** Every code of this story is in
  `docs/technical/warning-codes.md` with its text and a source line (rule
  8), is given once per entry and compile, and does not stop an export or
  the preview. In strict mode each of them aborts the export, as every
  conversion warning does (US-006 AC-4; decision 4, revised): `ENTRY_YAML_INVALID`,
  `ENTRY_ORPHAN_BLOCK`, `ENTRY_BLOCK_TWICE`, `ENTRY_BLOCK_IN_CONTAINER`,
  `ENTRY_VALUE_NOT_TEXT`, `ENTRY_TRACK_UNKNOWN`, `ENTRY_NO_LEDE`,
  `ENTRY_LEDE_SHORT`, `STAT_BOXES_MANY`, `STAT_BOXES_NOT_NUMBER`,
  `TAG_UNMAPPED`, `STAT_SUM_MISMATCH`, `STAT_ATTACK_NO_DICE`,
  `ENTRY_IN_GLOSSARY`.
  Strict mode has no exception for them (decision 4, revised 2026-11-06).

- **AC-20 (entries at several levels and in a chain):** An `o2t-entry` block
  under a level-4 heading inside a level-3 entry is a second entry: the
  inner heading gets its own statblock, and the outer entry's body ends at
  the inner heading (with `#### Habits` in the example made an entry, the
  outer statblock has the example's data and the inner one its own). Entries
  in any chapter get the statblock; whether an entry also gets the chapter
  layout is US-031 and US-033 (`headingRules` rule `entries`).

- **AC-21 (with other stories' rules):** With `headingRules` mapping the
  entry's parent heading to `glossary` (US-017), a block under a term heading
  is not read as an entry (decision 3): it is not printed, the term stays as
  US-017 prints it, and the warning is `ENTRY_IN_GLOSSARY "<term>"` with the
  block's line. An HTML comment between two entries (the writer's
  repeat comment, `<!-- repeat of "Fen Hare" omitted -->`) is dropped
  (US-001 AC-15, with its one summary warning for dropped comments) and adds
  nothing to the entry above it. A preset with
  `page.breakBefore.h3: page` (US-025) breaks before each entry heading as
  today; US-031 states the entry layout's own breaks.

- **AC-22 (determinism, rule 7):** The same note, block and preset give the
  same Typst byte for byte, also when the block's keys come in another order
  or the YAML uses flow lists (`attacks: ["Kick: 2d6"]` and the block form
  give the same statblock).


### Implementation notes

- `src/core/markers/entries.ts` (new, beside `glossary.ts`): walks the parsed blocks; a `code` node whose `lang` is `o2t-entry` (markdown-it gives any fence length and tilde fences the same node) is an entry block when the block before it is a heading (blank lines don't make nodes); else `ENTRY_ORPHAN_BLOCK`; a second one under the same heading `ENTRY_BLOCK_TWICE`; a block found inside a `blockquote` or callout (any depth) `ENTRY_BLOCK_IN_CONTAINER`; under a glossary term (US-017's marker) `ENTRY_IN_GLOSSARY`. None of them is printed.
- YAML: `yaml` 2.9.1 `parse` (YAML 1.2); a non-mapping or a parse error → `ENTRY_YAML_INVALID` with the block's first line; keys lowercased; value shapes as AC-5 (`ENTRY_VALUE_NOT_TEXT`); one text for a list key → a one-item list.
- Formatting in values: the inline parser of US-001 for bold and italic; link markup reduced to its display text before escaping (`[[a|b]]` → `b`, `[[a]]` → `a`, `[t](u)` → `t`); all text through `typstString`/the escaping of US-013.
- The illustration value: `![alt](path)`, `![[path|alt]]` or a bare path; an alias of digits or digits `x` digits is a size, not a credit; the image resolved through the asset index as US-003 (missing → `ASSET_MISSING`).
- Emission: the heading as today, then `#o2t-statblock((…data…))` when the entry has at least one stat or attack in the settings' terms (#125 decides what is drawn; here the helper may draw nothing), then the body. Without `entries.*` settings the call is not written (US-030 AC-11's built-in case).
- Determinism (rule 7): the data dictionary is written in the settings' order, not the block's.
- `docs/technical/entry-block.md`: the contract of AC-2, naming its reader (this plugin) and its writer (JollyOrc/ObsidianVaultCompiler#108).
- `docs/technical/warning-codes.md`: rows for `ENTRY_YAML_INVALID`, `ENTRY_ORPHAN_BLOCK`, `ENTRY_BLOCK_TWICE`, `ENTRY_BLOCK_IN_CONTAINER`, `ENTRY_VALUE_NOT_TEXT`, `ENTRY_IN_GLOSSARY` (US-030).
- `PLUGIN_NAMES` gains `o2t-statblock` (its drawing is #125).

### Tests

- `tests/unit/us-030-entry-block.test.ts`: all, except `US-030 AC-19: a composed note gives each warning once, in order` (it needs #125's checks).
- `tests/support/entries.ts` (support, unchanged).
- Guards that must stay green: the US-001, US-013, US-014, US-017 and US-024 tests (parsing, escaping, glossary, the sample vault, whose `Book.md` holds no `o2t-entry` block).

### SCAR check

- SCAR-039 (in-band markers read by other steps): every step that reads `code` nodes is listed and checked against `o2t-entry`: the code emitter (US-001 AC-7), the page-break rules (US-025), image fit (US-028), the glossary marker (US-017), the line map (US-015). Only the entry reader consumes it; the others see no node.
- SCAR-040 (an output format names its reader): `entry-block.md` names this plugin as reader and the Vault Compiler as writer.
- SCAR-041 (line-start rules blind to containers): the container check walks quotes and callouts at any depth.
- SCAR-034 (input classified before its header is removed): the block is read before "first paragraph" is decided (#125 relies on it).
- SCAR-007, SCAR-002: the ACs' examples are the tests' inputs; composed cases AC-20, AC-21.
- SCAR-009, SCAR-010 (rules verified in isolation; join hazards): the heading, the call and the body join as three blocks; the tests compare whole outputs.
- SCAR-017: one function reduces link markup, used for every value.
- SCAR-024: `yaml` 2.9.1's behaviour is the measured one (spike A4).
- Not applicable: the UI SCARs (013, 014, 016, 022), 008, 021.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
