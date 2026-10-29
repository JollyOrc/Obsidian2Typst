// US-027 AC-1 to AC-5, AC-10 — the table of contents in the core: the `toc`
// fields with their messages and built-in values, the lines written (title,
// outline, the two switches), which headings are listed (callout headings
// written unlisted but bookmarked while the contents are on), the default
// place after the colophon, a picked place before or after an H1 with the
// warning when it is missing, and every setting at its values. The pages are
// in tests/integration/us-027-table-of-contents-pdf.test.ts, the menu items,
// rows and preview in tests/plugin/us-027-contents-menu.test.ts.
// Source of truth: docs/user-stories/US-027-table-of-contents.md.
import {describe, expect, it} from 'vitest';
import {type ConvertSettings} from '../../src/core/convert';
import {escapeMarkup} from '../../src/core/emit';
import {
  effectiveSettings,
  formatPresetError,
  parsePreset,
  validateFields,
} from '../../src/core/presets';
import {SETTINGS, run} from '../support/convert';

/** US-027: the contents settings as `convert` reads them (absent today). */
interface Toc {
  depth?: number;
  title?: string;
  pageNumbers?: boolean;
  dotLeaders?: boolean;
  heading?: string;
  position?: 'before' | 'after';
}

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

const convertWith = (
  source: string,
  toc: Toc,
  over: Partial<ConvertSettings> = {},
) => run(source, {settings: {...SETTINGS, ...over, toc} as ConvertSettings});

const TITLE = (text: string) =>
  `#block(below: 1em)[#text(size: 1.4em, weight: "bold")[${text}]]`;
const OUTLINE = (depth: number) => `#outline(title: none, depth: ${depth})`;
const NO_LEADERS = '#set outline.entry(fill: none)';
const NO_NUMBERS =
  '#show outline.entry: it => link(it.element.location(), it.indented(it.prefix(), it.body()))';

function at(typ: string, needle: string): number {
  const found = typ.indexOf(needle);
  expect(found, `${needle} in the output`).toBeGreaterThan(-1);
  return found;
}

const NOTE = [
  '# Rules',
  '',
  'Rules text.',
  '',
  '## Combat',
  '',
  'Combat text.',
  '',
  '### Attacks',
  '',
  'Attack text.',
  '',
  '> [!note]',
  '> ## Boxed',
  '> Inside.',
  '',
  '# Lore',
  '',
  'Lore text.',
  '',
  '# Glossary',
  '',
  '## Grit',
  '',
  'Grit text.',
].join('\n');

describe('US-027 AC-1 the fields', () => {
  it('US-027 AC-1: reads depth, title, the switches, heading and position from a preset note', () => {
    const result = parsePreset(
      note(
        'toc:',
        '  depth: 3',
        '  title: Inhalt',
        '  pageNumbers: false',
        '  dotLeaders: false',
        '  heading: Rules',
        '  position: after',
      ),
    );
    expect(result.ok && result.fields).toMatchObject({
      toc: {
        depth: 3,
        title: 'Inhalt',
        pageNumbers: false,
        dotLeaders: false,
        heading: 'Rules',
        position: 'after',
      },
    });
  });

  it('US-027 AC-1: refuses invalid values with the messages of the story', () => {
    const cases: [string[], string][] = [
      [
        ['toc:', '  depth: 7'],
        'toc.depth must be a whole number from 0 to 6 (line 4)',
      ],
      [
        ['toc:', '  depth: 1.5'],
        'toc.depth must be a whole number from 0 to 6 (line 4)',
      ],
      [
        ['toc:', '  depth: -1'],
        'toc.depth must be a whole number from 0 to 6 (line 4)',
      ],
      [
        ['toc:', '  depth: 2', '  position: inside'],
        'toc.position must be before or after (line 5)',
      ],
      [
        ['toc:', '  pageNumbers: yes'],
        'toc.pageNumbers must be true or false (line 4)',
      ],
      [
        ['toc:', '  dotLeaders: 1'],
        'toc.dotLeaders must be true or false (line 4)',
      ],
      [['toc:', '  title: 5'], 'toc.title must be text (line 4)'],
    ];
    for (const [lines, message] of cases) {
      expect(errorOf(...lines), lines.join(' / ')).toBe(message);
    }
  });

  it('US-027 AC-1: the Defaults hold depth, title and the switches; heading and position are preset notes only', () => {
    const result = validateFields({
      toc: {depth: 2, title: 'Index', heading: 'Rules', position: 'before'},
    });
    expect(result.ok && result.fields).toEqual({
      toc: {depth: 2, title: 'Index'},
    });
  });

  it('US-027 AC-1: built-in values: depth 0, title Contents, page numbers and dot leaders on', () => {
    const plain = effectiveSettings({fields: {}, lines: {}}, {}, () => false);
    expect(
      plain.ok && (plain.settings as unknown as {toc: Toc}).toc,
    ).toMatchObject({
      depth: 0,
      title: 'Contents',
      pageNumbers: true,
      dotLeaders: true,
    });
  });
});

describe('US-027 AC-1 the fields reach the settings (TICKET-083 mutation run)', () => {
  it('US-027 AC-1: preset over Defaults over built-in, field by field; an empty title is kept; the place comes from the preset', () => {
    const preset = parsePreset(
      note(
        'toc:',
        '  depth: 2',
        "  title: ''",
        '  heading: Rules',
        '  position: after',
      ),
    );
    if (!preset.ok) throw new Error('the preset parses');
    expect(preset.fields.toc?.title).toBe('');
    const effective = effectiveSettings(
      preset,
      {toc: {depth: 3, dotLeaders: false}},
      () => false,
    );
    // the preset wins (depth 2 over 3), the Defaults are in effect where the
    // preset is silent (dotLeaders), the built-in where both are (pageNumbers)
    expect(
      effective.ok && (effective.settings as unknown as {toc: Toc}).toc,
    ).toEqual({
      depth: 2,
      title: '',
      pageNumbers: true,
      dotLeaders: false,
      heading: 'Rules',
      position: 'after',
    });
  });
});

describe('US-027 AC-2 what is written', () => {
  it('US-027 AC-2: depth 2 with the defaults writes the title block and the outline', async () => {
    const {typ} = await convertWith(NOTE, {depth: 2});
    expect(typ).toContain(`${TITLE('Contents')}\n${OUTLINE(2)}`);
    expect(typ).not.toContain(NO_LEADERS);
    expect(typ).not.toContain(NO_NUMBERS);
  });

  it('US-027 AC-2: the title goes through the escaping of US-013; an empty title writes no block', async () => {
    const title = 'Rules #1 *and* [more]';
    const {typ} = await convertWith(NOTE, {depth: 2, title});
    expect(typ).toContain(TITLE(escapeMarkup(title, {atBlockStart: true})));
    expect(typ).not.toContain('[Rules #1');
    const empty = await convertWith(NOTE, {depth: 2, title: ''});
    expect(empty.typ).not.toContain('#block(below: 1em)');
    expect(empty.typ).toContain(OUTLINE(2));
  });

  it('US-027 AC-2: the switches are written before the outline, inside one block with it', async () => {
    const {typ} = await convertWith(NOTE, {
      depth: 2,
      dotLeaders: false,
      pageNumbers: false,
    });
    const leaders = at(typ, NO_LEADERS);
    const numbers = at(typ, NO_NUMBERS);
    const outline = at(typ, OUTLINE(2));
    expect(leaders).toBeLessThan(outline);
    expect(numbers).toBeLessThan(outline);
    // scoped: the block opens before the switches and closes after the outline
    const open = typ.lastIndexOf('#block[', leaders);
    expect(open).toBeGreaterThan(-1);
    expect(typ.indexOf(']', outline)).toBeGreaterThan(outline);
    expect(
      typ.slice(0, typ.indexOf('= Rules')).match(/^#set outline/gm),
    ).toHaveLength(1);
  });

  it('US-027 AC-2 guard: depth 0 (the built-in) writes no contents; the output is as today', async () => {
    const today = (await run(NOTE)).typ;
    expect((await convertWith(NOTE, {depth: 0})).typ).toBe(today);
    expect(today).not.toContain('#outline(');
  });
});

describe('US-027 AC-3 what is listed', () => {
  it('US-027 AC-3: with the contents on a callout heading is written unlisted and bookmarked', async () => {
    const {typ} = await convertWith(NOTE, {depth: 2});
    expect(typ).toContain(
      '#heading(level: 2, outlined: false, bookmarked: true)[Boxed] <h-boxed>',
    );
  });

  it('US-027 AC-3 guard: with the contents off the callout heading is written as today (decision 4)', async () => {
    const {typ} = await convertWith(NOTE, {depth: 0});
    expect(typ).toContain('== Boxed <h-boxed>');
    expect(typ).not.toContain('outlined: false, bookmarked: true');
  });

  it('US-027 AC-3: with the contents on a heading in a quote or a list item is written unlisted and bookmarked; off, as today', async () => {
    const source =
      '# Rules\n\nText.\n\n> ## Quoted\n> Inside quote.\n\n- ## Listed\n  Item text.';
    const QUOTED =
      '#heading(level: 2, outlined: false, bookmarked: true)[Quoted] <h-quoted>';
    const LISTED =
      '- #heading(level: 2, outlined: false, bookmarked: true)[Listed] <h-listed>';
    const on = (await convertWith(source, {depth: 2})).typ;
    expect(on).toContain(QUOTED);
    expect(on).toContain(LISTED);
    expect(on).toContain('= Rules <h-rules>');
    expect(on.match(/outlined: false, bookmarked: true/g)).toHaveLength(2);
    const off = (await convertWith(source, {depth: 0})).typ;
    expect(off).toContain('== Quoted <h-quoted>');
    expect(off).toContain('- == Listed <h-listed>');
    expect(off).not.toContain('bookmarked: true');
  });

  it('US-027 AC-3, SCAR-009: the text of a nested heading starts a content block and is escaped there', async () => {
    const {typ} = await convertWith('# Rules\n\n> ## + Plus\n> Text.', {
      depth: 2,
    });
    const atStart = escapeMarkup('+ Plus', {atBlockStart: true});
    expect(atStart).not.toBe(escapeMarkup('+ Plus', {atBlockStart: false}));
    expect(typ).toMatch(
      /#heading\(level: 2, outlined: false, bookmarked: true\)\[(.*)\] </,
    );
    expect(
      /bookmarked: true\)\[(.*)\] </.exec(typ)?.[1],
      'the heading text',
    ).toBe(atStart);
  });

  it('US-027 AC-3: a heading inside a glossary term stays unlisted (already outlined: false)', async () => {
    const {typ} = await convertWith(
      '# Glossary\n\n## Grit\n\nGrit text.\n\n### Detail\n\nMore.',
      {depth: 3},
    );
    expect(typ).toMatch(/#heading\(level: 3, numbering: none, outlined: false/);
  });
});

describe('US-027 AC-4 the default place (decision 2)', () => {
  it('US-027 AC-4: after the colophon and before the first chapter', async () => {
    const {typ} = await convertWith(
      `# Colophon\n\nPrinted.\n\n${NOTE}`,
      {depth: 2},
      {
        book: {colophonHeading: 'hidden'},
      } as Partial<ConvertSettings>,
    );
    expect(at(typ, 'Printed.')).toBeLessThan(at(typ, OUTLINE(2)));
    expect(at(typ, OUTLINE(2))).toBeLessThan(at(typ, '= Rules <h-rules>'));
  });

  it('US-027 AC-4: without a colophon, before the first chapter', async () => {
    const {typ} = await convertWith(NOTE, {depth: 2});
    expect(at(typ, OUTLINE(2))).toBeLessThan(at(typ, '= Rules <h-rules>'));
  });
});

describe('US-027 AC-5 a picked place (decisions 1 and 5)', () => {
  it('US-027 AC-5: before Rules: right before that heading', async () => {
    const {typ} = await convertWith(NOTE, {
      depth: 2,
      heading: 'Lore',
      position: 'before',
    });
    expect(at(typ, 'Attack text.')).toBeLessThan(at(typ, OUTLINE(2)));
    expect(at(typ, OUTLINE(2))).toBeLessThan(at(typ, '= Lore <h-lore>'));
  });

  it('US-027 AC-5: after Rules: after the whole section, before the next H1', async () => {
    const {typ} = await convertWith(NOTE, {
      depth: 2,
      heading: 'Rules',
      position: 'after',
    });
    expect(at(typ, 'Inside.')).toBeLessThan(at(typ, OUTLINE(2)));
    expect(at(typ, OUTLINE(2))).toBeLessThan(at(typ, '= Lore <h-lore>'));
  });

  it('US-027 AC-5: after the last H1: after the end of the body, before the back notes', async () => {
    const {typ} = await convertWith(`${NOTE}\n\n# Back notes\n\nNote text.`, {
      depth: 2,
      heading: 'Glossary',
      position: 'after',
    });
    expect(at(typ, 'Grit text.')).toBeLessThan(at(typ, OUTLINE(2)));
    expect(at(typ, OUTLINE(2))).toBeLessThan(at(typ, 'Note text.'));
  });

  it('US-027 AC-5: the heading compares as heading rules do (case and blanks); the first match counts', async () => {
    const {typ, warnings} = await convertWith(
      `${NOTE}\n\n# Lore\n\nSecond lore.`,
      {
        depth: 2,
        heading: '  lore ',
        position: 'before',
      },
    );
    // before the first Lore, not at the default place before Rules
    expect(at(typ, 'Attack text.')).toBeLessThan(at(typ, OUTLINE(2)));
    expect(at(typ, OUTLINE(2))).toBeLessThan(at(typ, 'Lore text.'));
    expect(warnings.map((w) => w.code)).not.toContain('TOC_HEADING_MISSING');
    expect(typ.match(/#outline\(/g)).toHaveLength(1);
  });

  it('US-027 AC-5 (decision 6): a heading without a position is read as before, no warning', async () => {
    const {typ, warnings} = await convertWith(NOTE, {
      depth: 2,
      heading: 'Lore',
    });
    expect(at(typ, 'Attack text.')).toBeLessThan(at(typ, OUTLINE(2)));
    expect(at(typ, OUTLINE(2))).toBeLessThan(at(typ, '= Lore <h-lore>'));
    expect(warnings.map((w) => w.code)).not.toContain('TOC_HEADING_MISSING');
  });

  it('US-027 AC-5: a heading not in the note gives TOC_HEADING_MISSING and the default place', async () => {
    const {typ, warnings} = await convertWith(NOTE, {
      depth: 2,
      heading: 'Spells',
      position: 'before',
    });
    expect(warnings).toContainEqual({
      code: 'TOC_HEADING_MISSING',
      message:
        'The table of contents heading "Spells" is not in the note; the contents are at the default place',
      line: 0,
    });
    expect(at(typ, OUTLINE(2))).toBeLessThan(at(typ, '= Rules <h-rules>'));
  });

  it('US-027 AC-5: an H2, a callout heading or a glossary term with the text is no place', async () => {
    const {warnings} = await convertWith(NOTE, {
      depth: 2,
      heading: 'Combat',
      position: 'before',
    });
    expect(warnings.map((w) => w.code)).toContain('TOC_HEADING_MISSING');
  });
});

describe('US-027 AC-10 settings at their values (SCAR-019)', () => {
  for (const depth of [1, 2, 3, 6]) {
    it(`US-027 AC-10: depth ${depth} writes outline depth ${depth}`, async () => {
      const {typ} = await convertWith(NOTE, {depth});
      expect(typ).toContain(OUTLINE(depth));
    });
  }

  for (const [pageNumbers, dotLeaders] of [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ] as const) {
    it(`US-027 AC-10: page numbers ${pageNumbers}, dot leaders ${dotLeaders}`, async () => {
      const {typ} = await convertWith(NOTE, {
        depth: 2,
        pageNumbers,
        dotLeaders,
      });
      expect(typ.includes(NO_NUMBERS)).toBe(!pageNumbers);
      expect(typ.includes(NO_LEADERS)).toBe(!dotLeaders);
      expect(typ).toContain(OUTLINE(2));
    });
  }

  it('US-027 AC-10: a custom title and numbering off', async () => {
    const {typ} = await convertWith(
      NOTE,
      {depth: 2, title: 'Inhalt'},
      {headingNumbering: 'none'},
    );
    expect(typ).toContain(TITLE('Inhalt'));
    expect(typ).toContain(OUTLINE(2));
  });
});
