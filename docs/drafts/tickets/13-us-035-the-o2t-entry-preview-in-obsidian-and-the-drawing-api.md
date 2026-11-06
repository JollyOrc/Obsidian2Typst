<!-- Filed 2026-11-06 as #134 on the user's go (epic #121, ticket 13 of 16). -->

### User story

[US-035](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-035-entry-block-preview-in-obsidian.md), ACs addressed AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11

### Description

Register a code-block processor for `o2t-entry` that draws the statblock in reading view and live preview from the active preset (through the shared model of #125), shows notices instead of a statblock where needed, re-renders on a preset change, and expose the drawing as a versioned API for the author's vault views.

### Acceptance criteria (from the user story)

Examples use US-030's preset and `Fen Hare` block, with that preset active
(US-021).

- **AC-1 (the processor):** The plugin registers a code-block processor for
  the language `o2t-entry`. In reading view and live preview (when the cursor
  is outside the block), the block is replaced by an HTML statblock: the
  parts and order of US-030 AC-10 (title band, box row, state track,
  attributes, traits, attacks, skills, tags), from the block's YAML and the
  **active preset's** effective `entries.*` (the preset `pickActive` names,
  as every other part of the plugin; then Defaults, then built-in; US-008
  AC-1). The band shows the nearest heading above the block
  in the note (as US-030 AC-1), or the note's file name without `.md` when
  there is none (decision 3: a single note `Fen Hare.md` with the block at
  its top shows `◆ Fen Hare ◆`). Example: the
  `Fen Hare` block shows `◆ Fen Hare ◆`, 11 boxes in one row, four cells
  `Fine Hurt Down Gone` (as icons with these labels as `aria-label`),
  `Might 4 · Wits 2 · Speed 5`, two attacks, `Skills: Quick Step, Keen Nose`,
  `Beast`.

- **AC-2 (the same rules as the PDF, SCAR-017):** What is shown, left out or
  warned follows the same pure functions as US-030's emitter, in `src/core`
  (part order, box counts and limits, track selection, tag mapping, value
  shapes, link text, bold and italic). A test runs the same data sets
  through both and compares the parts list, so the PDF and the preview can't
  drift. Differences, by design:
  - a missing value is shown as `—` (US-030 leaves the part out);
  - an attack without dice is highlighted (class `o2t-sb-nodice`);
  - the warnings of US-030 are shown as a small notice line under the
    statblock (`STAT_BOXES_MANY: 46`), not in the warnings note.

- **AC-3 (look):** Colours, frame, rules and fonts come from the preset
  (`entries.statblock.*`, `colorMode`) as CSS custom properties set on the
  statblock's element; sizes follow the preset's pt values scaled to the
  editor's font size (1 pt = 1/10.5 of the body text size). The icons are the
  preset's SVG files, read through the vault adapter, recoloured as US-030
  AC-13 does, at 75 % opacity. A missing icon leaves its cell empty. The
  plugin's `styles.css` holds the layout rules (class prefix `o2t-sb-`); no
  network request is made.

- **AC-4 (no preset, empty settings):** With no valid active preset, or one
  whose `entries.statblock.stats` and `attacks` produce no statblock (US-030
  AC-11), the block stays a plain code block with one notice line above it:
  `No statblock: the active preset has no entries settings.` or
  `No statblock: no stats or attacks.`

- **AC-5 (invalid YAML):** YAML that does not parse or is not a mapping shows
  the raw block and a notice `ENTRY_YAML_INVALID (line N)`; it is never
  hidden.

- **AC-6 (tracks are drawn, not interactive, D55):** Boxes and cells are
  drawn as in the PDF; clicking them does nothing (no handler, no cursor
  change). Interactive tracks belong to the author's note preview and
  encounter tracker (vault content), which draw with this plugin's code
  through the API of AC-11 and add their own clicks (decision 1).

- **AC-7 (when it draws; SCAR-016, SCAR-022):** The handler is async. Each
  time it runs it reads, at that moment: the block source (argument), the
  heading above (from `ctx`'s section info or the note's metadata cache), the
  active preset's effective settings (the preset store, which may read the
  preset note from the vault), and the icon files (vault adapter). Nothing is
  taken from a snapshot made at load. When the active preset changes, or the
  active preset's note is saved, open reading views that hold an `o2t-entry`
  block are re-rendered at once (decision 2): reading views with
  `previewMode.rerender(true)`, live-preview editors by rebuilding their
  block widgets. Not measured: the live-preview rebuild; the manual check
  covers it (switch the preset with a note open in each mode).

- **AC-8 (performance, SCAR-030):** Icons are read once per path and cached
  until the preset changes. A note with 40 blocks renders in reading view
  without blocking the main thread for more than 100 ms at a time
  (governance limit): each block is drawn in its own processor call, and the
  icon reads are awaited, not synchronous. The bound is checked with a
  generated note in the plugin tests (a fake vault, US-024's tooling) and in
  the manual check.

- **AC-9 (a block in a quote or callout):** As US-030 AC-4: not an entry; the
  processor shows the raw block with a notice `ENTRY_BLOCK_IN_CONTAINER`.

- **AC-10 (tests, SCAR-019, SCAR-015):** The HTML for three data sets (full,
  partial, empty) compared part by part with US-030's emitter; colour and
  grayscale; box values 0, 11, 16, 45, 46, `varies`; tracks default, full,
  `none`, unknown label; invalid YAML; no preset. A manual check (its own
  `M`-file, SCAR-029) in reading view and live preview, with the active
  preset switched while the note is open, ends with the open question of
  SCAR-015.

- **AC-11 (the drawing API, decision 1; SCAR-040):** The plugin exposes
  `app.plugins.plugins["obsidian2typst"].api` with
  `renderStatblock(el, data, options?)`, the same drawing as AC-1 to AC-3 for
  a plain object of note properties (`data`; keys compared in lowercase, as
  US-030 AC-5) and the active preset, `options.heading` for the band (else
  `data.name`, else `—`). It returns `{boxes: HTMLElement[], cells:
  HTMLElement[]}` in their drawn order, so a caller can add its own click
  handlers; the API itself adds none. `api.version` is `1`; a change that
  breaks callers raises it. The API is documented in the manual for its one
  named reader, the author's note preview and encounter tracker (vault
  content). Not measured: a call from a Dataview `dv.view` script at render
  time (Dataview runs view scripts with `app` in scope, by its docs); the
  manual check calls it from a DataviewJS block.

## Decisions (answered by the user, 2026-11-06)

1. **Shared drawing code:** a plugin API, `api.renderStatblock` (AC-11); the
   vault view calls it and adds its own clicks.
2. **Preset change:** open previews re-render at once (AC-7).
3. **No heading above the block:** the band shows the note's file name
   (AC-1).

### Implementation notes

- `src/plugin/entries/processor.ts`: `createEntryProcessor(deps)` → `{handler, clearIconCache}` and `createEntriesApi(deps)` → `{version: 1, renderStatblock(el, data, options?)}`; the dependencies are readers (settings, icons, heading, file name, container), called when the handler runs (SCAR-016, SCAR-022).
- Drawing with Obsidian's `createEl`/`setCssProps` (classes `o2t-sb`, `o2t-sb-box`, `o2t-sb-cell`; cells with `aria-label`); colours as CSS custom properties; icons read once per path and recoloured with the model's `recolourSvg`; no click handlers.
- Notices: `No statblock: the active preset has no entries settings.`, `No statblock: no stats or attacks.`, `ENTRY_YAML_INVALID (line N)`, `ENTRY_BLOCK_IN_CONTAINER`; the raw block stays visible.
- `main.ts`: `registerMarkdownCodeBlockProcessor('o2t-entry', …)`; on a preset change or a save of the active preset's note, `clearIconCache()` and `previewMode.rerender(true)` for open reading views (live-preview widgets rebuilt) (decision 2); `this.api = createEntriesApi(…)` (decision 1).
- `styles.css`: the `o2t-sb-` layout rules; nothing from the network.
- The API is documented in the manual for its named reader (the author's vault views).

### Tests

- `tests/plugin/us-035-preview.test.ts` (all)
- Guards: `tests/unit/us-035-model.test.ts`, `tests/integration/us-035-model-vs-pdf.test.ts` (green since #125)

### SCAR check

- SCAR-016 (UI acts on a stale snapshot): every datum read when the handler runs; a test changes the preset between two renders.
- SCAR-022: the handler is async (typings read: `Promise<any> | void`); every datum comes through an async reader or the context.
- SCAR-040: the API is an output for a named reader; versioned and documented.
- SCAR-017: the drawing rules are the shared model's (#125), compared with the PDF.
- SCAR-030: 40 renders under 100 ms each with fakes; the real time in the manual check.
- SCAR-024: live-preview rendering, the live-preview rebuild and a Dataview call are not measured; they are steps of the manual check.
- SCAR-013, SCAR-014: no dialog, no destructive action.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
