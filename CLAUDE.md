# CLAUDE.md — Obsidian2Typst

---

## Project context

Obsidian2Typst is an **Obsidian plugin** that converts a single Markdown note
and the image assets it links to into a valid [Typst](https://typst.app) file
that compiles to a print-ready PDF. It exists so that an author can stay in
Obsidian and still control print layout: fonts, decorative elements, content
marked as examples or glossary entries (and other custom styles), image
placement and page-break rules, cover pictures, and other print settings.
See `README.md` for the full goal.

The test input is the generated sample vault `tests/fixtures/sample/`
(`npm run fixtures`, US-024); it changes only through its generator. The
author's private vault (`The Rules/`, git-ignored) may sit next to it on the
author's disk; no test reads it, and nothing ever modifies it.

Orientation files:

- `docs/user-stories/README.md` — index of all user stories; individual stories in `US-NNN-*.md` files.
- `docs/tickets/README.md` — index of all tickets; individual tickets in `TICKET-NNN-*.md` files.
- `docs/technical/dependencies.md` — dependencies and build requirements.
- `docs/technical/tests.md` — quality gates and required tests.
- `docs/state/` — the `init.d` state (rule 9): governance, the SCAR ledger, the next action. Read it first on every session and after every compaction (rule 10).

---

## Development process

Follow this order strictly — do not skip ahead:

0. **SCAR review** — before touching any user story, test, or code, read
   `scars/README.md` and every SCAR file under `scars/`. Check the new
   instructions or user story against each documented failure pattern:
   - Are all ACs stated with concrete input/output examples? (SCAR-007)
   - Do the ACs cover nested/composed usage, not just the top-level case, and
     has every example been run through the whole converter with every other
     story's rules and the built-in defaults on, and do the composed cases name
     inline wrappers (bold, links) as well as block containers, and is every
     example of plugin behaviour checked against the plugin rules it passes
     through (preview controller, panel, settings)? (SCAR-002)
   - Is there a test stub for every AC before any code is written? (SCAR-003)
   - Does any shared utility get a new call site? If so, are all its transforms
     documented and verified as appropriate for this use? (SCAR-001)
   - Is the test suite required to be fully green before this work ships? (SCAR-006)
   - Does the work call a third-party API (canvas, renderer, compiler) whose
     options were read from its type definitions, with a programmatic check of
     the output, and is every canvas created by the one helper? (SCAR-008)
   - Was every alternative measured with the real consumer before it was
     offered as a choice, or is an unmeasured one marked so? (SCAR-020)
   - Is output that depends on its own layout (`context`, `locate`, "unless on
     this page") swept across a page edge and checked for being stable?
     (SCAR-021)
   - For every callback (event, menu, command, render hook), was it read from
     the types whether it runs synchronously, and is each datum it needs
     listed as in memory or an async read (the latter moved into the action
     after the click), when the story is written? (SCAR-022)
   - Is every statement in the story about what a dependency does split into
     its parts, each with a test with the real tool, or marked as not
     measured, and is an explanation of an observed failure marked unverified
     until a test shows it? (SCAR-024)
   - Was every search result (a word list, a pattern) classified by context
     before it was counted, offered as a choice or replaced, does a choice show
     the split, and does a scripted replace work from a reviewed keep-list?
     (SCAR-026)
   - When something is replaced (a fixture, a vault, a file format, a
     library), is every user of it listed with what it asserts or assumes,
     before the replacement's acceptance criteria are written? (SCAR-027)
   - Are rules for generated text checked in every position (start, middle,
     end, around line breaks) against the real consumer? (SCAR-009)
   - Where output is built by concatenating pieces, are the join hazards of
     each piece type listed, measured with the real consumer, and tested as
     piece × neighbour with guard tests and a mutation check? (SCAR-010)
   - Where a rule makes generated names unique (labels, file names, keys), is
     the invariant stated, and is a natural name that looks like a generated
     one tested? (SCAR-011)
   - Before a manual test is handed to a human: is the environment complete and
     current (build installed and compared with the fresh build, fixtures in
     place), does the build have a new unique version shown in the app, and
     does the check text start with that version and the place where it runs?
     Does every file a fixture names by its name have a name that is unique
     where it is looked up, shown by a listing? (SCAR-012) Is a rendered result
     that is judged by eye inspected at reading size, with the joins of
     separately drawn parts zoomed in on? (SCAR-025)
   - Does every dialog with an input field specify Enter = confirm, Escape =
     cancel and the IME-composition case (SCAR-013)? Does every action that
     deletes, overwrites or irreversibly changes user data have a
     confirmation with the safe choice as default, and is the worst misplaced
     click on each screen listed (SCAR-014)?
   - Does every end-to-end criterion and manual check state the content the
     output must have (text, fonts, images), is there a guard test for the
     blank result, and does the check ask for anything odd that the list did
     not mention (SCAR-015)?
   - Does every control (button, icon, switch, field) read the state when it is
     used and not a value captured while the screen was drawn, does each AC
     have an example in the order draw, change the data, use the control, is
     the manual step run without closing the tab, does a new way to change
     a value list every screen that shows it and how each updates, and does
     every loader announce its load to screens drawn before it (SCAR-016)?
   - When a defect was reported: was the pattern searched in the whole code
     base, is every instance listed in the ticket (fixed or why not affected),
     is the rule stated for the class in the story, and does one function plus
     a text check over the file keep a new copy from bypassing it? Does a story
     that adds a way to change a value list every writer, found by a grep for
     the value? Do the fix's own story, tests and tickets go through the same
     check? (SCAR-017)
   - Does every guard check exactly its criterion, not less and not more: does
     a guard over output count the places it checked, does a text check match
     the whole statement, are test inputs ones the real producer gives, is
     each guard proven by a mutation check, and were the tests searched before
     tickets for guards that forbid a call the tickets add (each listed,
     narrowed to its criterion with the reason)? Does a test that one side
     wins also show that the other side was in effect? Does a test that output
     is the same on every run run the code from two fresh starts? (SCAR-023)
   - Does any tooling change the sources (mutation run, scripted edit, probe
     setup)? Are the backups made by full path with a checksum list, checked
     after every restore, and is the run stopped and repeated on a failed check,
     and does the backup hold the state to return to (for a manual check, the
     state as handed over), and does a scripted edit leave out files that
     change only with the user's approval (SCAR-018)? Is a surviving mutant read first as a test input that cannot
     reach the rule (SCAR-023)? When text moves into a new container (content block, call
     argument), is its start checked as a new block start (SCAR-009)?
   - Does a rule read a setting? Does it have examples and tests at the
     default, at both ends of the range and at one other value, and was a
     decision asked in terms of the default also asked for the other values
     (SCAR-019)?
   Flag any gap to the user before proceeding; do not paper over it with a
   guess or a TODO.

   **After** a problem is resolved or a requirement is refined, ask: can the
   root cause be generalised beyond this specific case? If yes, add a new SCAR
   to `scars/` (following the existing format) and update `scars/README.md`.
   A SCAR is warranted when the same underlying failure mode could recur on
   any future feature, not just the one just fixed.

1. **User story** — write or amend the story and acceptance criteria first.
2. **Tests** — specify and implement tests against the acceptance criteria.
3. **Tickets** — create the necessary work items.
4. **Code** — write the implementation against the tests and tickets.

---

## Code style

All code must adhere to the **Google Style Guides**: <https://google.github.io/styleguide/>

- **TypeScript:** <https://google.github.io/styleguide/tsguide.html>
- **Markdown:** <https://google.github.io/styleguide/docguide/style.html>
- **Shell scripts:** <https://google.github.io/styleguide/shellguide.html>

Additional requirements:
- Use strict type checking: `"strict": true` in `tsconfig.json`; no `any`
  without a justifying comment.
- Lint with ESLint (`typescript-eslint`) and format with Prettier.
- Add documentation comments for all public APIs.
- Resolve all lint findings before release.

---

## Function documentation

Every function and method must carry a comment header that states:

1. **User story** — which US it supports (e.g. `US-3`, `US-7.2`).
2. **Acceptance criterion** — the specific AC it implements
   (e.g. `AC-4: Output is normalised before writing`).

The comment must also describe what the function does, what it assumes, and
any non-obvious constraints (clamping, ordering, side effects).

### Example

```
/**
 * US-3 | AC-4: Output records are normalised before writing.
 *
 * Applies [transformation] to [input] so that [postcondition].
 * Assumes [precondition]. Values exceeding [limit] are clamped to [limit].
 */
```

---

## Agent rules

1. Treat `docs/user-stories/README.md` and the individual `US-NNN-*.md` files as the source of truth for behaviour. When adding or amending a story, also update the index table in `README.md` and create or update the corresponding tickets in `docs/tickets/`.
2. Never modify source or fixture files; only write to configured output paths.
   In this project that means: the converter never modifies the user's notes or
   image assets, the sample vault changes only through its generator, and
   nothing ever modifies a private vault on the author's disk. Generated
   `.typ` / `.pdf` files go only to the configured output location.
3. Run the full quality gate (see **Testing expectations**) before declaring
   any task complete.
4. When a behaviour is ambiguous, surface the ambiguity to the user rather than
   guessing. A wrong assumption costs more to fix than a clarifying question.
5. Keep generated and derived files clearly separated from source files.
6. Generated Typst must be **valid**. Every piece of user text that reaches
   the output passes through the Typst escaping function; a code path that
   emits user text without it is a bug.
7. Conversion is **deterministic**: the same note, assets, and settings always
   produce byte-identical Typst.
8. Conversion problems (unresolved links, missing images, unknown markers) are
   reported as warnings with a source location; they never abort silently and
   never produce silently wrong output.
9. **State directory `docs/state/` (the `init.d` of this project).** It holds
   the working state that must survive a context compaction. Files, in lexical
   order:
   - `00_governance.md` (write-once at start; amended only when the user
     changes the process): the workflow (steps 0 to 4 above), the approval
     airlocks (the user's "go" before each step and before each ticket) and the
     decisions the user has made, with dates.
   - `10_ticket.md` (write-once at ticket selection; replaced at the next
     selection): story and ticket ids, the ACs addressed, the SCARs the ticket
     names.
   - `20_plan_approved.md` (write-once after the user's "go" for the ticket):
     the approved file list and the invariants that must hold.
   - `30_scar_checks.md` (**append-only**): the SCAR ledger. One entry per SCAR
     gate (below): date, gate, story or ticket, and every SCAR as `ok`, `gap`
     (where it was fixed) or `n/a` (reason), each with its evidence (file,
     test name, command output). A gate that found gaps is followed by an entry
     that shows them closed.
   - `99_next_action.md` (overwritten at each target): the checklist, `Current
     Target`, `Last Completed Step`, `Next Permitted Action` and `SCAR gate
     due`.

   **SCAR gates.** The review of step 0 is repeated at every handover between
   steps, and a step is neither started nor declared complete without its entry
   in `30_scar_checks.md`:
   - **G0** story review, before a story or an amendment is written (step 0);
   - **G1** story written or amended, before any test (SCAR-002, 007, 013 to
     016, 017, 019, 020, 022, 024, 026, 027 against the ACs);
   - **G2** tests written, before any ticket (SCAR-003, 001, 008, 011, 015,
     019, 021, 023, 024);
   - **G3** tickets written, before any code: each ticket has a "SCAR check"
     section that goes through the Prevention list of every SCAR, item by item;
   - **G4** before a ticket is declared done and before every manual-test
     handover (SCAR-006, 012, 015, 016, 018, 023, 025, 026; the gate and the pass
     counts);
   - **G5** closing a story: can the root cause of anything found be
     generalised into a new SCAR?
10. **Bootloader (`Target 0: read-init-d`).** On the first turn of every
   session and on the first turn after any compaction, read all files of
   `docs/state/*.md` in lexical order before any other action and reconcile
   `99_next_action.md` with the user's latest directive. The compaction summary
   never overrides these files. A file that should exist for the current step
   and does not is reported to the user (`?Assert`, rule 13) and recreated from
   the repository, not guessed.
11. **Update discipline.** Update `99_next_action.md` at every change of target
   and when the user gives a directive; do not update it while a long
   background run (test suite, build, mutation run) is still going. When
   reading the log of a running job, read only its last 15 lines.
12. **A question is a request for information, not a directive.**
   "Did you …?", "Is X checked …?", "Why …?", "Are the tickets …?" are answered
   truthfully and then the turn ends. The answer may name a gap and may offer a
   fix (a `?Counter-Offer`, rule 13), but nothing is changed until a directive
   ("do", "fix", "go", "add") arrives. Only a directive authorises work.
13. **Committed speech (Fernando Flores): the user is the `Customer`, Claude is
   the `Performer`.** A request has the form `[DO X] by [BY-WHEN]`; when no
   `BY-WHEN` is given it is this turn, and Claude says so. Before any
   `?Promise`:
   - `?Assert` — check the physical facts the request depends on (files,
     directories, tool and API output, code, versions, git state) with a tool
     call. Do not answer from memory or from the compaction summary.
   - If every premise is true and the request is sensible and doable by the
     `BY-WHEN`, issue the `?Promise` in one or two lines: what will be done and
     the conditions of satisfaction (what the user will be able to see or run).
   - If a premise is false, ill-advised, or the `BY-WHEN` is not realistic,
     issue a witnessed `?Counter-Offer` (what is false, with the evidence you
     found; what is offered instead) or a `?Decline` (what cannot or should not
     be done, and why). Then wait. Do not start a changed version of the work
     and do not silently do something else. Do the parts that are
     unaffected only if they stand alone, and say which.
   - "Witnessed" means in writing in the chat (use `AskUserQuestion` when the
     answer is a choice). A promise, counter-offer or decline that is only in a
     file or in thinking has not been made.
   - When the work is done, report it as a declaration against the stated
     conditions of satisfaction, with the evidence (command output, counts,
     file names), and let the user accept it. Never report more than the
     evidence shows. When a promise cannot be kept, say so before the
     `BY-WHEN` and renegotiate; do not let it lapse.
---

## Architecture expectations

The plugin is split into a **pure core** and a thin **Obsidian shell**.

| Module | Responsibility | Side effects |
|--------|----------------|--------------|
| `src/core/parse` | Markdown (incl. Obsidian syntax: wikilinks, embeds, callouts, frontmatter) to an intermediate document tree | none |
| `src/core/assets` | Resolve image links to asset references (path, type) via an injected resolver | none |
| `src/core/markers` | Recognise author-defined markup for examples, glossary entries, and other styles | none |
| `src/core/layout` | Apply image-placement and page-break rules to the tree | none |
| `src/core/emit` | Document tree plus settings to Typst source, including escaping | none |
| `src/core/settings` | Typed settings model, defaults, and validation (fonts, decoration, cover, print) | none |
| `src/plugin` | Obsidian API: commands, settings UI, side-panel view, vault file reading, writing output | file I/O, UI |
| `src/plugin/engine` | Loads the WASM compiler in a Web Worker; compile and render requests | worker, memory |

Invariants:

- `src/core/**` must **not** import from `obsidian` or any Node/DOM I/O API.
  File access happens in `src/plugin` and is passed into the core as data or
  as injected interfaces. This keeps the core unit-testable in plain Node.
- Dependencies point one way: `plugin` -> `core/emit` -> `core/layout` ->
  `core/markers` / `core/assets` -> `core/parse`. No module imports "upward".
- Side effects (reading the vault, writing output, showing notices) occur only
  in `src/plugin`.
- Typst escaping lives in exactly one function in `core/emit`. Any new call
  site of it must document its transforms (SCAR-001).
- Behaviour that is configurable is defined in `core/settings`; no formatting
  constants are hard-coded in `emit`.

Tooling (proposed defaults, to be confirmed in the first user story): Node,
npm, esbuild for bundling (as in the official Obsidian sample plugin), Vitest
for tests. Typst compilation uses a **bundled WASM compiler** (`typst.ts`), so
the plugin needs no installed `typst` binary; the CLI is used only in the
integration tests as a second check that generated `.typ` files compile
outside the plugin.

---

## Testing expectations

Before finalising any change, run the full quality gate:

```bash
npm run typecheck          # tsc --noEmit (strict)
npm run build              # esbuild bundle -> main.js
npm run lint               # eslint + prettier --check
npm test                   # vitest run: unit tests (pure core)
npm run test:integration   # converts fixtures (incl. the sample vault) and compiles
                           # the output; fails on any compile error
```

All tests must pass before marking work complete. A failing test may only be
skipped with an explicit `skip` marker and a linked issue; silently-red tests
are not acceptable.

Also run any manual smoke tests described in `docs/technical/tests.md` and
confirm that no source files were modified (compare hashes if in doubt).

---

## Documentation maintenance

When behaviour changes, update **all of** the following that are affected:

- The relevant `docs/user-stories/US-NNN-*.md` file and the index in `docs/user-stories/README.md`
- The relevant `docs/tickets/TICKET-NNN-*.md` file and the index in `docs/tickets/README.md`
- `docs/technical/dependencies.md`
- `docs/technical/tests.md` (AC-to-test map)

Keep them coherent with each other and with the implementation. Stale
documentation is treated as a bug.

---

## Versioning

- Bug fixes and minor changes: bump patch (`0.0.x`).
- New features: bump minor (`0.x.0`).
- Breaking changes: bump major (`x.0.0`).
- Version number must be consistent across all project manifests/config files.

### Release checklist

1. Confirm all tests pass (the full quality gate above).
2. Bump the version in all relevant files: `package.json`, `manifest.json`,
   and `versions.json` (Obsidian's plugin version map).
3. Write `releases/vX.Y.Z.md` containing:
   - Version number and release date.
   - Summary of new features, changed behaviour, and bug fixes.
   - Breaking changes and migration steps.
   - User stories and tickets addressed.
   - Test count (e.g. "360/360 tests passing").
4. Update `releases/RELEASES.md` to include the new version.
5. Create a tagged release in version control.
6. Attach the distributable artefacts to the release: `main.js`,
   `manifest.json`, and `styles.css` (if present).
