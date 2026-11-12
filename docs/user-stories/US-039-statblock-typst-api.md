# US-039 — The statblock as Typst for another plugin (`api.statblockTypst`)

**Status:** Code done 2026-11-12 (#165, #166, #167); desktop check M29 and release 0.15.0 open (G0 and G1 done 2026-11-11; D1 to D3 accepted by the author 2026-11-11)
**Introduced:** —
**Implemented:** —
**Supersedes:** —

Asked for by Game Card Creator (a sibling plugin that prints game cards as a
PDF, <https://github.com/JollyOrc/GameCardCreator>), whose creature card
shows this plugin's statblock. **The shape of the answer (the contract) is
written once, in the reader's story: Game Card Creator US-004 AC-3** (SCAR-040);
this story is the writer's side and points to it.

---

## Story

**As an** author who prints cards from the same notes as the book,
**I want** the plugin to hand its statblock, as the book draws it, to another
plugin as Typst,
**so that** a creature card shows the same statblock as the book without a
second copy of the preset's settings and the drawing code (SCAR-017).

### What reads the answer (SCAR-040)

- **Game Card Creator**, in the same Obsidian, through
  `app.plugins.plugins["obsidian2typst"].api`; it compiles the Typst with the
  same Typst (0.14.2, typst.ts 0.7.0) at a width of 54 mm. *Measured
  2026-11-11* with this plugin's own `o2t-sb-box`, model and emitter bundled
  read-only, invented creatures, no icon files, Libertinus instead of the
  preset's fonts: the helper compiles at 54 mm and is 36 mm (vigour 4, one
  attack) to 55 mm (vigour 35, four attacks, skills, traits) tall.
  *Not measured:* the icons in that compile; the preset's fonts in it; the new
  function in the real plugin.

### Today (inventory, SCAR-017, SCAR-027)

- The pure pieces exist: `statblockModel` (`core/entries/model.ts`),
  `statblockData(model, look, writer)`, `statblockLook(entries, colorMode)`,
  `ENTRY_MARKS_DEF`, `STATBLOCK_HELPER_DEF` (`core/emit/entry.ts`).
- Their users: the converter (`core/emit/blocks.ts`: `statblockData`,
  `statblockCall` with a writer made from `emitInline`; `core/convert/index.ts`:
  `statblockLook`, the helper definitions, the icon resolver `iconFile`); the
  encounter sheet (`core/entries/sheet.ts`: `statblockLook`,
  `ENTRY_MARKS_DEF`); the Obsidian preview and `api.renderStatblock`
  (`plugin/entries/processor.ts`, DOM, not Typst). **No existing function
  gives the Typst for one note's properties outside a conversion.**
- *Measured 2026-11-11:* the book's own value writer works standalone:
  `emitInline(flattenLinks(parseInline(v, 1)), new EmitContext(), {atBlockStart:
  true, breaks: 'space'})` gives `**Bite**: 1d6` → `*Bite*: 1d6`, `Quick *Step*`
  → `Quick _Step_`, `[[Fen Hare|hare]] and [x](y.md)` → `hare and x`,
  `a#b $c * _ @` escaped, `= x` → `\= x`, `- x` → `\- x`; `<x>` is dropped with
  the warning `HTML_UNSUPPORTED` (as in the book).
- The fonts: `compileFonts(bundled, vault)` (`plugin/compile-fonts.ts`) is the
  list the export and the preview give the compiler.
- `api.version` is 1 and stays 1; `renderDetails` was added the same way.

## Acceptance criteria (draft)

- **AC-1 (the answer).** `api.statblockTypst(data, options)` for the manual's
  Fen Hare note (`vigour: 11`, `might: 4`, `wits: 2`, `speed: 5`, attacks
  `Kick: 2d6` and `**Bite**: 1d6`, skills `Quick Step`, tags `beast`) under a
  preset of the manual's shape returns `{ok: true, prelude, data, files,
  credit, warnings}` as the contract (Game Card Creator US-004 AC-3) says.
  `data` is exactly the text the PDF export writes for the same note's
  statblock (same model, same look, same writer); `prelude` is
  `ENTRY_MARKS_DEF` and `STATBLOCK_HELPER_DEF` joined by a line break and
  contains no content of the note.
- **AC-2 (values as the book writes them).** The measured cases above, in the
  statblock's values: `**Bite**: 1d6` → `*Bite*: 1d6`; a link as its text; the
  specials escaped; `= x` and `- x` escaped at the start; `<x>` dropped with
  `HTML_UNSUPPORTED` in `warnings`.
- **AC-3 (icons).** The icons of the cells the statblock draws (the entry's
  own `trackKey` cells, else `trackDefault`) are read from the vault, each vault
  path once. For each icon file that exists one entry `{path, bytes}`: `path`
  is `o2t-icons/<n>.svg`, `n` counting from 1 in the order of first use (the
  same vault path is one entry; no two entries share a path, whatever the
  vault names are), `bytes` are the file's bytes unchanged, and `data` names
  the path in the cell (`icon: "o2t-icons/1.svg"`). Fen Hare under the
  example preset (cells Fine, Hurt, Down, Gone): four entries, `o2t-icons/1.svg`
  to `4.svg`. A cell with its own `states: [Fine, Gone]`: two entries. A
  missing icon: `icon: none` in its cell (`(label: "Hurt", icon: none)`) and the
  warning `STATBLOCK_ICON_MISSING` naming the vault path (D2).
- **AC-4 (credit).** The preset's `encounterSheetText.credit`, or `null`.
- **AC-5 (nothing to draw).** No active preset, no `entries.statblock.stats`
  in it: `{ok: false, reason: 'no-settings', message}` with the text of the
  preview's notice (`NO_SETTINGS`); no stat and no attack in the data:
  `reason: 'no-statblock'` with `NO_STATS`; no Typst in either answer.
- **AC-6 (data checks).** The model's checks (`STAT_SUM_MISMATCH`,
  `STAT_BOXES_MANY`, `TAG_UNMAPPED`, ...) come back in `warnings` as the book
  reports them (code, message), once each.
- **AC-7 (fonts).** `api.compileFonts()` returns the font files the export
  gives the compiler (the bundled ones first, then the vault's, one call).
- **AC-8 (the active preset, read each time; SCAR-016, SCAR-022).** A change
  of the active preset between two calls changes the answer (settings are read
  once per call); icons are read once per path until `clearIconCache()` (the
  call the plugin makes when the preset changes, with the preview's); fonts are
  read at every `compileFonts()` call. A dependency that fails (a thrown error)
  gives `{ok: false, reason: 'error', message}`, never a throw or a half
  answer.
- **AC-9 (deterministic).** The same data and preset give the same answer
  byte for byte, in two fresh processes.
- **AC-10 (composed).** `renderStatblock` and the export are unchanged (their
  tests pass as they are); `api.version` stays 1; the manual's API section
  documents both functions with the example.
- **AC-11 (the reader compiles it).** A test compiles `prelude` + `data` at
  54 mm with the pinned Typst and finds the statblock's parts (band, boxes,
  attributes, attacks, skills, tags) in the PDF text, for the Fen Hare example
  and for a creature with 35 boxes.

## Open decisions (for the author)

- **D1** (accepted) the function name and the answer's shape are those of the
  contract in Game Card Creator US-004 AC-3 (`statblockTypst`, `compileFonts`).
- **D2** (accepted) one new warning code `STATBLOCK_ICON_MISSING` for the answer, or the
  book's image warning.
- **D3** (accepted) release as 0.15.0 (a new function: a minor version).

## Interface used by the tests (G1)

`createStatblockTypstApi(deps)` in `src/plugin/entries/typst-api.ts`, with
`deps.settings()` (the preview's), `deps.readIconBytes(path)` (bytes or null)
and `deps.fonts()`; it returns `{statblockTypst, compileFonts, clearIconCache}`.
`composeApi(entries, details, typst?)` takes the third part as an optional
argument (the US-038 test, which passes two, stays as it is); `main.ts` passes
`createStatblockTypstApi(this.typstDeps)`. The pure pieces (`statblockModel`,
`statblockData`, `statblockLook`, the definitions) are used as they are. A
standalone call does not need `flattenLinks` (measured with a reference
implementation: the output is the same without it).

## Not covered

Drawing in Obsidian (unchanged), the entries chapter layout, the encounter
sheet, the picture of an entry.
