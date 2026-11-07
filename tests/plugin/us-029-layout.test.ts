// US-029 AC-1, AC-2, AC-4, AC-8, AC-9 — the layout of the settings tab and
// the style panel as data: the sections, their feature rows and plain rows,
// what each gear opens, the descriptions, the owned-rows note of the panel
// and the order of the details table. Expected values are written out here,
// not derived from the layout (SCAR-023). Source of truth:
// docs/user-stories/US-029-settings-screen-and-menu-marking.md.
import {describe, expect, it, vi} from 'vitest';
import {DEFAULT_ROWS, FONT_ROWS} from '../../src/plugin/settings/row-data';
import {detailRows} from '../../src/plugin/settings/details';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

/** US-029: the shapes of the module that does not exist yet (red until the code). */
type LayoutItem =
  | {kind: 'presets'}
  | {kind: 'cover'}
  | {kind: 'plain'; label: string}
  | {
      kind: 'feature';
      name: string;
      desc: string;
      /** A Defaults path joined by dots, or `strictMode` (plugin data). */
      toggle?: string;
      /** The labels of the rows its gear opens, in order; empty: no gear. */
      rows: readonly string[];
    };
interface LayoutSection {
  name: string;
  items: readonly LayoutItem[];
}
interface LayoutModule {
  TAB_LAYOUT: readonly LayoutSection[];
  PANEL_LAYOUT: readonly LayoutSection[];
  ownedRowsNote(
    presetName: string,
    presetFields: unknown,
    rows: readonly string[],
  ): string | null;
}

const LAYOUT = '../../src/plugin/settings/layout';
const load = async (): Promise<LayoutModule> =>
  (await import(/* @vite-ignore */ LAYOUT)) as LayoutModule;

const PAGE_SETUP = [
  'Trim size',
  'Trim width (mm)',
  'Trim height (mm)',
  'Top margin (mm)',
  'Bottom margin (mm)',
  'Inside margin (mm)',
  'Outside margin (mm)',
  'Bleed (mm)',
  'Slug (mm)',
  'Facing pages',
  'Gutter (mm)',
];
const BREAKS = [1, 2, 3, 4, 5, 6].map((n) => `Break before H${n}`);
const FONTS = [
  'Font folder',
  'Default font',
  'Body font',
  'Body size (pt)',
  'Heading font',
  'Heading size (pt)',
  'Caption font',
  'Caption size (pt)',
  'Code font',
  'Code size (pt)',
];
const CONTENTS = [
  'Contents depth',
  'Contents title',
  'Contents page numbers',
  'Contents dot leaders',
];

/** AC-1's table, written as the story writes it. */
const EXPECTED_TAB: LayoutSection[] = [
  {name: 'Presets', items: [{kind: 'presets'}]},
  {
    name: 'Page',
    items: [
      {
        kind: 'feature',
        name: 'Page setup',
        desc: 'Trim size, margins, bleed and facing pages.',
        rows: PAGE_SETUP,
      },
      {
        kind: 'feature',
        name: 'Page numbers',
        desc: 'A page number at the foot of every body page.',
        toggle: 'page.folios',
        rows: [],
      },
      {
        kind: 'feature',
        name: 'Running header',
        desc: 'The chapter title at the head of the page.',
        toggle: 'page.runningHeader',
        rows: ['Running header level'],
      },
      {
        kind: 'feature',
        name: 'Page breaks',
        desc: 'A new page or spread before headings, by level.',
        rows: BREAKS,
      },
    ],
  },
  {
    name: 'Text',
    items: [
      {
        kind: 'feature',
        name: 'Fonts',
        desc: 'The font folder, families and sizes.',
        rows: FONTS,
      },
      {kind: 'plain', label: 'Heading numbering'},
      {kind: 'plain', label: 'Highlight colour'},
      {
        kind: 'feature',
        name: 'Page numbers in links',
        desc: '(p. 42) after internal links.',
        toggle: 'linkPageNumbers',
        rows: ['Link page level', 'Link page word'],
      },
      {
        kind: 'feature',
        name: 'Footnotes for external links',
        desc: 'The address of an external link as a footnote.',
        toggle: 'externalLinkFootnotes',
        rows: [],
      },
      {kind: 'plain', label: 'Template file'},
    ],
  },
  {
    name: 'Book',
    items: [
      {
        kind: 'feature',
        name: 'Book parts',
        desc: 'Colophon, back notes and where the first chapter starts.',
        rows: ['First chapter', 'Colophon heading', 'Back notes heading'],
      },
      {
        kind: 'feature',
        name: 'Roman folios in the front matter',
        desc: 'i, ii, iii before the first chapter.',
        toggle: 'book.romanFrontMatter',
        rows: [],
      },
      {
        kind: 'feature',
        name: 'Signatures',
        desc: 'Blank pages at the end to fill a signature.',
        rows: ['Pages per signature'],
      },
      {
        kind: 'feature',
        name: 'Contents',
        desc: 'A table of contents; off while its depth is 0.',
        rows: CONTENTS,
      },
      {
        kind: 'feature',
        name: 'Image fit',
        desc: 'Images shrink to stay with their text; off at 100 %.',
        rows: ['Smallest image size'],
      },
      // US-034 AC-1 (#132): the print resolution row, after Image fit.
      {
        kind: 'feature',
        name: 'Print resolution',
        desc: 'Warns about images below this dpi; off at 0.',
        rows: ['Minimum print resolution'],
      },
    ],
  },
  {
    name: 'Export',
    items: [
      {
        kind: 'feature',
        name: 'Strict mode',
        // #137: since US-028 the warnings after the compile never abort.
        desc: 'Conversion warnings abort the export.',
        toggle: 'strictMode',
        rows: [],
      },
      {kind: 'plain', label: 'Presets folder'},
      {kind: 'plain', label: 'Warnings note folder'},
    ],
  },
];

/** Every label a section shows or opens: a toggle row counts by its name. */
function labelsOf(sections: readonly LayoutSection[]): string[] {
  const labels: string[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.kind === 'plain') labels.push(item.label);
      if (item.kind === 'feature') {
        if (item.toggle !== undefined) labels.push(item.name);
        labels.push(...item.rows);
      }
    }
  }
  return labels;
}

describe('US-029 AC-1, AC-2 the settings tab layout', () => {
  it('US-029 AC-1, AC-2: five sections with the rows, toggles, gears and descriptions of the story, in order', async () => {
    const {TAB_LAYOUT} = await load();
    expect(JSON.parse(JSON.stringify(TAB_LAYOUT))).toEqual(EXPECTED_TAB);
  });

  it('US-029 AC-1: every row of DEFAULT_ROWS and FONT_ROWS and every global row stands exactly once (38 + 10 + 3)', async () => {
    const {TAB_LAYOUT} = await load();
    const labels = labelsOf(TAB_LAYOUT);
    // US-034 AC-1 (#132): Minimum print resolution added.
    expect(DEFAULT_ROWS).toHaveLength(38);
    expect(FONT_ROWS).toHaveLength(10);
    const all = [
      ...DEFAULT_ROWS.map((r) => r.label),
      ...FONT_ROWS.map((r) => r.label),
      'Strict mode',
      'Presets folder',
      'Warnings note folder',
    ];
    expect(new Set(labels).size).toBe(labels.length);
    expect([...labels].sort()).toEqual([...all].sort());
  });

  it('US-029 AC-1: a feature toggle names the field of the row with the same label (no row is switched by another one)', async () => {
    const {TAB_LAYOUT} = await load();
    let checked = 0;
    for (const section of TAB_LAYOUT) {
      for (const item of section.items) {
        if (item.kind !== 'feature' || item.toggle === undefined) continue;
        if (item.toggle === 'strictMode') continue;
        const row = DEFAULT_ROWS.find((r) => r.label === item.name);
        expect(row?.path.join('.'), item.name).toBe(item.toggle);
        expect(row?.kind, item.name).toBe('toggle');
        checked++;
      }
    }
    expect(checked).toBe(5);
  });

  it('US-029 AC-4: Contents, Image fit and Signatures have a gear and no toggle', async () => {
    const {TAB_LAYOUT} = await load();
    const features = TAB_LAYOUT.flatMap((s) => s.items).filter(
      (i): i is Extract<LayoutItem, {kind: 'feature'}> => i.kind === 'feature',
    );
    for (const name of ['Contents', 'Image fit', 'Signatures']) {
      const item = features.find((f) => f.name === name);
      expect(item?.toggle, name).toBeUndefined();
      expect(item?.rows.length, name).toBeGreaterThan(0);
    }
  });
});

describe('US-029 AC-8 the style panel layout', () => {
  it('US-029 AC-8: Page, Text, Book as on the tab, then Cover; no Presets, no Export', async () => {
    const {PANEL_LAYOUT} = await load();
    expect(JSON.parse(JSON.stringify(PANEL_LAYOUT))).toEqual([
      EXPECTED_TAB[1],
      EXPECTED_TAB[2],
      EXPECTED_TAB[3],
      {name: 'Cover', items: [{kind: 'cover'}]},
    ]);
  });

  it('US-029 AC-8 (decision 7): the owned-rows note names the owned rows in the modal order; the trim size is one group', async () => {
    const {ownedRowsNote} = await load();
    expect(
      ownedRowsNote('A5 print', {page: {trimSize: 'A5', bleed: 3}}, PAGE_SETUP),
    ).toBe(
      'Set by preset "A5 print": Trim size, Trim width (mm), Trim height (mm), Bleed (mm).',
    );
    expect(
      ownedRowsNote('A5 print', {page: {margins: {top: 20}}}, PAGE_SETUP),
    ).toBe('Set by preset "A5 print": Top margin (mm).');
    expect(
      ownedRowsNote('A5 print', {highlightColor: '#ff0000'}, PAGE_SETUP),
    ).toBeNull();
    expect(ownedRowsNote('A5 print', {}, FONTS)).toBeNull();
  });

  it('US-029 AC-8: a font row owned by the preset is named too', async () => {
    const {ownedRowsNote} = await load();
    expect(ownedRowsNote('Book', {fonts: {body: {size: 11}}}, FONTS)).toBe(
      'Set by preset "Book": Body size (pt).',
    );
  });
});

describe('US-029 AC-9 the details table in the order of the layout', () => {
  it('US-029 AC-9: rows section by section (toggle field first, then the modal rows), then the four summary rows', () => {
    const labels = detailRows({}, {}).map((r) => r.label);
    expect(labels).toEqual([
      ...PAGE_SETUP,
      'Page numbers',
      'Running header',
      'Running header level',
      ...BREAKS,
      ...FONTS,
      'Heading numbering',
      'Highlight colour',
      'Page numbers in links',
      'Link page level',
      'Link page word',
      'Footnotes for external links',
      'Template file',
      'First chapter',
      'Colophon heading',
      'Back notes heading',
      'Roman folios in the front matter',
      'Pages per signature',
      ...CONTENTS,
      'Smallest image size',
      'Minimum print resolution',
      'Cover',
      'Callout styles',
      'Heading rules',
      'Contents place',
    ]);
  });
});

describe('US-029 AC-9 the details table reads the built-in values (found at G3)', () => {
  it('US-029 AC-9: with nothing set, the 16 rows that showed — read their built-in value', () => {
    const used = new Map(
      detailRows({}, {}).map((r) => [r.label, `${r.used} (${r.source})`]),
    );
    const expected: [string, string][] = [
      ...BREAKS.map((label): [string, string] => [label, 'none (built-in)']),
      ['Pages per signature', '0 (built-in)'],
      ['Roman folios in the front matter', 'false (built-in)'],
      ['First chapter', 'left (built-in)'],
      ['Colophon heading', 'hidden (built-in)'],
      ['Back notes heading', 'hidden (built-in)'],
      ['Contents depth', '0 (built-in)'],
      ['Contents title', 'Contents (built-in)'],
      ['Contents page numbers', 'true (built-in)'],
      ['Contents dot leaders', 'true (built-in)'],
      ['Smallest image size', '100 (built-in)'],
      ['Minimum print resolution', '300 (built-in)'],
    ];
    expect(expected).toHaveLength(17);
    for (const [label, value] of expected) {
      expect(used.get(label), label).toBe(value);
    }
  });

  it('US-029 AC-9: unchanged rows keep today\u2019s value (Facing pages true, Body font —)', () => {
    const rows = detailRows({}, {});
    expect(rows.find((r) => r.label === 'Facing pages')?.used).toBe('true');
    expect(rows.find((r) => r.label === 'Body font')?.used).toBe('—');
  });
});

describe('US-029 AC-3, AC-9 one built-in lookup for every row (SCAR-017)', () => {
  // Corrected at #111 (the G2 guard asserted more than AC-9): Trim width and
  // Trim height have no built-in of their own (the trim size decides, US-009
  // AC-12); AC-9 keeps them as today (`—`).
  it('US-029 AC-3, AC-9: every DEFAULT_ROWS path has a built-in value except Template file (null) and the trim width and height (none)', async () => {
    const {effectiveValue} = (await import(
      /* @vite-ignore */ '../../src/core/presets/owner'
    )) as unknown as {
      effectiveValue(p: unknown, d: unknown, path: readonly string[]): unknown;
    };
    const none = ['Template file', 'Trim width (mm)', 'Trim height (mm)'];
    const checked = DEFAULT_ROWS.filter((row) => !none.includes(row.label));
    const missing = checked
      .filter((row) => effectiveValue({}, {}, row.path) === undefined)
      .map((row) => row.label);
    expect(missing).toEqual([]);
    expect(checked).toHaveLength(35);
    const value = (label: string): unknown =>
      effectiveValue(
        {},
        {},
        DEFAULT_ROWS.find((r) => r.label === label)?.path ?? [],
      );
    expect(value('Template file')).toBeNull();
    expect(value('Trim width (mm)')).toBeUndefined();
    expect(value('Trim height (mm)')).toBeUndefined();
  });
});
