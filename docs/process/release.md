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
5. Create a tagged release in version control.
6. Attach the distributable artefacts to the release: `main.js`,
   `manifest.json`, and `styles.css` (if present).
