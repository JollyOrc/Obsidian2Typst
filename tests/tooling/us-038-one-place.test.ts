// US-038 AC-16, AC-17 — one model, one scan, one name; the documents and
// registries the story names. Text checks match the whole statement they
// guard (SCAR-023) and state how many places they checked.
// Source of truth: docs/user-stories/US-038-detail-rows.md.
// Red until US-038 is implemented (G2, 2026-11-09).
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? sources(path)
      : path.endsWith('.ts')
        ? [path]
        : [];
  });
}
const SRC = sources('src');
const read = (f: string): string => readFileSync(f, 'utf8');

describe('US-038 AC-16 one place for the language, the model and the scan', () => {
  it('US-038 AC-16: the language name o2t-details is written in src/core/markers/details.ts and in main.ts only (the registration line)', () => {
    const files = SRC.filter((f) => read(f).includes('o2t-details'));
    expect(SRC.length).toBeGreaterThan(50);
    // the Typst helper `o2t-details` and the plugin-names registry write the
    // name of a different thing (the helper); they are the emitter and the registry
    const language = files.filter(
      (f) =>
        ![
          'src/core/emit/details.ts',
          'src/core/template/plugin-names.ts',
          'src/core/convert/index.ts',
        ].includes(f),
    );
    expect(language.sort()).toEqual([
      'src/core/markers/details.ts',
      'src/plugin/main.ts',
    ]);
    expect(read('src/core/markers/details.ts')).toContain(
      "export const DETAILS_BLOCK_LANG = 'o2t-details';",
    );
  });

  it('US-038 AC-16: only the two scans read a code node with an o2t- language', () => {
    const readers = SRC.filter((f) =>
      /\.lang\s*===\s*(ENTRY_BLOCK_LANG|DETAILS_BLOCK_LANG)/.test(read(f)),
    );
    expect(readers.sort()).toEqual([
      'src/core/markers/details.ts',
      'src/core/markers/entries.ts',
    ]);
  });

  it('US-038 AC-16: value matching, key matching and the unmapped and not-text checks live in the model only', () => {
    const model = read('src/core/details/model.ts');
    expect(model).toContain("code: 'DETAIL_VALUE_UNMAPPED'");
    expect(model).toContain("code: 'DETAIL_VALUE_NOT_TEXT'");
    expect(model).toContain('.trim().toLowerCase()');
    const others = SRC.filter(
      (f) =>
        f !== 'src/core/details/model.ts' &&
        /DETAIL_VALUE_(UNMAPPED|NOT_TEXT)/.test(read(f)),
    );
    // the other files print the code the model gives (`check.code`)
    expect(others).toEqual([]);
  });

  it('US-038 AC-16: the PDF emitter, the processor and the API all call detailsModel', () => {
    const callers = SRC.filter((f) => /\bdetailsModel\(/.test(read(f)));
    expect(callers.sort()).toEqual([
      'src/core/convert/index.ts',
      'src/core/details/model.ts',
      'src/plugin/details/processor.ts',
    ]);
    const proc = read('src/plugin/details/processor.ts');
    expect(proc.match(/\bdetailsModel\(/g)).toHaveLength(2);
  });

  it('US-038 AC-16: main.ts hands over only (no model, no scan)', () => {
    const main = read('src/plugin/main.ts');
    expect(main).not.toMatch(/detailsModel|scanDetailsBlocks|readDetailsBlock/);
  });

  it('US-038 AC-16: the plugin names list the helper and the icon helper', () => {
    const names = read('src/core/template/plugin-names.ts');
    expect(names).toContain("'o2t-details'");
    expect(names).toContain("'o2t-detail-icon'");
  });
});

describe('US-038 AC-17 documentation', () => {
  it('US-038 AC-17: the contract, the manual page and the story exist and are linked', () => {
    for (const f of [
      'docs/technical/details-block.md',
      'docs/user-stories/US-038-detail-rows.md',
      'manual/details.md',
    ]) {
      expect(existsSync(f), f).toBe(true);
    }
    expect(read('manual/manual.md')).toContain('details.md');
    expect(read('manual/presets.md')).toContain('details.md');
    expect(read('docs/user-stories/README.md')).toContain(
      'US-038-detail-rows.md',
    );
  });

  it('US-038 AC-17: warning-codes.md lists the eight codes as active, none reserved', () => {
    const doc = read('docs/technical/warning-codes.md');
    for (const code of [
      'DETAIL_YAML_INVALID',
      'DETAIL_ORPHAN_BLOCK',
      'DETAIL_BLOCK_TWICE',
      'DETAIL_BLOCK_IN_CONTAINER',
      'DETAIL_IN_GLOSSARY',
      'DETAIL_BLOCK_WITH_ENTRY',
      'DETAIL_VALUE_NOT_TEXT',
      'DETAIL_VALUE_UNMAPPED',
    ]) {
      const row = doc.split('\n').find((l) => l.startsWith(`| \`${code}\` |`));
      expect(row, code).toBeDefined();
      expect(row).toMatch(/\| US-038 AC-\d+/);
      expect(row?.trim().endsWith('| active |'), code).toBe(true);
    }
  });

  it('US-038 AC-17: the test map names the story and the contract names its owner', () => {
    expect(read('docs/technical/tests.md')).toContain('US-038');
    expect(read('docs/technical/details-block.md')).toContain('US-038');
    expect(read('docs/technical/architecture.md')).toContain('core/details');
  });
});
