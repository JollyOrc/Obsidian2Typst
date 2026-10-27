# US-006 — Report conversion warnings; optional strict mode

**Status:** Done (the settings screen, the handler registration and the pipeline call come with US-008 and US-015)
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author,
**I want** every problem found during conversion listed with its location, and
the option to stop on any problem,
**so that** nothing is silently wrong in the printed book.

---

## Acceptance criteria

- **AC-1 (warning record):** Each warning has a `code` (upper snake case, e.g.
  `LINK_UNRESOLVED`), a human-readable `message`, and the 1-based `line` in the
  source Markdown file. A warning that belongs to no line of the note (font,
  template and cover warnings) has `line: 0` (decided by the user 2026-10-17).
  Warnings are ordered by line, then by order of detection; line 0 therefore
  comes first. The record is the `Warning` of `core/emit` (`EmitContext`
  already orders it); the report and the notice only read it.

- **AC-2 (report file):** After an export with at least one warning, the file
  `export-warnings.md` is written to the export folder. It is the summary of
  AC-8 followed by the detail table (the example shows the detail table):
  ```
  | code | message | source line |
  |------|---------|-------------|
  | LINK_UNRESOLVED | No heading matches "\[\[Nowhere\]\]" | 412 |
  | ASSET_MISSING | Image file not found: assets/crypt.png | 977 |
  | FONT_MISSING | Font "Foo" is not available | - |
  ```
  The messages are the ones the converter writes (US-003, US-004). In a
  message cell `\` is written `\\`, `|` is written `\|`, every `[` is written
  `\[` and every `]` is written `\]` (decided by the user 2026-10-17: the vault
  note must not create links, also not from a path like `a [b](c).png`; the
  example `[[Nowhere]]` becomes `\[\[Nowhere\]\]`), and a line break is written
  as one blank. The source line of a
  warning with `line: 0` is `-`. With zero warnings no table is written; the
  file contains `# Export warnings\n\nNo warnings.\n`, so a stale report of an
  earlier export is always overwritten.

- **AC-2b (report note inside the vault, with clickable lines):** In addition
  to the file in the export folder, the same report is written as a vault note
  `<source name> export warnings.md` (the source file name without `.md`) into
  the folder set by the setting `Warnings note folder` (default: empty = the
  vault root, like the existing `warnings_*.md` files of the vault compiler;
  leading and trailing `/` of the setting are ignored). It is overwritten on
  each export, also with `No warnings.` when there are none (decided by the
  user 2026-10-17, so that it never shows problems that are already fixed); it
  contains no timestamp. Each source line is a link that opens the source note
  at that line; the file path is percent-encoded with `encodeURIComponent`:
  ```
  | code | message | source line |
  |------|---------|-------------|
  | LINK_UNRESOLVED | No heading matches "\[\[Nowhere\]\]" | [412](obsidian://obsidian2typst-goto?file=Sample%2Fcompiledtext.md&line=412) |
  ```
  The plugin registers the `obsidian2typst-goto` protocol handler; clicking
  the link opens `Sample/compiledtext.md` with the cursor on line 412. The
  handler reads `file` (a vault path) and `line` (a whole number of at least 1;
  anything else opens the note at line 1) and does nothing when `file` is
  missing. If the source file is outside the vault, or the warning has
  `line: 0`, the cell shows the plain number (or `-`). The note is not written
  in strict-mode aborts (AC-4).

- **AC-3 (notice):** When warnings exist, a notice shows
  `Exported with 2 warnings. Report: Export/run1/export-warnings.md` (singular:
  `1 warning`), the path being the report file of AC-2 in the export folder.
  With no warnings this story shows no notice.

- **AC-4 (strict mode, off by default):** The setting `Strict mode` is **off**
  on a fresh install, so that authors can resolve all warnings first and turn it
  on afterwards. It has no per-code exceptions (also `COMMENT_DROPPED` counts):
  with it on, any warning aborts the export before any file is written to the
  export folder. The notice reads
  `Export aborted: 2 warnings (strict mode)` (singular `1 warning`) followed by
  one line for each of the first five warnings, `line 412: LINK_UNRESOLVED`; a
  warning with `line: 0` is written as the code alone, `FONT_MISSING`. No
  report file and no vault note is written; the export folder is left exactly
  as it was. The warning count in the first line is the total, not the number
  of listed lines. With zero warnings strict mode has no effect.

- **AC-5 (composed: warnings from several stories in one run):** An input with
  a missing image (line 10), an unresolved link (line 4), and an unused footnote
  (line 7) yields three report rows in the order 4, 7, 10. A warning without a
  line (`FONT_MISSING`, line 0) comes before them.

- **AC-6 (warnings stay out of the PDF):** Warning texts never appear in the
  generated `.typ` or PDF. Only the visible placeholders defined by other
  stories (for example the red missing-image box of US-003 AC-5) appear. Checked
  on the real note: no message of its warnings occurs in its `.typ`.

- **AC-7 (warnings never alter the source):** After an export the source note,
  its folder, and all source assets are byte-identical to before (hash check).
  The export writes only below the export folder and into the warnings note
  folder; the only vault file it replaces is the previous warnings note.

- **AC-8 (grouped summary above the details):** Both report files start with a
  summary table with one row per code and its count, sorted by count (highest
  first), then by code; the detail table of AC-2 follows under `## Details`.
  The notice of AC-3 stays a single count. Strict mode (AC-4) is unaffected.
  ```
  # Export warnings

  | code | count |
  |------|-------|
  | LINK_AMBIGUOUS | 14 |
  | LINK_UNRESOLVED | 10 |
  | ASSET_MISSING | 3 |

  ## Details

  | code | message | source line |
  |------|---------|-------------|
  ```
  (The examples of AC-2 and AC-2b show the detail table only; the counts above
  are illustrative except LINK_AMBIGUOUS and LINK_UNRESOLVED, which come from
  the real input.) The summary keeps a long report readable.

- **AC-9 (interfaces; the report builder stays pure):** The report text, the
  link text, the notice texts and the strict-mode decision are pure functions
  of the warnings, the source description and the settings (`core/report`). The
  plugin side (`plugin/warning-flow`) takes an injected host (notice sink,
  writer for the export folder, writer for the vault) and the settings
  `{strictMode: false, warningsNoteFolder: ''}` as defaults. `finishExport`
  receives the conversion's warnings and a `writeOutput` callback (the `.typ`,
  the assets, the PDF of the other stories): in strict mode with a warning it
  shows the notice and never calls `writeOutput`; otherwise it calls
  `writeOutput`, writes the report file, the vault note and shows the notice.
  The settings screen belongs to US-008; the protocol handler body is the pure
  function `gotoTarget(params)` plus an injected `openAt(path, line)`.

---

## Notes

- Warning codes introduced elsewhere: `HTML_UNSUPPORTED`, `COMMENT_DROPPED` (US-001),
  `HEADING_EMPTY`, `HEADING_LEVEL_SKIPPED` (US-002), `ASSET_*`, `IMAGE_IN_HEADING` (US-003), `LINK_*` (incl. `LINK_URL_NOT_SPELLED`), `EMBED_NOTE_UNEXPANDED`
  (US-004), `TABLE_ROW_LONG`, `FOOTNOTE_*` (incl. `FOOTNOTE_UNCLOSED`) (US-005), `FONT_*` (US-010),
  `COVER_*` (US-011), `TEMPLATE_*` (US-008), `COVER_CROPPED`, `COVER_BACK_UNSUPPORTED` (US-011). This story owns the full list; it is kept in
  `docs/technical/warning-codes.md`.
- Mapping Typst compile errors back to Markdown lines is a backlog story. The
  converter must therefore keep a source line for every emitted block.
- Not part of this story: the settings screen (US-008), the export command and
  the pipeline that calls `finishExport` (US-015, US-007). AC-6 and AC-7 are
  checked here against the emitter and a fake file system; the end-to-end run
  through the pipeline is added with US-015.

---

## Related tickets

- [TICKET-018](../tickets/TICKET-018-warning-report-and-strict-mode.md)
