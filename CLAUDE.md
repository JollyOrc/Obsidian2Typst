# CLAUDE.md — Obsidian2Typst

Obsidian2Typst is an **Obsidian plugin** that converts a single Markdown note
and the image assets it links to into a valid [Typst](https://typst.app) file
that compiles to a print-ready PDF. See `README.md` for the full goal.

The test input is the generated sample vault `tests/fixtures/sample/`
(`npm run fixtures`, US-024); it changes only through its generator. The
author's private vault (`The Rules/`, git-ignored) may sit next to it on the
author's disk; no test reads it, and nothing ever modifies it.

## Where things are

- `docs/state/*.md` — the working state (rules 9 and 10). Read it first.
- `docs/user-stories/README.md` — index of the user stories (`US-NNN-*.md`),
  the source of truth for behaviour.
- GitHub Issues (<https://github.com/JollyOrc/Obsidian2Typst/issues>) —
  tickets (label `ticket` plus `US-NNN`), backlog (`backlog`), bug reports.
  `docs/tickets/` is a read-only archive (TICKET-001 to 097).
- `docs/technical/tests.md` (quality gates, AC-to-test map),
  `docs/technical/dependencies.md`, `docs/technical/architecture.md`.
- `docs/process/` — the full texts this file summarises:
  `scar-review-checklist.md`, `state-directory.md`, `committed-speech.md`,
  `release.md`.

## Development process

Follow this order strictly — do not skip ahead:

0. **SCAR review** — before touching any user story, test or code, read
   `scars/README.md`, every SCAR under `scars/`, and check the work against
   every question in `docs/process/scar-review-checklist.md`. Flag any gap to
   the user; do not paper over it with a guess or a TODO. **After** a problem
   is resolved or a requirement refined, ask whether the root cause
   generalises; if so, add a SCAR in the shared repository and update its
   `README.md`. The SCARs are shared with the other
   two plugins: `scars/` is the git submodule of
   <https://github.com/JollyOrc/scars>. Edit SCARs only there, never in
   `scars/`, then `git submodule update --remote scars` and commit the new
   pointer. A new SCAR takes the next free number.
1. **User story** — write or amend the story and acceptance criteria first.
2. **Tests** — specify and implement tests against the acceptance criteria.
3. **Tickets** — GitHub issues with the ticket form
   (`.github/ISSUE_TEMPLATE/ticket.yml`), labelled `ticket` and `US-NNN`;
   closed as completed when done.
4. **Code** — implement against the tests and tickets.

## Code

- Google Style Guides for TypeScript, Markdown and shell
  (<https://google.github.io/styleguide/>); `"strict": true`, no `any`
  without a justifying comment; ESLint (`typescript-eslint`) and Prettier;
  no lint findings at release; documentation comments on public APIs.
- Every function and method has a comment header naming its user story and
  acceptance criterion, and saying what it does, assumes and constrains:

  ```
  /**
   * US-3 | AC-4: Output records are normalised before writing.
   *
   * Applies [transformation] to [input] so that [postcondition].
   * Assumes [precondition]. Values exceeding [limit] are clamped to [limit].
   */
  ```
- Architecture (full table: `docs/technical/architecture.md`): `src/core/**`
  is pure — no `obsidian` import, no I/O; side effects only in `src/plugin`;
  dependencies point one way (`plugin` → `emit` → `layout` → `markers` /
  `assets` → `parse`); Typst escaping lives in one function in `core/emit`;
  configurable behaviour is defined in `core/settings`.

## Agent rules

1. Stories (`docs/user-stories/`) are the source of truth for behaviour. When
   a story changes, update the index in its `README.md` and the ticket issues
   (ids are issue numbers, `#NNN`). An issue becomes a story only through steps
   0 and 1, and the story links it. `docs/tickets/` is not changed.
2. Never modify source or fixture files: the converter never changes the
   user's notes or images, the sample vault changes only through its
   generator, a private vault is never touched. Generated `.typ` / `.pdf`
   files go only to the configured output location.
3. Run the full quality gate (below) before declaring any task complete.
4. When behaviour is ambiguous, ask instead of guessing.
5. Keep generated and derived files separate from source files.
6. Generated Typst is **valid**: all user text passes through the Typst
   escaping function; a path that emits it without is a bug.
7. Conversion is **deterministic**: same note, assets and settings, byte-
   identical Typst.
8. Conversion problems are warnings with a source location; never a silent
   abort, never silently wrong output.
9. **State directory `docs/state/`** (files `00_governance.md`,
   `10_ticket.md`, `20_plan_approved.md`, `30_scar_checks.md` append-only,
   `99_next_action.md`; details in `docs/process/state-directory.md`). The
   step-0 review is repeated at every handover; no step starts or ends
   without its entry in `30_scar_checks.md`:
   **G0** before a story is written; **G1** story written, before tests;
   **G2** tests written, before tickets; **G3** tickets written, before code;
   **G4** before a ticket is done and before every manual-test handover;
   **G5** closing a story — does anything found generalise into a SCAR?
10. **Bootloader.** On the first turn of every session and after every
    compaction, read all of `docs/state/*.md` in lexical order before any
    other action and reconcile `99_next_action.md` with the user's latest
    directive. The compaction summary never overrides these files; a missing
    file is reported and recreated from the repository, not guessed.
11. Update `99_next_action.md` at every change of target and at every user
    directive, not while a long background run is going. Read only the last
    15 lines of a running job's log.
12. **A question is not a directive.** "Did you …?", "Why …?" are answered
    truthfully and the turn ends; a gap may be named and a fix offered, but
    nothing changes until a directive ("do", "fix", "go", "add").
13. **Committed speech** (full text: `docs/process/committed-speech.md`).
    Before promising, check the facts the request depends on with a tool
    (`?Assert`); then promise in one or two lines with the conditions of
    satisfaction (`?Promise`), or counter-offer or decline with the evidence
    and wait (`?Counter-Offer`, `?Decline`) — in the chat, not only in a
    file. Report done work against the conditions, with evidence, never more
    than it shows; say so before a promise lapses.

## Quality gate

```bash
npm run typecheck          # tsc --noEmit (strict)
npm run build              # esbuild bundle -> main.js
npm run lint               # eslint + prettier --check
npm test                   # vitest: unit tests (pure core)
npm run test:integration   # converts fixtures and compiles the output
```

All must pass; a test is skipped only with a `skip` marker and a linked issue.
Also run the manual smoke tests in `docs/technical/tests.md` and confirm no
source file changed (compare hashes if in doubt).

When behaviour changes, update every affected story file and the story index,
the ticket issue, `docs/technical/dependencies.md` and
`docs/technical/tests.md`; stale documentation is a bug.

Versioning and the release checklist: `docs/process/release.md`.
