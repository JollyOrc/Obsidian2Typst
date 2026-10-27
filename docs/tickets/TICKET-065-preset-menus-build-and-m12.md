# TICKET-065 — Test build `0.8.0-m12.1`, manual check M12 (heading and image menus)

**Status:** Done (2026-10-22, M12 passed)
**User story:** [US-022](../user-stories/US-022-heading-and-image-menus.md)
**ACs addressed:** AC-11, AC-12 (manual); by eye AC-1, AC-3, AC-5 to AC-8
**Depends on:** TICKET-062, TICKET-063, TICKET-064
**SCARs:** SCAR-012, SCAR-013, SCAR-014, SCAR-015, SCAR-016, SCAR-017, SCAR-006, SCAR-008, SCAR-018, SCAR-019

---

## Description

Hand a ready test environment to the user for what only Obsidian can show:
the items on heading and image lines and on image files, the question, the
changed preset note, the screens following, and whether a right-click moves
the cursor (AC-11).

---

## Acceptance criteria (from user story)

- **AC-11:** whether a right-click moves the cursor; the question names the
  heading or image.
- **AC-12:** each item on the lines of AC-1 and AC-3 and on an image file,
  the question's texts and keys, the change in the preset note, the pop-up
  and the panel following, an invalid active preset, the open question.

---

## Implementation notes

- Version `0.8.0-m12.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` gains `"0.8.0": "1.5.0"`;
  M3, M6 to M11 name the current version; the version test checks M12.
- Fixtures in `spikes/typst-wasm/scratch-vault/` only: a note `Menus.md` with
  the lines of AC-1 and AC-3 (a heading `# Glossar`, `# Glossary` with a
  term, a callout heading, a line with two images, a remote image); the
  active preset backed up by full path with a checksum before M12 (it will be
  changed by the check itself, by the plugin, after the user's `Change
  preset`); `data.json` only with Obsidian closed.
- Steps of M12 (written out in the file): version and preset; the editor
  menu on each line (items and titles), whether the cursor moves to the
  right-clicked line; the question (Escape, Enter on `Cancel`, `Cancel`
  writes nothing); `Change preset` and the preset note opened (the key and
  its neighbours as in AC-2/AC-4); the notice; the pop-up of US-021 and the
  panel following; `Stop using …`; an image file in the file explorer; an
  invalid active preset; the open question.
- Every expectation traced to a test or computed from the fixture with the
  real functions; the preset note restored from the backup after M12 when
  the user asks.

---

## Tests

- `tests/tooling/us-000-test-build-version.test.ts` — M12 names the current
  version.
- The full gate.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** n/a.
- **SCAR-002** (1–3) the fixture note composes every line kind; (4–5) n/a.
- **SCAR-003** (1) version test; (2) AC-11, AC-12 gone through; (3) table.
- **SCAR-006** (1–4) gate, no skip, counts, nothing deferred.
- **SCAR-007** (1) M12 states the exact titles, questions and note texts.
- **SCAR-008** (1–3) the right-click line is measured here and reported;
  (4) n/a; (5) a result per step; (6–7) n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a.
- **SCAR-012** (1) build installed and compared, fixtures and backups in
  place, `data.json` with Obsidian closed; (2) place and restart stated;
  (3) unique version `0.8.0-m12.1` first; (4) mismatch = wrong build; (5) n/a.
- **SCAR-013** (1–4) the question with the keyboard; (5–6) n/a.
- **SCAR-014** (1–5) `Cancel` first, then `Change preset`; the worst
  misplaced click (an item on another line) checked against the question
  text; (6) n/a.
- **SCAR-015** (1) every step names what must be seen; (2) guard: `Cancel`
  leaves the note byte for byte; (3) open question last; (4) known
  limitations stated; (5) the note text written out.
- **SCAR-016** (1–6) the panel and the pop-up stay open while the preset
  changes; (7) every screen named; (8) n/a.
- **SCAR-017** (1) n/a; (2–3) text checks; (4) a defect is answered with the
  class (every item, every writer); (5–7) n/a.
- **SCAR-018** (1) the active preset note backed up by full path with a
  checksum before M12; (2) checked on restore; (3–7) n/a.
- **SCAR-019** (1) the active preset valid and invalid; (2–4) every preset
  the check uses listed.

---

## Definition of done

- [x] Version test extended and green
- [x] Full gate green with counts; installed build compared by checksum
- [x] M12 written, fixtures and backups in place, every expectation traced
- [x] G4 entry before the handover; M12 passed by the user; run line recorded

---

## Handover (2026-10-22)

- Version `0.8.0-m12.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`, M3 and M6 to M12; `versions.json` gained
  `"0.8.0": "1.5.0"`. The version test names M12 (red before M12 was
  written, green after).
- Gate (scratchpad `gate065.log`): typecheck, build, lint green; `npm test`
  1752 passed, 1 todo; integration 370 passed, 1 skipped. `npm run
  install:scratch`: installed `main.js` and `manifest.json` identical to the
  fresh build (sha256 `057a331ab903…`, `f0e08323ee4c…`).
- Fixtures (Obsidian closed, checked with `pgrep`): `Menus.md` and
  `Menus/m12-broken.png` in the scratch vault. Images chosen with a unique
  name in the vault (`wide.png`, `quill.png`): `glowcat.jpg` and the other
  `reference/assets` images exist twice (a copy in `The Rules/assets`).
- Backup: `spikes/typst-wasm/m12-state-backup/Obsidian2Typst/presets/
  Folios.md` with `SHA256SUMS` (also `data.json`), both OK after the install.
- Expectations computed with the plugin's own functions (scratch probe
  `p065/probe.test.ts`: `lineContext`, `presetEditEntries`,
  `imageFileEntries`, `editPresetField`, `detailRows`) over the vault's real
  files; panel texts from `src/plugin/preview/panel.ts` `coverRows`.
- Not checkable by hand (stated in M12): an image deleted or replaced after
  the menu opened; the active preset switched while the question is open.

## Result (2026-10-22)

M12 passed, all steps 1 to 14 (reported by the user); run line in
`docs/technical/spike-typst-wasm.md`, section "Manual runs". Step 3
(AC-11): a right-click does not move the cursor (reported by the user).
After the run `Folios.md` differed from its backup (a cover file and a `Glossar` rule, written after the steps that
leave it as S0); restored from the backup on the user's request, checksum
OK.
