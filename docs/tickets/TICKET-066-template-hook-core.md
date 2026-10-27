# TICKET-066 — The template hook and the warning for top-level rules (core)

**Status:** Done (2026-10-22)
**User story:** [US-023](../user-stories/US-023-templates-that-style-the-document.md)
**ACs addressed:** AC-1, AC-2 (the core), AC-3, AC-4, AC-5, AC-6, AC-8, AC-10
**Depends on:** —
**SCARs:** SCAR-001, SCAR-002, SCAR-007, SCAR-008, SCAR-010, SCAR-017, SCAR-018, SCAR-019, SCAR-021, SCAR-023

---

## Description

The pure core of US-023: recognise a template that defines `template`, write
`#show: template` right after the template import, and warn about top-level
`#set` and `#show` rules in a template. Correct US-008 AC-9.

---

## Acceptance criteria (from user story)

- **AC-1, AC-2:** a top-level `#let template` (the definition scan's rules)
  defines the hook; with the template present and the hook, the line after
  the import is `#show: template`; otherwise nothing changes.
- **AC-3, AC-4, AC-8:** the PDF facts follow from the line's place (measured).
- **AC-5:** `TEMPLATE_RULE_IGNORED`, `Template rule at line N does not apply;
  put it inside template(doc)`, line 0, for `#set`/`#show` at line start.
- **AC-6:** `template` is no built-in and no plugin name; the preamble never
  defines it.
- **AC-10:** US-008 AC-9 corrected.

---

## Implementation notes

- `src/core/template/scan.ts`: `definesTemplateHook(template)` = a top-level
  definition named `template` among `scanDefinitions(template)` (one scan,
  SCAR-017); exported from `core/template/index.ts`.
- `src/core/template/warnings.ts`: `templateWarnings` also reports each line
  that matches `^#(set|show)` not followed by a name character (`[\p{L}\p{N}_-]`),
  after the same byte-order-mark rule as the definition scan; all warnings in
  line order (a line is either a definition or a rule).
- `src/core/convert/types.ts`: `ConvertSettings.templateHook?: boolean` (true
  when the template copy defines the hook; set by the plugin, TICKET-067).
- `src/core/convert/preamble.ts`: the existing rule `template-import` renders
  the import and, when `templateHook` is true, `#show: template` on the next
  line — no new preamble rule, so the rule list of US-015 AC-2 stays as it is.
- `docs/technical/warning-codes.md`: the row `TEMPLATE_RULE_IGNORED` (US-023
  AC-5, active, the content-block case of decision 1).
- `docs/user-stories/US-008-presets-and-settings.md` AC-9: "so the template's
  functions and rules are available" becomes "so the template's definitions
  are available; its rules apply through `template(doc)` (US-023)".
- Register (`docs/user-stories/README.md`): the rows "Template scan" (the hook
  and the rule scan, their transforms) and the preamble's `template-import`.

### Guards searched before the ticket (SCAR-023)

- `tests/unit/us-015-conversion-pipeline.test.ts` "with a template the import
  line is line 2": sets `template: true` without the hook flag, so the three
  first lines stay `[header, import, page]`; not affected.
- The same file pins the `[id, order]` list of `PREAMBLE_RULES`: the hook is
  rendered by the existing rule, so the list stays.
- `tests/unit/us-015-warning-registry.test.ts`, `tests/plugin/us-006-export-flow.test.ts`:
  every code in the sources needs its row; the row is part of this ticket.
- `tests/unit/us-008-presets.test.ts` (AC-10, no shadowing): narrowed at G2.

---

## Tests

- `tests/unit/us-023-template-hook.test.ts` (all).
- `tests/integration/us-023-template-hook-pdf.test.ts` (all: the settings set
  the hook flag directly, so the PDF facts need only this ticket).
- US-008, US-015, US-016, US-017 template and preamble tests stay green.
- Mutation checks (SCAR-018): the hook written without the template; the
  hook after the page rule; the hook twice; `#let templates` taken for the
  hook; the rule warning for `#showcase`; an indented rule warned; the line
  number off by one after a byte-order mark; the warnings out of line order;
  the message text changed.

---

## SCAR check (2026-10-22, item by item against the Prevention lists)

- **SCAR-001** (1) the scan's transforms listed in its register row (BOM,
  line start, name characters); (2) the definition scan read for the new use:
  fits; (3) no flag: a second function for the hook; (4) edge inputs: BOM,
  `\r\n`, `#let templates`, `#letemplate`.
- **SCAR-002** (1–5) composed: the hook with every preamble rule (the
  composed note of US-015), with page furniture, callouts, glossary, cover,
  page refs (integration AC-8); checked against US-008, US-015, US-016,
  US-019.
- **SCAR-003** (1) red tests exist (G2); (2) the AC list read again; (3) map.
- **SCAR-006** (1–4) full gate, no skip, counts in the result, TICKET-067 and
  TICKET-068 tracked.
- **SCAR-007** (1–3) exact lines and message in the tests.
- **SCAR-008** (1) the Typst facts measured with the compiler (import scope,
  `#show:` placement); (2) no blank result accepted: fills and shadings read
  by program; (3) by program; (4) n/a (no canvas); (5) n/a; (6) moved items
  are SCAR-020 to 022.
- **SCAR-009** (1–4) the hook line's position (line 3) and the rule scan at
  first line, last line without newline, after a BOM.
- **SCAR-010** (1) the join of the hook line with the import and the page rule
  is a line break: tested; (2–5) n/a (no inline concatenation); (6) pointer.
- **SCAR-011** n/a (no generated names).
- **SCAR-012** n/a here (TICKET-068).
- **SCAR-013, SCAR-014** n/a (no dialog, no write into the vault).
- **SCAR-015** (1) AC-8 asserts the content; (2) guard: no hook, no colours;
  (3–5) M13 in TICKET-068.
- **SCAR-016** n/a (no control).
- **SCAR-017** (1) grep of every template reader and writer (story); (2) the
  rule for the class in the story; (3) one scan, one preamble rule; (4) n/a;
  (5) n/a; (6) pointer; (7) applies.
- **SCAR-018** (1–8) backups of `scan.ts`, `warnings.ts`, `preamble.ts`,
  `types.ts` by full path with checksums, checked restores, one match per
  edit, arrays, baseline in the run, survivors read as inputs first
  (SCAR-023).
- **SCAR-019** (1–5) the hook flag on and off, the template present and
  absent; the preset sources in TICKET-067.
- **SCAR-020** (1–3) the two placements were measured before they were
  offered (G0).
- **SCAR-021** (1–3) the template's rules read no layout; the running title
  (layout-dependent) measured with the hook (AC-3, AC-8).
- **SCAR-022** n/a (no callback).
- **SCAR-023** (1) each test states its criterion; (2) the AC-8 test counts
  shadings and pages; (3) whole lines compared (`lines[2]`, the full message);
  (4) inputs the real scan gives; (5) guards searched (above); (6) the
  mutation run; (7) applies.

---

## Definition of done

- [x] Tests named above green; US-008, US-015 to US-019 green
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Register rows, the warning-codes row and US-008 AC-9 updated

---

## Result (2026-10-22)

Changed: `src/core/template/scan.ts` (`definesTemplateHook`),
`src/core/template/index.ts` (export), `src/core/template/warnings.ts` (the
rule scan, `TEMPLATE_RULE_IGNORED`, every template warning carries its line
and the list is sorted by it), `src/core/convert/types.ts`
(`ConvertSettings.templateHook`), `src/core/convert/preamble.ts` (the hook in
the existing rule `template-import`; the rule list of US-015 AC-2 is
unchanged); `docs/technical/warning-codes.md` (row); US-008 AC-9 corrected.
Register rows "Template scan" and "Conversion pipeline".

- Gate (scratchpad `gate066.log`): typecheck, build (`main.js` sha256
  `d68320c1ac22…`), lint green; `npm test` 1771 passed, 4 failed, 1 todo;
  integration 380 passed, 1 skipped (all 10 US-023 PDF tests green). The 4
  red tests are TICKET-067's (`tests/plugin/us-023-template-hook-preview.test.ts`:
  the hook from the preset, from the Defaults, the preview, the edited
  template); the plugin's warning test is green already (the warning is in the
  core).
- AC → tests: AC-1 to AC-6, AC-8, AC-10 in the unit and integration files —
  green.
- Changed while coding: the first draft read a definition warning's line back
  out of its message text to sort; replaced by carrying the line with every
  warning.
- Tests added while coding (after the first mutation run): an indented
  `  #set` inside a content block gets no warning; a rule on line 1 after a
  byte-order mark keeps line 1; a rule before a definition comes first.
- Mutants (scratchpad `mut066/run.py`; US-023 unit and integration, US-008,
  US-015, US-016, US-017 tests; final baseline 0 failed, 238 passed): 11,
  all caught — the hook without a template; the hook flag ignored; the hook
  before the import; the hook twice; `templates` taken for the hook;
  `#showcase` warned; an indented rule warned; the byte-order mark kept in the
  rule scan; the warnings not sorted by line; the line number off by one; the
  message text changed. First run: 3 survivors (the last three of the inputs
  above did not exist), read as inputs that could not reach the rule and
  closed by the three tests. Backups by full path, `shasum -a 256 -c` after
  every restore and at the end: four files OK.
- SCAR-017 grep after the code: `templateHook` in `convert/types.ts` and
  `convert/preamble.ts` only (TICKET-067 adds the one writer);
  `definesTemplateHook(` in the core and the tests.
