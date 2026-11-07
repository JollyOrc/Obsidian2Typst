// US-024 amendment for epic #121 (AC-13 to AC-19) — the generated entries
// chapter: `Menagerie.md`, `presets/Entries.md`, the icons and the entry
// illustrations; the manifest's `entries`; the local private-word list.
// Source of truth: docs/user-stories/US-024-synthetic-public-fixture.md,
// section "Amendment: the entries chapter".
// Red until the generator writes the amendment (G2, 2026-11-06).
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {parse, stringify} from 'yaml';
import * as install from '../../build/install-scratch.mjs';
import {parsePreset} from '../../src/core/presets';
import {
  SAMPLE_DIR,
  VAULT,
  listFiles,
  publishedFiles,
  readSample,
} from '../support/sample';

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, {recursive: true, force: true});
});
const sha = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

/** AC-19: the files as they were before the amendment (2026-11-06). */
const BEFORE = {
  'Book.md': 'd4d5db910ce48d126c40e7b858d848766bf259fc8b97d4adbe33dd3aae771791',
  'Other.md':
    '2d8e3c78dae1079f4769cedccc3805464a60fddc4f37c78a18557fb46dc67f4f',
  'presets/Sample.md':
    '4c7da77c5c1a842669ca1b6589603f013fd570244a4b2cbe2d8ad9f66dab21e6',
} as const;

/** AC-13: the icons and the illustrations, with their pixel sizes. */
const ICONS = ['fine', 'hurt', 'down', 'fading', 'gone'].map(
  (n) => `assets/icons/${n}.svg`,
);
const ILLUSTRATIONS: Record<string, [number, number]> = {
  'assets/entry-wide.png': [1280, 1006],
  'assets/entry-tall.png': [358, 736],
  'assets/entry-square.png': [600, 600],
  'assets/entry-small.png': [272, 334],
  'assets/entry-long.png': [2000, 500],
  'assets/entry-slim.png': [300, 1200],
};

/** AC-14: the case names, one per row of the table (the manifest's keys). */
const CASES = [
  'chapter-intro',
  'section-intro',
  'layout-full-image',
  'layout-spread-landscape',
  'layout-spread-portrait',
  'layout-spread-text',
  'layout-page-landscape',
  'layout-page-portrait',
  'layout-page-text',
  'layout-auto',
  'ratio-wide',
  'ratio-tall',
  'ratio-square',
  'ratio-long',
  'ratio-slim',
  'low-dpi',
  'length-under-1',
  'length-over-1',
  'length-under-2',
  'length-over-2',
  'overflow-first-of-pair',
  'unpaired-at-section-end',
  'section-ends-right',
  'long-section-intro',
  'boxes-0',
  'boxes-11',
  'boxes-16',
  'boxes-45',
  'boxes-46',
  'boxes-varies',
  'states-missing',
  'states-none',
  'states-plus-fading',
  'states-unknown',
  'states-one-word',
  'tag-mapped',
  'tag-unmapped',
  'attack-no-dice',
  'attack-no-colon',
  'attack-bold',
  'attack-long',
  'value-link-markup',
  'value-map',
  'fence-four',
  'yaml-invalid',
  'block-orphan',
  'block-twice',
  'no-lede',
  'short-lede',
  'nested',
  'nested-layout',
  'block-in-callout',
  'list-10',
  'list-11',
  'subheadings',
  'sum-mismatch',
  'repeat-comment',
  'repeated-heading',
  'second-chapter',
  'outside-chapter',
  'glossary-term-block',
  'links-to-entries',
  'gap-paragraph',
] as const;

const LAYOUTS = [
  'full-image',
  'spread-landscape',
  'spread-portrait',
  'spread-text',
  'page-landscape',
  'page-portrait',
  'page-text',
  'auto',
];

/** AC-15: what the manifest says about one entry. */
interface EntryFact {
  heading: string;
  level: number;
  chapter: string;
  section: string | null;
  line: number;
  layout: string | null;
  illustration: {file: string; width: number; height: number} | null;
  boxes: string | number | null;
  states: unknown;
  tags: string[];
  cases: string[];
}
interface EntriesManifest {
  entries?: {
    list: EntryFact[];
    byCase: Record<string, string[]>;
    chapters: Record<string, {sections: string[]; entries: number}>;
    icons: string[];
  };
}
const manifest = (): EntriesManifest =>
  JSON.parse(readSample('manifest.json')) as EntriesManifest;
const entries = (): NonNullable<EntriesManifest['entries']> => {
  const e = manifest().entries;
  if (e === undefined) throw new Error('manifest.json has no "entries" key');
  return e;
};

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): [number, number] {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString('latin1'), path).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

/** Every `o2t-entry` block of a note: its fence, content and first line. */
function blocks(text: string): {fence: string; body: string; line: number}[] {
  const lines = text.split('\n');
  const out: {fence: string; body: string; line: number}[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^(`{3,}|~{3,})o2t-entry\s*$/.exec(lines[i] ?? '');
    if (open === null) continue;
    const fence = open[1] as string;
    const close = new RegExp(`^${fence[0]}{${fence.length},}\\s*$`);
    const start = i + 1;
    let j = start;
    while (j < lines.length && !close.test(lines[j] ?? '')) j++;
    out.push({
      fence,
      body: lines.slice(start, j).join('\n') + '\n',
      line: i + 1,
    });
    i = j;
  }
  return out;
}

describe('US-024 AC-13 the new files', () => {
  it('US-024 AC-13: the generator writes Menagerie.md, presets/Entries.md, the icons and the illustrations', () => {
    const files = listFiles(SAMPLE_DIR);
    for (const name of [
      'Menagerie.md',
      'presets/Entries.md',
      ...ICONS,
      ...Object.keys(ILLUSTRATIONS),
    ]) {
      expect(files, name).toContain(name);
    }
  });

  it('US-024 AC-13: each icon is a small SVG filled with #000', () => {
    for (const icon of ICONS) {
      const svg = readSample(icon);
      expect(svg, icon).toMatch(/^<svg[\s>]/);
      expect(svg, icon).toContain('fill="#000"');
      expect(Buffer.byteLength(svg), icon).toBeLessThan(400);
    }
  });

  it('US-024 AC-13: each illustration has its fixed pixel size', () => {
    for (const [file, size] of Object.entries(ILLUSTRATIONS)) {
      expect(pngSize(join(SAMPLE_DIR, file)), file).toEqual(size);
    }
  });

  it('US-024 AC-13: presets/Entries.md is a valid preset naming both entries chapters', () => {
    const result = parsePreset(readSample('presets/Entries.md'));
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    const fields = result.fields as Record<string, unknown>;
    expect(fields['headingRules']).toMatchObject({
      Menagerie: 'entries',
      Relics: 'entries',
    });
    const statblock = (
      fields['entries'] as Record<string, Record<string, unknown>>
    )['statblock'];
    expect(statblock).toMatchObject({
      boxes: 'vigour',
      trackKey: 'states',
      trackLabel: 'STATE',
    });
  });
});

describe('US-024 AC-14 the content of Menagerie.md', () => {
  it('US-024 AC-14: the chapters and sections of the outline', () => {
    const heads = readSample('Menagerie.md')
      .split('\n')
      .filter((l) => /^#{1,2} /.test(l));
    expect(heads).toEqual(
      expect.arrayContaining([
        '# Menagerie',
        '## Beasts',
        '## Horrors',
        '## Spirits',
        '# Relics',
        '# Example Crypt',
        '# Glossary',
      ]),
    );
  });

  it('US-024 AC-14: every case of the table has at least one entry', () => {
    const byCase = entries().byCase;
    const missing = CASES.filter((c) => (byCase[c] ?? []).length === 0);
    expect(missing).toEqual([]);
  });

  it('US-024 AC-14: the Menagerie chapter has 14 or more entries and every layout value', () => {
    const own = entries().list.filter(
      (e) => e.chapter === 'Menagerie' && e.level === 3,
    );
    expect(own.length).toBeGreaterThanOrEqual(14);
    expect(new Set(own.map((e) => e.layout ?? 'auto'))).toEqual(
      new Set(LAYOUTS),
    );
  });

  it('US-024 AC-14 and AC-19: every valid block is in the fixed YAML form', () => {
    const invalid = new Set(entries().byCase['yaml-invalid'] ?? []);
    const valueMap = new Set(entries().byCase['value-map'] ?? []);
    const facts = entries().list;
    const all = blocks(readSample('Menagerie.md'));
    expect(all.length).toBeGreaterThan(0);
    for (const b of all) {
      const owner = facts.find((e) => e.line < b.line && b.line - e.line <= 2);
      if (
        owner !== undefined &&
        (invalid.has(owner.heading) || valueMap.has(owner.heading))
      )
        continue;
      expect(
        stringify(parse(b.body), {nullStr: ''}),
        `block at line ${b.line}`,
      ).toBe(b.body);
    }
  });

  it('US-024 AC-14: the four-backtick block holds three backticks', () => {
    const four = blocks(readSample('Menagerie.md')).filter(
      (b) => b.fence === '````',
    );
    expect(four.length).toBeGreaterThanOrEqual(1);
    expect(four.some((b) => b.body.includes('```'))).toBe(true);
  });
});

describe('US-024 AC-15 the manifest', () => {
  it('US-024 AC-15: every entry fact is complete and its line is its heading', () => {
    const lines = readSample('Menagerie.md').split('\n');
    for (const e of entries().list) {
      expect(lines[e.line - 1], e.heading).toBe(
        `${'#'.repeat(e.level)} ${e.heading}`,
      );
      expect(Array.isArray(e.tags), e.heading).toBe(true);
      expect(Array.isArray(e.cases), e.heading).toBe(true);
      if (e.illustration !== null) {
        expect(ILLUSTRATIONS[e.illustration.file], e.heading).toEqual([
          e.illustration.width,
          e.illustration.height,
        ]);
      }
    }
  });

  it('US-024 AC-15: byCase and the entries agree', () => {
    const {list, byCase} = entries();
    for (const [name, heads] of Object.entries(byCase)) {
      for (const h of heads) {
        expect(
          list.find((e) => e.heading === h)?.cases,
          `${name}: ${h}`,
        ).toContain(name);
      }
    }
  });

  it('US-024 AC-15: the chapters and the icons are listed', () => {
    const {chapters, icons} = entries();
    expect(chapters['Menagerie']?.sections).toEqual([
      'Beasts',
      'Horrors',
      'Spirits',
    ]);
    expect(chapters['Relics']?.entries).toBe(2);
    expect(icons).toEqual(ICONS);
  });
});

const WORDS_FILE = 'tests/fixtures/private-words.local.txt';
/** AC-16: the words of `list` found in `text`, whole words, any case. */
const wordHits = (list: string[], text: string): string[] =>
  list.filter((w) =>
    new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
      text,
    ),
  );

describe('US-024 AC-16 and AC-18 the local private-word list', () => {
  it('US-024 AC-16: .gitignore keeps the word list out of the publish', () => {
    expect(readFileSync('.gitignore', 'utf8').split('\n')).toContain(
      WORDS_FILE,
    );
    expect(publishedFiles()).not.toContain(WORDS_FILE);
  });

  it('US-024 AC-16: the check finds a planted word, whole words only, in any case (guard)', () => {
    expect(wordHits(['Quillback'], 'the QUILLBACK runs')).toEqual([
      'Quillback',
    ]);
    expect(wordHits(['Quill'], 'a quillback')).toEqual([]);
  });

  // US-024 AC-16: the list exists only on the author's machine (git-ignored);
  // a public copy has none, so this check is skipped there.
  it.skipIf(!existsSync(WORDS_FILE))(
    'US-024 AC-16 and AC-18: no published file contains a word of the local list',
    () => {
      const list = readFileSync(WORDS_FILE, 'utf8')
        .split('\n')
        .map((w) => w.trim())
        .filter((w) => w !== '' && !w.startsWith('#'));
      const hits: string[] = [];
      for (const file of publishedFiles()) {
        for (const w of wordHits(list, readFileSync(file).toString('utf8')))
          hits.push(`${file}: ${w}`);
      }
      expect(hits).toEqual([]);
    },
  );
});

describe('US-024 AC-17 the manual-check vault', () => {
  it('US-024 AC-17: installSample installs the entries note, its preset and assets', () => {
    const fn = (install as Record<string, unknown>)['installSample'] as (o: {
      from: string;
      to: string;
    }) => {files: number};
    const vault = mkdtempSync(join(tmpdir(), 'o2t-us024-entries-'));
    temps.push(vault);
    const to = join(vault, VAULT);
    fn({from: SAMPLE_DIR, to});
    const files = listFiles(to);
    for (const name of [
      'Menagerie.md',
      'presets/Entries.md',
      ...ICONS,
      ...Object.keys(ILLUSTRATIONS),
    ]) {
      expect(files, name).toContain(name);
    }
  });
});

describe('US-024 AC-19 the earlier files are unchanged', () => {
  it('US-024 AC-19: Book.md, Other.md and presets/Sample.md keep their SHA-256', () => {
    for (const [file, sum] of Object.entries(BEFORE)) {
      expect(sha(join(SAMPLE_DIR, file)), file).toBe(sum);
    }
  });
});
