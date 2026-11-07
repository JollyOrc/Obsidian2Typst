# Versioning and release checklist

Moved from `CLAUDE.md` on 2026-11-01, unchanged.

- Bug fixes and minor changes: bump patch (`0.0.x`).
- New features: bump minor (`0.x.0`).
- Breaking changes: bump major (`x.0.0`).
- Version number must be consistent across all project manifests/config files.

## Release checklist

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
5. Commit, then build the release files with `npm run release:build`
   (`build/release.mjs`, added 2026-11-07). It checks the versions (a
   release `x.y.z`, `versions.json`, the notes with a release date, the
   `RELEASES.md` row) and refuses uncommitted changes; clones `HEAD` into a
   temporary folder, runs `npm ci` and the full gate there, builds `main.js`,
   and writes `dist/release/<x.y.z>/`: `main.js`, `manifest.json`,
   `styles.css`, `LICENSE`, `THIRD_PARTY_NOTICES.md`,
   `artefact-v<x.y.z>.zip` of those five (the same files give the same
   zip), `SHA256SUMS.txt` and `notes.md`. `node build/release.mjs` alone
   builds from the working tree without the gate, for a try;
   `--test-build` accepts a test build's version.
6. Create an annotated tag `x.y.z` on the release commit and push the
   branch and the tag.
7. Publish with the `gh release create …` command the script prints (all
   six files attached, the notes from `notes.md`). The script itself never
   tags, pushes or publishes.
