// US-019 AC-1, AC-3, AC-5 (Typst form), AC-8, AC-11 — folios and running
// headers in the conversion: the three page fields and their messages, the
// effective settings, the preamble rule `page-furniture` and its exact text,
// the cover pages, the switches, the template-name class, and the fixture.
// The pages are compiled in tests/integration/us-019-folios-pdf.test.ts.
// Source of truth: docs/user-stories/US-019-folios-and-running-headers.md.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {type ConvertSettings} from '../../src/core/convert';
import {PREAMBLE_RULES} from '../../src/core/convert/preamble';
import {RUNNING_TEXT_HELPER, RUNNING_TITLE_HELPER} from '../../src/core/emit';
import {DEFAULT_COVER} from '../../src/core/cover';
import {
  BUILTIN_DEFAULTS,
  effectiveSettings,
  formatPresetError,
  parsePreset,
  resolveFields,
  validateFields,
} from '../../src/core/presets';
import {PLUGIN_NAMES} from '../../src/core/template';
import {A5_PRINT, NOTE_PATH, SETTINGS, run} from '../support/convert';
import {readSample} from '../support/sample';
import {
  FOOTER_FACING,
  FOOTER_SINGLE,
  HEADER,
  RUNNING_TEXT,
  RUNNING_TITLE,
} from '../support/furniture';

/** US-019: the settings `convert` gets (absent today, so read untyped). */
interface Furniture {
  folios: boolean;
  runningHeader: boolean;
  runningHeaderLevel: number;
}

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

const ON: Furniture = {
  folios: true,
  runningHeader: true,
  runningHeaderLevel: 2,
};

/** Converts `source` with the page furniture `furniture` (default: unset). */
const convertWith = (
  source: string,
  furniture?: Furniture,
  over: Partial<ConvertSettings> = {},
) =>
  run(source, {
    settings: {
      ...SETTINGS,
      ...over,
      pageFurniture: furniture,
    } as ConvertSettings,
  });

/** The preamble: everything before the first blank line. */
const preambleOf = (typ: string): string => typ.slice(0, typ.indexOf('\n\n'));

describe('US-019 AC-1 the page fields', () => {
  it('US-019 AC-1: reads page.folios, page.runningHeader and page.runningHeaderLevel with their lines', () => {
    const result = parsePreset(
      note(
        'page:',
        '  folios: false',
        '  runningHeader: true',
        '  runningHeaderLevel: 3',
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.page).toEqual({
      folios: false,
      runningHeader: true,
      runningHeaderLevel: 3,
    });
    expect(result.lines['page.runningHeaderLevel']).toBe(6);
  });

  it('US-019 AC-1: accepts levels 1 and 6 and null as unset', () => {
    expect(errorOf('page:', '  runningHeaderLevel: 1')).toBeNull();
    expect(errorOf('page:', '  runningHeaderLevel: 6')).toBeNull();
    expect(errorOf('page:', '  folios: null')).toBeNull();
  });

  it('US-019 AC-1: refuses each invalid value with its message and line', () => {
    const cases: [string[], string][] = [
      [
        ['page:', '  folios: yes'],
        'page.folios must be true or false (line 4)',
      ],
      [['page:', '  folios: 1'], 'page.folios must be true or false (line 4)'],
      [
        ['page:', '  runningHeader: "on"'],
        'page.runningHeader must be true or false (line 4)',
      ],
      [
        ['page:', '  runningHeaderLevel: 7'],
        'page.runningHeaderLevel must be a whole number from 1 to 6 (line 4)',
      ],
      [
        ['page:', '  runningHeaderLevel: 0'],
        'page.runningHeaderLevel must be a whole number from 1 to 6 (line 4)',
      ],
      [
        ['page:', '  runningHeaderLevel: 2.5'],
        'page.runningHeaderLevel must be a whole number from 1 to 6 (line 4)',
      ],
      [
        ['page:', '  runningHeaderLevel: "2"'],
        'page.runningHeaderLevel must be a whole number from 1 to 6 (line 4)',
      ],
    ];
    for (const [lines, message] of cases) {
      expect(errorOf(...lines), lines.join(' / ')).toBe(message);
    }
  });

  it('US-019 AC-1: the Defaults may hold the fields too', () => {
    const result = validateFields({
      page: {folios: false, runningHeaderLevel: 3},
    });
    expect(result.ok && result.fields.page).toEqual({
      folios: false,
      runningHeaderLevel: 3,
    });
  });

  it('US-019 AC-1: built-in values are folios true, running header true, level 2', () => {
    expect(BUILTIN_DEFAULTS.page).toMatchObject({
      folios: true,
      runningHeader: true,
      runningHeaderLevel: 2,
    });
  });

  it('US-019 AC-1: the effective settings take preset, then Defaults, then built-in, field by field', () => {
    const parsed = parsePreset(note('page:', '  runningHeaderLevel: 3'));
    if (!parsed.ok) throw new Error('valid');
    const result = effectiveSettings(
      parsed,
      {page: {folios: false, runningHeaderLevel: 4}} as never,
      () => false,
    );
    expect(result.ok && result.settings.pageFurniture).toEqual({
      folios: false,
      runningHeader: true,
      runningHeaderLevel: 3,
    });
    const plain = effectiveSettings({fields: {}, lines: {}}, {}, () => false);
    expect(plain.ok && plain.settings.pageFurniture).toEqual(ON);
  });
});

describe('US-019 AC-1 the geometry stays geometry (SCAR-001)', () => {
  it('US-019 AC-1: the furniture never reaches the page input of resolvePageSetup', () => {
    const merged = resolveFields(
      {page: {folios: false, runningHeaderLevel: 3}},
      {page: {runningHeader: false}},
    );
    for (const key of ['folios', 'runningHeader', 'runningHeaderLevel']) {
      expect(Object.keys(merged.page), key).not.toContain(key);
    }
    expect(merged.pageFurniture).toEqual({
      folios: false,
      runningHeader: false,
      runningHeaderLevel: 3,
    });
  });
});

describe('US-019 AC-3, AC-5 the preamble rule page-furniture', () => {
  it('US-019 AC-3: is registered as page-furniture with order 45', () => {
    expect(PREAMBLE_RULES.find((r) => r.id === 'page-furniture')?.order).toBe(
      45,
    );
  });

  it('US-019 AC-3, AC-5: facing pages, both on: the two helpers and one #set page line, exactly', async () => {
    const preamble = preambleOf((await convertWith('# A\n\nText.', ON)).typ);
    expect(preamble).toContain(
      [
        RUNNING_TEXT,
        RUNNING_TITLE,
        `#set page(numbering: "1", ${HEADER(2)}, ${FOOTER_FACING})`,
      ].join('\n'),
    );
  });

  it('US-019 AC-4: single pages centre the folio', async () => {
    const page = {...A5_PRINT, facingPages: false};
    const preamble = preambleOf((await convertWith('# A', ON, {page})).typ);
    expect(preamble).toContain(
      `#set page(numbering: "1", ${HEADER(2)}, ${FOOTER_SINGLE})`,
    );
  });

  it('US-019 AC-5: the level is written into the header call', async () => {
    const preamble = preambleOf(
      (await convertWith('# A', {...ON, runningHeaderLevel: 3})).typ,
    );
    expect(preamble).toContain('running-title(3)');
  });

  it('US-019 AC-3: comes after the fonts and the page rule, before the highlight rule', async () => {
    const preamble = preambleOf((await convertWith('# A', ON)).typ);
    const at = (part: string) => preamble.indexOf(part);
    expect(at('#let running-text')).toBeGreaterThan(at('#set page(width:'));
    expect(at('#set highlight')).toBeGreaterThan(at('#set page(numbering:'));
  });

  it('US-019 AC-8: folios only: numbering and footer, no helpers, no header', async () => {
    const preamble = preambleOf(
      (await convertWith('# A', {...ON, runningHeader: false})).typ,
    );
    expect(preamble).toContain(`#set page(numbering: "1", ${FOOTER_FACING})`);
    expect(preamble).not.toContain('running-');
    expect(preamble).not.toContain('header:');
  });

  it('US-019 AC-8: header only: the helpers and the header, no numbering, no footer', async () => {
    const preamble = preambleOf(
      (await convertWith('# A', {...ON, folios: false})).typ,
    );
    expect(preamble).toContain(
      [RUNNING_TEXT, RUNNING_TITLE, `#set page(${HEADER(2)})`].join('\n'),
    );
    expect(preamble).not.toContain('numbering: "1"');
    expect(preamble).not.toContain('footer:');
  });

  it('US-019 AC-8: both off or unset: the Typst is byte-identical to a convert without the setting', async () => {
    const source = '# A\n\nText.\n\n## B\n\nMore.';
    const unset = (await convertWith(source)).typ;
    const off = (
      await convertWith(source, {...ON, folios: false, runningHeader: false})
    ).typ;
    expect(off).toBe(unset);
    expect(unset).not.toContain('running-');
    expect(unset).not.toContain('numbering: "1"');
  });

  it('US-019 AC-3: PLUGIN_NAMES hold running-text and running-title', () => {
    expect(PLUGIN_NAMES).toContain('running-text');
    expect(PLUGIN_NAMES).toContain('running-title');
  });

  it('US-019 AC-3: every #let of a preamble with furniture defines a name of PLUGIN_NAMES (text check, SCAR-017)', async () => {
    const preamble = preambleOf((await convertWith('# A', ON)).typ);
    const names = [...preamble.matchAll(/^#let ([A-Za-z_][\w-]*)/gm)].map(
      (m) => m[1],
    );
    expect(names).toEqual(['running-text', 'running-title']);
    for (const name of names) expect(PLUGIN_NAMES).toContain(name);
  });
});

describe('US-019 AC-3 the cover pages', () => {
  const FILES = [NOTE_PATH, 'Sample/assets/cover.png'];
  const COVER_NOTE = '![](assets/cover.png)\n\n# Rules\n\nText.';
  const withCover = (furniture: Furniture | undefined, blank: boolean) =>
    run(
      COVER_NOTE,
      {
        settings: {
          ...SETTINGS,
          cover: {...DEFAULT_COVER, blankPageAfter: blank},
          pageFurniture: furniture,
        } as ConvertSettings,
      },
      FILES,
    );

  it('US-019 AC-3: with folios on, the cover page and its blank page get numbering: none, and the counter is reset after them', async () => {
    const {typ} = await withCover(ON, true);
    const PAGE =
      '#page(margin: 0pt, header: none, footer: none, numbering: none)';
    expect(typ).toContain(`${PAGE}[\n`);
    expect(typ).toContain(`${PAGE}[]\n#counter(page).update(1)`);
  });

  it('US-019 AC-3, AC-8: with folios off (or unset), the cover pages stay as in US-011', async () => {
    for (const furniture of [undefined, {...ON, folios: false}]) {
      const {typ} = await withCover(furniture, false);
      expect(typ).toContain(
        '#page(margin: 0pt, header: none, footer: none)[\n',
      );
      expect(typ).not.toContain('numbering: none');
    }
  });
});

describe('US-019 one writer of the helpers (SCAR-017)', () => {
  it('US-019 AC-3: the emitter text equals the measured text of the tests', () => {
    expect(RUNNING_TEXT_HELPER).toBe(RUNNING_TEXT);
    expect(RUNNING_TITLE_HELPER).toBe(RUNNING_TITLE);
  });

  it('US-019 AC-3: only src/core/emit/furniture.ts writes #let running-text or running-title(', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory()
          ? files(path)
          : path.endsWith('.ts')
            ? [path]
            : [];
      });
    const writers = files('src').filter((file) => {
      const text = readFileSync(file, 'utf8');
      return text.includes('#let running-') || text.includes('running-title(');
    });
    expect(writers).toEqual([join('src', 'core', 'emit', 'furniture.ts')]);
  });
});

describe('US-019 AC-11 the sample note', () => {
  const source = readSample('Book.md');

  it('US-019 AC-11: has the rule and the helpers once; deterministic (rule 7)', async () => {
    const first = (await convertWith(source, ON)).typ;
    const second = (await convertWith(source, ON)).typ;
    expect(second).toBe(first);
    expect(first.split('#let running-title(').length - 1).toBe(1);
    expect(first).toContain(`#set page(numbering: "1", ${HEADER(2)}`);
  });

  it('US-019 AC-11, AC-8: the body is the same with and without furniture', async () => {
    const on = (await convertWith(source, ON)).typ;
    const off = (await convertWith(source)).typ;
    const bodyOf = (typ: string) => typ.slice(typ.indexOf('\n\n'));
    expect(bodyOf(on)).toBe(bodyOf(off));
  });
});
