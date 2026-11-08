# US-035 — Statblock preview of entry blocks in Obsidian

**Status:** Done (amendment 2026-11-08: AC-12, the box row inside the frame, for 0.12.1; M21 to M24 passed 2026-11-07; M21's findings and M23's changes merged without a re-run, the user's decision; G1 2026-11-06; decisions 1 to 3 answered the same day, G1 re-check)
**Introduced:** v0.12.0 (planned, with US-030 to US-034)
**Implemented:** v0.12.0 (released 2026-11-07), epic #121 (tickets #122 to #137); test builds `0.12.0-m21.1` (M21 to M24) and `0.12.0-m21.2` (their follow-ups); AC-12 in v0.12.1 (ticket #138)
**Supersedes:** —

Epic #121, sixth of seven stories (see US-030). Draft D-20 in
`docs/drafts/entry-layouts-tickets.md`.

---

## Story

**As an** author reading the compiled book in Obsidian,
**I want** each `o2t-entry` block shown as the statblock it will become,
**so that** I can check entries in the compiled file without exporting, and
the block's YAML doesn't clutter the reading view.

Decided by the user (G0-A9, 2026-11-05): render the block in Obsidian rather
than show it as a code block; reuse one drawing code for this preview and for
the author's own note preview, rather than two. The preview draws the tracks
but does not react to clicks (interactive tracks are the author's vault
content, D55).

Measured / read (SCAR-024):

- **The API (read from `obsidian.d.ts` 1.14.4, the version this plugin builds
  against):** `Plugin.registerMarkdownCodeBlockProcessor(language, handler,
  sortOrder?)`; the handler gets `(source, el, ctx)` and may return a
  `Promise`; `ctx.sourcePath` is the note's path; `ctx.addChild` takes a
  `MarkdownRenderChild` for clean-up.
- **Not measured:** that Obsidian runs the processor in live preview as well
  as in reading view for a block of a registered language (documented
  behaviour, to be checked in the manual check), and the time to render a
  note with 40 blocks.

---

## Acceptance criteria

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

- **AC-12 (the box row stays inside the frame; amendment 2026-11-08):**
  The tick boxes are drawn in rows of 15, in three groups of five (as in the
  PDF), and no box reaches past the statblock's frame at any width at which
  the box label and the fixed gaps fit. `styles.css` gives the box row the
  columns `auto minmax(0, 1fr)` and the boxes 17 columns: three groups of
  `repeat(5, minmax(0, 1fr))` with a `0.2em` column between them; a box has
  `min-width: 0`; the 6th and 11th box of each row of 15 are placed in
  columns 7 and 13; no box has a margin. Examples, label `VIGOUR`, text at
  16 px, measured in WebKit (a plain page with the plugin's `styles.css`):
  - 15 boxes at a 620 px page: the last box ends at the content edge
    (538.6 px; before the amendment 550 px, 11.4 px past it, through the
    margins of boxes 5 and 10 on `1fr` columns); at 330 px: 303.4 (before
    314.7); at 200 px: 173.4 (before 175.7).
  - 1, 5 and 6 boxes: one row from the left; box 6 starts after the group
    gap (8 px between boxes 5 and 6, 2.4 px between the others).
  - 16 boxes: two rows, box 16 under box 1; 45 boxes: three rows whose 15
    boxes stand at the same positions.
  - Below a 190 px page the label and the fixed gaps no longer fit (boxes at
    their 2 px minimum) and the row may overflow; the state track does so
    below 170 px. Not a goal.
  Not measured: Obsidian itself (Chromium) by program; the user checked the
  same rules there by eye on 2026-11-08, and M22 has a step for it.

- **AC-10 (tests, SCAR-019, SCAR-015):** The HTML for three data sets (full,
  partial, empty) compared part by part with US-030's emitter; colour and
  grayscale; box values 0, 11, 16, 45, 46, `varies`; tracks default, full,
  `none`, unknown label; invalid YAML; no preset. A manual check (its own
  `M`-file, SCAR-029) in reading view and live preview, with the active
  preset switched while the note is open, ends with the open question of
  SCAR-015.

---

## Decisions (answered by the user, 2026-11-06)

1. **Shared drawing code:** a plugin API, `api.renderStatblock` (AC-11); the
   vault view calls it and adds its own clicks.
2. **Preset change:** open previews re-render at once (AC-7).
3. **No heading above the block:** the band shows the note's file name
   (AC-1).

---

## Notes

- Only the processor is this plugin's work. The author's creature template,
  its DataviewJS view, the CSS snippet and the encounter tracker note are
  vault content.

---

## Related tickets

<!-- Filled in at step 3. Draft: D-20. -->

- #134 (AC-1 to AC-11), with #125 for the shared model; #137 for M22.
- #138 (AC-12, amendment 2026-11-08): the box row inside the frame.
