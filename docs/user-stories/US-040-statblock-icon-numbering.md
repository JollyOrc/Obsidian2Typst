# US-040 — The icon files of the statblock answer are numbered by the preset's track order

**Status:** Ready 2026-11-12 (G0 and G1 done; D1 and D2 accepted by the author 2026-11-12); tests written (G2); tickets #168 (code), #169 (documents, M29, release)
**Introduced:** 0.15.1
**Implemented:** —
**Supersedes:** US-039 AC-3 (the numbering rule only)

Found by Game Card Creator while writing the tests of its creature card
(US-004, a sibling plugin that prints game cards,
<https://github.com/JollyOrc/GameCardCreator>); the author decided on
2026-11-12 that the fix belongs here. The shape of the answer stays as
Game Card Creator US-004 AC-3 says; only the number inside a path changes.

---

## Story

**As** a plugin that calls `api.statblockTypst` for many notes of one preset
and compiles all answers in one document,
**I want** one icon path to always mean one file,
**so that** the files of all answers can be put together by path without
renaming, and an icon used by a hundred creatures is shipped once.

### The defect, measured (2026-11-12, `api.statblockTypst` as released in 0.15.0)

The example preset's track is Fine, Hurt, Down, Fading, Gone (the test
fixture `tests/support/entries.ts`), the icon reader returns each file's own
vault path as its bytes. Three notes under that preset:

| Note's `states` | Files returned (path = vault path of the bytes) |
|---|---|
| none (default Fine, Hurt, Down, Gone) | `1` Icons/fine.svg, `2` hurt, `3` down, `4` gone |
| `[Hurt, Gone]` | `1` Icons/hurt.svg, `2` Icons/gone.svg |
| `[Down, Gone]` | `1` Icons/down.svg, `2` Icons/gone.svg |

`o2t-icons/1.svg` is three different files, `o2t-icons/2.svg` three more.
A caller that compiles several answers in one document cannot share the
paths. Cause: `n` counts in the order of first use within one answer
(`iconFiles` in `src/plugin/entries/typst-api.ts`).

### Who uses the numbering today (SCAR-027)

| User | What it assumes | After this story |
|---|---|---|
| `tests/plugin/us-039-statblock-typst.test.ts` (numbered by use; a missing icon takes no number; the same icon in two cells is one entry; vault names that look like `o2t-icons/1.svg`; paths 1 to 4) | first-use numbering | amended to AC-1 to AC-4 |
| `tests/integration/us-039-statblock-typst-pdf.test.ts`, `tests/support/us-039-answer-cli.ts` | the Fen Hare answer and its four files | numbers become 1, 2, 3, 5 |
| `docs/technical/manual-checks/M29.md` (step: `o2t-icons/1.svg` to `4.svg`) | four files, numbered 1 to 4 | the expected names change to 1, 2, 3, 5; run again on the author's word |
| US-039 AC-3 text, `docs/technical/*` that quote it | first-use numbering | text amended, pointing here |
| The book's own output, `renderStatblock`, the preview | do not use these paths | unchanged (AC-5) |
| Game Card Creator US-004 (the reader) | one path, one file; merges equal files; warns on a conflict | its fixture is copied again from the new output |

## Acceptance criteria

- **AC-1 (numbering).** `n` in `o2t-icons/<n>.svg` is the 1-based position in
  the active preset's `entries.statblock.track` list of the first entry that
  names the vault path. A file is returned only for a path a drawn cell names;
  the numbers need not be consecutive. Under the example preset (track Fine,
  Hurt, Down, Fading, Gone): the default Fen Hare (cells Fine, Hurt, Down,
  Gone) gives `o2t-icons/1.svg`, `2`, `3` and `5`; `states: [Hurt, Gone]`
  gives `2` and `5`; `states: [Down, Gone]` gives `3` and `5`. The same
  label gives the same path in every answer of one preset. `data` names the
  path in each cell as before (`icon: "o2t-icons/5.svg"`).
- **AC-2 (one file for one vault path).** Two track entries that name the same
  vault icon share the path of the first of them, and the answer holds one file
  entry for it. Example: a track of Fine and Down both with `Icons/a.svg`, a
  creature with both cells: one file `o2t-icons/1.svg`, both cells name it.
- **AC-3 (a missing icon).** A track entry whose icon is not in the vault gives
  no file and no `icon:` path (`icon: none`) and the warning
  `STATBLOCK_ICON_MISSING` once, as before; it still counts as a position, so
  the other numbers do not move. Example: Hurt missing, the default Fen Hare:
  files `1`, `3`, `5`; the cell Hurt has `icon: none`.
- **AC-4 (the invariant).** For one preset, one path is one file: over any
  number of answers, equal paths have equal bytes, and different files have
  different paths (SCAR-011), also when a vault name looks like a generated
  one (`C/o2t-icons/1.svg` as the vault path of the third entry: its own
  position decides, never the vault name). Tested over the three notes of the
  table above, called one after the other, and over the real sample preset.
- **AC-5 (nothing else changes).** The keys of the answer, the path form
  `o2t-icons/<n>.svg`, `api.version === 1`, the prelude, the warnings and the
  credit, and the output of `renderStatblock`, the preview and the book, are
  byte-identical to 0.15.0 for the same input, except the numbers in the
  icon paths of the answer's `data` and `files`.
- **AC-6 (a preset change).** The mapping is read from the preset at each call
  (US-039 AC-8): after a change of the active preset the paths follow the new
  track; callers that keep files across such a change are warned by their own
  conflict check (Game Card Creator US-004 AC-12a).
- **AC-7 (release 0.15.1).** Version 0.15.1 in `package.json`, `manifest.json`,
  `versions.json`; notes `releases/v0.15.1.md`, a line in `RELEASES.md`.

## Decisions of G1 (accepted by the author 2026-11-12)

- **D1.** A missing icon still counts as a position (AC-3), so that the number
  of an icon never depends on whether another icon exists in the vault.
  Alternative: a missing icon takes no number (numbers consecutive over the
  existing files) and the paths of the others shift when a file is added or
  removed: the clash returns for answers made at different times. Proposal:
  as written.
- **D2.** The number is the track position, not the label: no cleaning of
  labels (spaces, slashes, case, non-ASCII) and no label clash (the author's
  own earlier choice, "option 2"). Proposal: as written.

## Not covered

Naming files by the vault path or by a hash (more stable across presets, but
longer names and a cleaning rule); a cache of the bytes across calls (US-039
AC-8 stays); Game Card Creator's side (its US-004 AC-12a).
