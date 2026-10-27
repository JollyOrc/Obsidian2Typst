# TICKET-018 — Warning report, notices and strict mode

**Status:** Done
**User story:** [US-006](../user-stories/US-006-warnings-and-strict-mode.md)
**ACs addressed:** AC-1 to AC-9
**Depends on:** TICKET-012 (`EmitContext`, the warning record), TICKET-017 (`copyAssets`, used by the integration test)

---

## Description

Turn the warnings of a conversion into the two report texts (export folder and vault note with clickable lines), the notices, and the strict-mode decision, and give the plugin a flow that writes them.

---

## Acceptance criteria (from user story)

See US-006. Decided by the user on 2026-10-17: warnings without a line have `line: 0` (shown as `-`, sorted first); `\`, `|`, `[`, `]` are escaped in message cells so the vault note creates no links; the vault note is overwritten with `No warnings.` when there are none; scope is the pure builder plus the plugin flow with fakes (settings screen US-008, pipeline US-015).

---

## Implementation notes

- **`src/core/report`** (pure): `buildReport(warnings, {linkFile?})`, `escapeCell`, `summarize`, `gotoLink`, `reportNotice`, `strictNotice`, `warningsNoteName`, `warningsNotePath`. The summary sorts by count then code; detail rows keep the order of the warnings (already by line); a link is made only when `linkFile` is a string and `line > 0`.
- **`src/plugin/warning-flow.ts`:** `WarningSettings` and `DEFAULT_WARNING_SETTINGS`; `ExportHost {notice, writeExportFile, writeVaultFile}`; `finishExport` (strict check first, `writeOutput`, report file, vault note, notice); `gotoTarget` and `handleGoto` for the protocol handler.
- Registration of the protocol handler and the settings screen are wired by US-008/US-015 (`registerObsidianProtocolHandler('obsidian2typst-goto', (p) => handleGoto(p, openAt))`).

---

## Tests

- `tests/unit/us-006-warnings.test.ts` — record, ordering, report text, escaping, links, summary, notices, read-back with markdown-it
- `tests/plugin/us-006-export-flow.test.ts` — strict mode, writes and their order, settings, source safety, goto handler
- `tests/integration/us-006-output-and-source.test.ts` — the real note: no warning text in the `.typ`; real files and hash check

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each rule switched off alone is caught by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated if ACs were refined during implementation.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- `core/report`: the report texts, escaping (`\`, `|`, `[`, `]`, line breaks), summary, goto link (parentheses encoded), notices, note names.
- `plugin/warning-flow.ts`: `finishExport`, settings and defaults, `gotoTarget`, `handleGoto`.
- The report read back with markdown-it for 16 nasty messages (pipes, backslashes before pipes, brackets, links, line breaks): one cell each, same text, no link; the vault note has exactly one link per row.
- Measured on the real note: warnings exist (14 `LINK_AMBIGUOUS`, 10 `LINK_UNRESOLVED` among them) and none of their texts or codes occurs in the `.typ`; without assets the 64 images are placeholders and no `ASSET_MISSING` text appears in the `.typ`. The real folder `The Rules` (1.7 GB) is unchanged after an export (note and copied assets by SHA-256, the other files by size and modification time).
- A guard "the warnings note would replace the source note" was planned and removed: the note name always ends in `export warnings.md` after the source's own name, so the two paths can never be equal.
- Mutation check R1 to R20 and F1 to F11 (31 mutants): all caught.
- Left for other stories: registering the protocol handler and the settings screen (US-008, US-015), showing the notices in Obsidian, the end-to-end run through the pipeline (US-015).
