// US-042 AC-2, AC-3, AC-7, AC-11, AC-12 — the wiring in `main.ts` and the export
// host, which no unit test reaches (Obsidian's app): text checks, as the US-020
// wiring tests do. What they cannot show (the tab in front or behind, the
// clipboard) is checked by hand (AC-15). Source of truth:
// docs/user-stories/US-042-ui-standard.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const main = readFileSync('src/plugin/main.ts', 'utf8');
const host = readFileSync('src/plugin/obsidian/export-host.ts', 'utf8');

describe('US-042: main.ts', () => {
  it("AC-3: the export dialog is the command's dialog", () => {
    expect(main).toMatch(
      /exportDialog:\s*\(?[^)]*\)?\s*=>[\s\S]{0,400}new ExportDialog\(/,
    );
  });

  it('AC-7: the progress starts with a delay of 2000 ms and opens its own view', () => {
    expect(main).toMatch(/startProgress:[\s\S]{0,400}createExportProgress\(/);
    expect(main).toMatch(/delayMs:\s*2000/);
    expect(main).toMatch(/registerView\(\s*VIEW_TYPE_EXPORT_PROGRESS\b/);
  });

  it('AC-7, M32: the tab opens in the background, a used tab is reused (P5)', () => {
    expect(main).toMatch(
      /setViewState\(\{\s*type:\s*VIEW_TYPE_EXPORT_PROGRESS,\s*active:\s*false/,
    );
    expect(main).toMatch(
      /getLeavesOfType\(\s*VIEW_TYPE_EXPORT_PROGRESS\s*,?\s*\)/,
    ); // Tightened at T4 (#178; SCAR-023): the open tab found is the one used.
    expect(main).toMatch(
      /const (\w+) = this\.app\.workspace\.getLeavesOfType\(\s*VIEW_TYPE_EXPORT_PROGRESS,?\s*\)\[0\];[\s\S]{0,80}\1 \?\? this\.app\.workspace\.getLeaf\('tab'\)/,
    );
  });

  it('AC-12: the debug info is gathered and copied, then a notice', () => {
    expect(main).toMatch(/copyDebugInfo:[\s\S]{0,600}debugInfo\(/);
    expect(main).toMatch(/navigator\.clipboard\.writeText\(/);
    // Tightened at T5 (SCAR-023): the settings file is read, and the notice
    // follows the copy.
    expect(main).toMatch(
      /settingsText:\s*\(await adapter\.exists\(file\)\)\s*\?\s*await adapter\.read\(file\)/,
    );
    expect(main).toMatch(
      /navigator\.clipboard\.writeText\(text\);\s*new Notice\(STRINGS\.notices\.debugInfoCopied/,
    );
  });
});

describe('US-042 AC-11: notices last 5 s', () => {
  it('the export host shows its notices for 5000 ms', () => {
    expect(host).toMatch(/new Notice\(text,\s*5000\)/);
  });
});
