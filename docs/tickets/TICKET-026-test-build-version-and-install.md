# TICKET-026 — Unique version for every test build and an install script

**Status:** Done
**User story:** — (process; SCAR-012)
**ACs addressed:** none; SCAR-012 prevention
**Depends on:** TICKET-024

---

## Description

A test build must be recognisable and must reach the place where the human runs
it without hand work. Every build handed over for a manual check gets its own
version, shown in Obsidian's plugin list, at the top of the settings tab and in
the check text; a script installs the build into the scratch vault and proves
by checksum that the installed file is the fresh one.

---

## Implementation notes

- Scheme: `<x.y.z>-<check>.<n>`, for example `0.1.0-m3.1`; `n` counts up with
  every build handed over for that check; a release has a plain `x.y.z`.
  `manifest.json` and `package.json` carry the same value (`versions.json` is
  for releases and is left alone).
- **Settings tab:** first line `Obsidian2Typst <version>` from
  `plugin.manifest.version`, so the running code reports the manifest it was
  loaded with.
- **`build/install-scratch.mjs`** (`npm run install:scratch`): builds, copies
  `main.js` and `manifest.json` to
  `spikes/typst-wasm/scratch-vault/.obsidian/plugins/obsidian2typst/`, compares
  SHA-256 of source and copy, prints version and checksum. Exported function
  `installBuild({from, to})` is tested with temporary folders.
- `docs/technical/manual-checks.md`: M2 and M3 start with `Expected version`
  and `Run in the scratch vault`; a test keeps the version in M3 equal to the
  manifest.
- CLAUDE.md handover rule already added with SCAR-012.

---

## Tests

- `tests/tooling/us-000-test-build-version.test.ts` — manifest equals package
  version and has the test-build shape or a plain release; M3 names that
  version; the tab prints the manifest version; `installBuild` copies,
  verifies and fails on a mismatch.

---

## Definition of done

- [ ] All listed tests pass.
- [ ] Full quality gate passes.
- [ ] Build installed with the script; checksum printed in the handover.
- [ ] Ticket status set to `Done` in `docs/tickets/README.md`.

---

## Implementation result

`build/install-scratch.mjs` (`npm run install:scratch`: type check, build, copy,
SHA-256 comparison), version `0.1.0-m3.1` in `manifest.json`, `package.json`
and `package-lock.json`, version line in the settings tab, `Expected version`
and `Run in the scratch vault` in M2 and M3. The developer also prepares the M3
fixtures (note, assets, template, empty export folder, clean presets) before
the handover.
