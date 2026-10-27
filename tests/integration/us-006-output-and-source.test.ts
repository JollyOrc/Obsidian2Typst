// US-006 — warning texts stay out of the document, the source stays untouched
// (integration, the sample note of US-024, real files in a temporary folder;
// `tests/fixtures` is the vault root, so the note is `sample/Book.md`). The end-to-end
// run through the pipeline is added with US-015.
import {createHash} from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {createAssetResolver} from '../../src/core/assets';
import {buildReport} from '../../src/core/report';
import {copyAssets} from '../../src/plugin/copy-assets';
import {
  DEFAULT_WARNING_SETTINGS,
  finishExport,
  type ExportHost,
} from '../../src/plugin/warning-flow';
import {blocks} from '../support/blocks';
import {readManifest} from '../support/sample';

/** The vault root on disk and the note's path in it (US-024). */
const ROOT = 'tests/fixtures';
const NOTE = 'sample/Book.md';
const md = readFileSync(join(ROOT, NOTE), 'utf8');

/** The first 16 bytes of every file below `dir`, by path below `root`. */
function heads(root: string, dir: string, out = new Map<string, Uint8Array>()) {
  for (const entry of readdirSync(join(root, dir), {withFileTypes: true})) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) heads(root, path, out);
    else out.set(path, readFileSync(join(root, path)).subarray(0, 16));
  }
  return out;
}

const tmp = mkdtempSync(join(tmpdir(), 'o2t-us006-'));
afterAll(() => rmSync(tmp, {recursive: true, force: true}));

/**
 * Every file below `dir`: size and modification time, and the SHA-256 of
 * the notes and of the files in `hashed`.
 */
function snapshot(
  dir: string,
  hashed: readonly string[] = [],
  base = dir,
  out = new Map<string, string>(),
) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      snapshot(path, hashed, base, out);
    } else {
      const stat = statSync(path);
      const digest =
        path.endsWith('.md') || hashed.includes(path)
          ? createHash('sha256').update(readFileSync(path)).digest('hex')
          : '';
      out.set(
        path.slice(base.length),
        `${stat.size}:${stat.mtimeMs}:${digest}`,
      );
    }
  }
  return out;
}

describe('US-006 AC-6 warnings stay out of the PDF', () => {
  const files = heads(ROOT, 'sample/assets');
  const resolver = createAssetResolver({notePath: NOTE, files});
  const real = blocks(md, {assets: resolver});

  it('US-006 AC-6: the sample note has warnings, and none of their texts or codes occurs in the .typ', () => {
    expect(real.warnings.length).toBeGreaterThan(10);
    for (const warning of real.warnings) {
      expect(real.typ.includes(warning.message), warning.message).toBe(false);
    }
    for (const code of new Set(real.warnings.map((x) => x.code))) {
      expect(real.typ.includes(code), code).toBe(false);
    }
    expect(real.typ.includes('Export warnings')).toBe(false);
    expect(real.typ.includes(buildReport(real.warnings).split('\n')[2]!)).toBe(
      false,
    );
  });

  it('US-006 AC-6: only the defined placeholder appears for a missing image, not its warning text', () => {
    const none = createAssetResolver({notePath: NOTE, files: new Map()});
    const out = blocks(md, {assets: none});
    const missing = out.warnings.filter((x) => x.code === 'ASSET_MISSING');
    // Every placed image: the markdown images and the image embeds.
    const {images, features} = readManifest();
    const placed = images.total + (features['embed:image'] ?? 0);
    expect(missing).toHaveLength(placed);
    expect(out.typ.match(/Missing image: /g)).toHaveLength(placed);
    for (const warning of missing) {
      expect(out.typ.includes(warning.message), warning.message).toBe(false);
    }
    expect(out.typ.includes('ASSET_MISSING')).toBe(false);
  });
});

describe('US-006 AC-7 the source stays untouched (real files)', () => {
  /** A host that writes real files below `root`. */
  const host = (root: string, notices: string[]): ExportHost => {
    const write = (path: string, text: string) => {
      mkdirSync(dirname(join(root, path)), {recursive: true});
      writeFileSync(join(root, path), text);
    };
    return {
      notice: (text) => notices.push(text),
      writeExportFile: async (path, text) => write(path, text),
      writeVaultFile: async (path, text) => write(path, text),
    };
  };

  it('US-006 AC-7: leaves the source note, its folder and all source assets byte-identical after an export (hash check)', async () => {
    // The source is the sample folder; everything the export writes goes
    // below a temporary folder. Three assets are copied; the rest is listed.
    const vault = join(tmp, 'vault');
    const resolver = createAssetResolver({
      notePath: NOTE,
      files: heads(ROOT, 'sample/assets'),
    });
    const out = blocks(md, {assets: resolver});
    const copied = resolver
      .uses()
      .slice(0, 3)
      .map((use) => join(ROOT, use.from));
    expect(copied).toHaveLength(3);
    const before = snapshot(join(ROOT, 'sample'), copied);
    expect(before.size).toBeGreaterThan(60);

    const notices: string[] = [];
    const exportDir = 'Export/run1';
    const fs = {
      read: async (path: string) =>
        new Uint8Array(readFileSync(join(ROOT, path))),
      write: async (path: string, data: Uint8Array) => {
        mkdirSync(dirname(join(vault, path)), {recursive: true});
        writeFileSync(join(vault, path), data);
      },
    };
    const result = await finishExport({
      warnings: out.warnings,
      source: {path: NOTE, inVault: true},
      exportDir,
      settings: {...DEFAULT_WARNING_SETTINGS, warningsNoteFolder: 'Reports'},
      host: host(vault, notices),
      writeOutput: async () => {
        mkdirSync(vault, {recursive: true});
        writeFileSync(join(vault, 'out.typ'), out.typ);
        await copyAssets(resolver.uses().slice(0, 3), fs, exportDir);
      },
    });

    expect(result).toEqual({aborted: false});
    expect(snapshot(join(ROOT, 'sample'), copied)).toEqual(before);
    // The three copies arrived (the other side of "untouched", SCAR-023).
    for (const use of resolver.uses().slice(0, 3)) {
      expect(readFileSync(join(vault, exportDir, use.to))).toEqual(
        readFileSync(join(ROOT, use.from)),
      );
    }
    expect(
      readFileSync(join(vault, exportDir, 'export-warnings.md'), 'utf8'),
    ).toBe(buildReport(out.warnings));
    expect(
      readFileSync(join(vault, 'Reports/Book export warnings.md'), 'utf8'),
    ).toContain('obsidian://obsidian2typst-goto?file=sample%2FBook.md&line=');
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(
      /^Exported with \d+ warnings\. Report: Export\/run1\/export-warnings\.md$/,
    );
  });

  it('US-006 AC-4: leaves the export folder exactly as it was in a strict-mode abort (real files)', async () => {
    const vault = join(tmp, 'strict');
    mkdirSync(join(vault, 'Export/run1'), {recursive: true});
    writeFileSync(join(vault, 'Export/run1/old.typ'), 'old');
    writeFileSync(join(vault, 'Export/run1/export-warnings.md'), 'stale');
    const before = snapshot(vault);
    const out = blocks(md);
    const notices: string[] = [];
    let called = false;
    const result = await finishExport({
      warnings: out.warnings,
      source: {path: NOTE, inVault: true},
      exportDir: 'Export/run1',
      settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
      host: host(vault, notices),
      writeOutput: async () => {
        called = true;
      },
    });
    expect(result).toEqual({aborted: true});
    expect(called).toBe(false);
    expect(snapshot(vault)).toEqual(before);
    expect(notices[0]).toMatch(
      /^Export aborted: \d+ warnings \(strict mode\)\n(line \d+: [A-Z_]+\n?){1,5}$/,
    );
  });
});
