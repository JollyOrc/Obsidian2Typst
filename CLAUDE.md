# CLAUDE.md — Obsidian2Typst

Obsidian2Typst is an **Obsidian plugin** that converts a single Markdown note
and the image assets it links to into a valid [Typst](https://typst.app) file
that compiles to a print-ready PDF. See `README.md` for the full goal.

The test input is the generated sample vault `tests/fixtures/sample/`
(`npm run fixtures`, US-024); it changes only through its generator. The
author's private vault (`The Rules/`, git-ignored) may sit next to it on the
author's disk; no test reads it, and nothing ever modifies it.

## Shared rules

The development process (steps 0 to 4), code style, function headers, agent
rules 1 to 15, documentation maintenance and versioning are shared with the
two sibling plugins and live in the SCARs repository:

@scars/AGENT-RULES.md

What follows is specific to this project and refines the shared rules.

## Where things are

- `docs/state/*.md` — the working state (rules 9 and 10). Read it first.
- `docs/user-stories/README.md` — index of the user stories (`US-NNN-*.md`),
  the source of truth for behaviour.
- GitHub Issues (<https://github.com/JollyOrc/Obsidian2Typst/issues>) —
  tickets (label `ticket` plus `US-NNN`, form
  `.github/ISSUE_TEMPLATE/ticket.yml`), backlog (`backlog`), bug reports.
  `docs/tickets/` is a read-only archive (TICKET-001 to 097).
- `docs/technical/tests.md` (quality gates, AC-to-test map),
  `docs/technical/dependencies.md`, `docs/technical/architecture.md`.
- `docs/process/`: `scar-review-checklist.md` (the step-0 questions),
  `release.md`. The SCAR gate table is shared: `scars/GATES.md`.

## SCAR gates and bootloader

The gates of rule 9, recorded in `docs/state/30_scar_checks.md`: **G0** before
a story is written; **G1** story written, before tests; **G2** tests written,
before tickets; **G3** tickets written, before code; **G4** before a ticket is
done and before every manual-test handover; **G5** closing a story. The SCARs
checked again at G1, G2 and G4 are listed in `scars/GATES.md`.
Bootloader (rule 10): read all of `docs/state/*.md` first in every session and
after every compaction.

## What the shared rules mean here

- Rule 2: the converter never changes the user's notes or images; the sample
  vault changes only through its generator; a private vault is never touched.
  Generated `.typ` / `.pdf` files go only to the configured output location.
- Rule 6: generated Typst is **valid**; all user text passes through the
  Typst escaping function in `core/emit`.
- Rule 7: conversion is deterministic — same note, assets and settings,
  byte-identical Typst.
- Rule 8: conversion problems are warnings with a source location.

## Code

- Every function header names its story and AC (shared rules, "Function
  documentation").
- Architecture (full table: `docs/technical/architecture.md`): `src/core/**`
  is pure — no `obsidian` import, no I/O; side effects only in `src/plugin`;
  dependencies point one way (`plugin` → `emit` → `layout` → `markers` /
  `assets` → `parse`); Typst escaping lives in one function in `core/emit`;
  configurable behaviour is defined in `core/settings`.

## Quality gate

```bash
npm run typecheck          # tsc --noEmit (strict)
npm run build              # esbuild bundle -> main.js
npm run lint               # eslint + prettier --check
npm test                   # vitest: unit tests (pure core)
npm run test:integration   # converts fixtures and compiles the output
```

All must pass. Also run the manual smoke tests in `docs/technical/tests.md`
and confirm no source file changed (compare hashes if in doubt).

Versioning and the release checklist: `docs/process/release.md`.
