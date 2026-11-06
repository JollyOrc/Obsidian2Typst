<!-- Filed 2026-11-06 as #137 on the user's go (epic #121, ticket 16 of 16). -->

### User story

US-030 to US-036 (epic #121), all stories' closing work

### Description

Close epic #121: the manual's entries chapter, the technical documents, the version, a test build, and the manual checks — one per unit a person runs.

### Acceptance criteria (from the user story)

None of its own: this ticket closes the epic for US-030 to US-036 (every story's definition of done).

### Implementation notes

- `manual/`: the entries chapter (the block, the settings, the layouts, the warnings, the preview and its API, the encounter sheet, the print checks).
- `docs/technical/`: `warning-codes.md` complete for #121; `architecture.md` (the entries modules, the report, the sheet, the print checks, the preview); `tests.md` (the AC-to-test map all green); `entry-block.md` final.
- Documentation gaps found during #121: US-017's own text lists `glossary or none` (stale since US-026); US-029's `Strict mode` description says every warning aborts (stale since US-028 decision E, whose compile warnings arrive after the strict check; US-030's entry warnings do abort, decision 4 revised 2026-11-06).
- Version: a new feature → the minor version (0.12.0); `manifest.json`, `package.json`, `versions.json` together; release notes.
- Test build, installed in the scratch vault with backups and checksums (SCAR-018).
- Manual checks, one file each with the index (SCAR-029): the statblock and layouts at 100 % (incl. an A5 print of a spread), the Obsidian preview (reading view, live preview, a preset switch, a Dataview call to the API), the encounter sheet printed at 100 % (boxes marked with a pencil), the print checks (a low-resolution image, a gappy line).

### Tests

- The full quality gate, every #121 test green (no planned red left).
- The manual checks M21 onward (one file each), each ending with SCAR-015's open question.

### SCAR check

- SCAR-006: the full gate before the build.
- SCAR-012: the scratch vault ready and the build identifiable before handover.
- SCAR-018: backups by full path with checksums before installing.
- SCAR-025: rendered output inspected at 100 % or larger; the sheet printed at 100 %.
- SCAR-029: one file per manual check, with the index.
- SCAR-015: each check names what a correct result looks like and ends with the open question.
- SCAR-030, SCAR-028: the time bounds and the test readers named in `tests.md`.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
