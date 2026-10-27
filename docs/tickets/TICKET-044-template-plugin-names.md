# TICKET-044 — Template names the plugin defines: `PLUGIN_NAMES`, `TEMPLATE_NAME_TAKEN`

**Status:** Done
**User story:** [US-016](../user-stories/US-016-callout-styles.md)
**ACs addressed:** AC-11 (template part, decided by the user 2026-10-18)
**Depends on:** TICKET-043 (the preamble defines `callout` and `callout-styles`)
**SCARs:** SCAR-017 (the class includes `fit-image`), SCAR-001 (`scanTemplate` changes its contract), SCAR-006

---

## Description

The plugin's helpers are defined after the template import, so they replace a
template's definition of the same name without a word. Report it, for every
helper the preamble defines, `fit-image` of US-003 included.

---

## Acceptance criteria (from user story)

- **AC-11 (template part):** each top-level definition of `fit-image`,
  `callout` or `callout-styles` in the template gives, on every export,
  `TEMPLATE_NAME_TAKEN  Template line 3 defines "callout", which the plugin also defines; the plugin's definition is used`
  at line 0. The names are one list (`PLUGIN_NAMES`); a text check shows every
  `#let` of the preamble defines a name of that list.

---

## Implementation notes

- `src/core/template/plugin-names.ts`: `PLUGIN_NAMES = ['callout',
  'callout-styles', 'fit-image']`, exported from `core/template`. It sits in
  `core/template` because the check is about templates; `emit` does not
  import it (the text check over the preamble ties the two together).
- `scanTemplate` today returns only standard-library names. Change it to
  return every top-level definition (`{line, name}`), and let
  `templateWarnings` decide: a name in `STD_NAMES` → `TEMPLATE_SHADOWS_BUILTIN`
  (unchanged wording), a name in `PLUGIN_NAMES` → `TEMPLATE_NAME_TAKEN`, in
  line order. Grep every caller of `scanTemplate` (SCAR-001) and list it in the
  result with the decision; the US-008 tests that call it are the guard.
- `docs/technical/warning-codes.md`: row `TEMPLATE_NAME_TAKEN` (US-016 AC-11),
  `active`.
- The template is scanned on every export (US-008 AC-10); the warning comes
  whether or not the note uses the helper.

---

## Tests

- `tests/unit/us-016-callouts-convert.test.ts` — group `US-016 AC-11 names the
  plugin defines (template)` (4 tests) and the registry test of AC-10 for
  `TEMPLATE_NAME_TAKEN`.
- Guard: `tests/unit/us-008-presets.test.ts` template tests and
  `tests/integration/us-008-typst-facts.test.ts` (`STD_NAMES` against the
  compiler) unchanged and green.
- Mutation checks: `fit-image` missing from the list; line order lost when
  both kinds occur; `scanTemplate` still filtering by `STD_NAMES`.

---

## SCAR check (2026-10-18, item by item against the Prevention lists)

- **SCAR-001:** `scanTemplate` is a shared function whose transform changes
  (filter moves to the caller). Its comment lists the new contract; every
  caller is listed in the result; the BOM and line-number rules stay and stay
  tested.
- **SCAR-002:** a template with both a built-in and a plugin name is tested.
- **SCAR-003:** the AC part has named tests.
- **SCAR-006:** pass counts recorded.
- **SCAR-007:** the message is given verbatim with a line.
- **SCAR-008, SCAR-009, SCAR-010:** n/a.
- **SCAR-011:** this ticket is the name clash check between plugin names and
  the template's names.
- **SCAR-012, SCAR-013, SCAR-014, SCAR-016:** n/a.
- **SCAR-015:** n/a (a warning, not output content).
- **SCAR-017:** the class is "every name a preamble rule defines"; the text
  check fails when a new `#let` appears in the preamble without a
  `PLUGIN_NAMES` entry.

---

## Definition of done

- [x] Tests named above green; US-008 template tests and Typst facts green
- [x] Caller list of `scanTemplate` in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)


## Result (2026-10-18)

New: `src/core/template/plugin-names.ts` (`PLUGIN_NAMES`). Changed: `scan.ts`,
`warnings.ts`, `index.ts`; `docs/technical/warning-codes.md` row
`TEMPLATE_NAME_TAKEN` (active).

- **Deviation from the implementation notes (SCAR-001):** the notes said to
  change `scanTemplate` to return every definition. The US-008 tests rely on
  its contract (only standard-library names; `#let quoted` gives `[]`). So the
  function was split instead of changed: `scanDefinitions` returns every
  top-level definition; `scanTemplate` is that list filtered by `STD_NAMES`,
  unchanged for its callers; `templateWarnings` uses `scanDefinitions`.
- Callers (grep): `src/plugin/prepare-note.ts` (`templateWarnings`, the only
  production caller; gains the new warning, nothing else changes);
  `tests/unit/us-008-presets.test.ts` (`scanTemplate`, `templateWarnings`:
  unchanged and green); `tests/unit/us-016-callouts-convert.test.ts`.
- Test refined: the SCAR-017 writer check now looks for `#callout(` and
  `#let callout-styles` (writing Typst), because `plugin-names.ts` holds the
  name `callout-styles` as data.
- Gate: typecheck, lint, build green; `npm test` 1491 passed, 1 todo;
  integration 273 passed, 1 skipped (`build-output` green again).
- Mutants: 5, all caught (`fit-image` missing from the list, scan still
  filtering, line order lost, message shortened, `fit-image` not reported);
  checksummed restores (`shasum -c` OK).
