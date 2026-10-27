# TICKET-003 — Quality gate: `build` and `lint` scripts

**Status:** Done
**User story:** none (tooling; completes the quality gate of `docs/technical/tests.md`)
**ACs addressed:** none

---

## Description

Add the two missing gate commands: `npm run build` (esbuild bundle of the plugin to `main.js`, plus `manifest.json` and `versions.json`) and `npm run lint` (ESLint with `typescript-eslint`, and `prettier --check`). The lint setup also enforces the architecture rule of `CLAUDE.md`: `src/core/**` imports nothing from Obsidian or Node.

---

## Acceptance criteria

Not from a user story. The ticket is done when:

1. `npm run build` writes `main.js` (CommonJS, `obsidian` and Electron left external, source maps off, minify off for the first release) from `src/plugin/main.ts`, and fails on a TypeScript error (`tsc --noEmit` runs first).
2. `npm run lint` fails on (a) an unused variable, (b) an `import ... from 'obsidian'` or `node:*` inside `src/core/`, (c) a file that Prettier would change. It passes on the current code.
3. `manifest.json` has the fields Obsidian requires and `isDesktopOnly: true` (US-007 AC-8); `versions.json` maps the version to `minAppVersion`.
4. `docs/technical/tests.md` and `CLAUDE.md` no longer call the two commands "planned".

---

## Implementation notes

- Style: Prettier set to the Google TypeScript style choices (single quotes, no bracket spacing, 80 columns, trailing commas). ESLint uses `typescript-eslint` recommended rules. The full Google lint package (`gts`) is not used.
- Versions are pinned exactly (see `docs/technical/dependencies.md`).
- The plugin entry is a minimal `Plugin` subclass that does nothing yet; it exists so the bundle has an entry point.

---

## Tests

- `tests/integration/build-output.test.ts` — runs the build and checks `main.js`, `manifest.json`, `versions.json` (criteria 1, 3).
- `tests/tooling/lint-rules.test.ts` — runs ESLint on small in-memory sources and checks criterion 2 (a), (b).

---

## Definition of done

- [x] All listed tests pass.
- [x] Full quality gate passes (`typecheck`, `lint`, `build`, `test`, `test:integration`).
- [x] `docs/technical/tests.md`, `CLAUDE.md`, `dependencies.md` updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
