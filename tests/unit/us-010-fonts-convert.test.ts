// US-010 AC-2, AC-4, AC-5, AC-7 — the fonts in the conversion: the four lines
// in the preamble (place and order), no rule without font settings, the
// warnings of the fallback chain and of the glyph check in the result of
// `convert`, and the task-list glyph rule that uses the resolved body family
// (US-005 AC-6). The Typst is compiled in us-010-fonts-pdf.test.ts. Source of
// truth: docs/user-stories/US-010-fonts.md.
import {describe, expect, it} from 'vitest';
import {convert} from '../../src/core/convert';
import {
  DEFAULT_FONTS,
  createFontCatalog,
  type FontsSettings,
} from '../../src/core/fonts';
import {FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';

/** Coverage runs for inclusive code point ranges. */
function runs(...ranges: [number, number][]): number[] {
  const out: number[] = [];
  let at = 0;
  for (const [from, to] of ranges) {
    out.push(from - at, to - from + 1);
    at = to + 1;
  }
  return out;
}
const ASCII = runs([32, 126]);
const TASK_GLYPHS = runs([32, 126], [0x2610, 0x2610], [0x2612, 0x2612]);

const fonts = (over: Partial<FontsSettings> = {}): FontsSettings => ({
  ...structuredClone(DEFAULT_FONTS),
  ...over,
});

/** Libertinus and DejaVu with the task glyphs, Cinzel without them. */
const catalog = () =>
  createFontCatalog([
    {family: 'Libertinus Serif', coverage: TASK_GLYPHS},
    {family: 'DejaVu Sans Mono', coverage: ASCII},
    {family: 'Cinzel', coverage: ASCII},
  ]);

async function run(
  source: string,
  settings: FontsSettings | undefined,
  withCatalog = true,
) {
  return convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings: {...SETTINGS, fonts: settings},
    assets: new FakeIndex([NOTE_PATH]),
    fonts: withCatalog ? catalog() : undefined,
  });
}

const LINES = [
  '#set text(font: "Libertinus Serif", size: 10pt)',
  '#show heading: set text(font: "Cinzel")',
  '#show raw: set text(font: "DejaVu Sans Mono", size: 0.9em)',
  '#show figure.caption: set text(font: "Libertinus Serif", size: 0.9em)',
];

describe('US-010 AC-2 the four lines in the preamble', () => {
  it('US-010 AC-2: puts them after the page rules and before the highlight rule, in the order of the story', async () => {
    const {typ} = await run(
      'Text.\n',
      fonts({heading: {family: 'Cinzel', size: null}}),
    );
    const at = LINES.map((line) => typ.indexOf(line));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(typ.indexOf('#set page(')).toBeLessThan(at[0] as number);
    expect(typ.indexOf('#set highlight(')).toBeGreaterThan(at[3] as number);
    expect(
      typ.split('\n').filter((l) => l.startsWith('#set text(font')),
    ).toHaveLength(1);
  });

  it('US-010 AC-2: the four lines follow each other, with no line between', async () => {
    const {typ} = await run(
      'Text.\n',
      fonts({heading: {family: 'Cinzel', size: null}}),
    );
    expect(typ).toContain(LINES.join('\n'));
  });

  it('US-010 AC-2: without font settings there is no font rule (older callers keep their output)', async () => {
    const {typ} = await run('Text.\n', undefined);
    expect(typ).not.toContain('#set text(');
    expect(typ).not.toContain('#show heading:');
    expect(typ).not.toContain('#show raw:');
    expect(typ).not.toContain('#show figure.caption:');
  });

  it('US-010 AC-7: without a catalog the names are written as they are and no font warning appears', async () => {
    const {typ, warnings} = await run(
      'Text ☠\n',
      fonts({heading: {family: 'Whatever', size: 14}}),
      false,
    );
    expect(typ).toContain(
      '#show heading: set text(font: "Whatever", size: 14pt)',
    );
    expect(warnings.filter((w) => w.code.startsWith('FONT_'))).toEqual([]);
  });

  it('US-010 AC-2: writes the name the font reports when the setting differs in case', async () => {
    const {typ} = await run(
      'Text.\n',
      fonts({heading: {family: 'CINZEL', size: null}}),
    );
    expect(typ).toContain('#show heading: set text(font: "Cinzel")');
  });
});

describe('US-010 AC-4 and AC-5 the warnings in the result', () => {
  it('US-010 AC-4: a missing role family is a FONT_MISSING warning at line 0 and the default family is written', async () => {
    const {typ, warnings} = await run(
      'Text.\n',
      fonts({heading: {family: 'Nope', size: null}}),
    );
    expect(warnings).toEqual([
      {
        code: 'FONT_MISSING',
        message:
          'Font "Nope" for heading was not found; "Libertinus Serif" is used',
        line: 0,
      },
    ]);
    expect(typ).toContain('#show heading: set text(font: "Libertinus Serif")');
  });

  it('US-010 AC-4: the worked example gives exactly two warnings', async () => {
    const {warnings} = await run(
      'Text.\n',
      fonts({
        default: 'Foo',
        heading: {family: 'Cinzel', size: null},
        code: {family: 'Bar', size: null},
      }),
    );
    expect(warnings.map((w) => w.message)).toEqual([
      'Default font "Foo" was not found; "Libertinus Serif" is used',
      'Font "Bar" for code was not found; "DejaVu Sans Mono" is used',
    ]);
  });

  it('US-010 AC-5: a character the body family lacks is a FONT_GLYPH_MISSING warning with its source line, frontmatter counted', async () => {
    const {warnings} = await run(
      '---\ntitle: x\n---\n\nText ☠ here.\n',
      fonts(),
    );
    expect(warnings).toEqual([
      {
        code: 'FONT_GLYPH_MISSING',
        message:
          'Font "Libertinus Serif" lacks 1 character: ☠ U+2620 (first at line 5)',
        line: 5,
      },
    ]);
  });

  it('US-010 AC-5: the characters of a heading are checked against the heading family, the characters of the body against the body family', async () => {
    const {warnings} = await run(
      '# ☠ Title\n\nbody\n',
      fonts({heading: {family: 'Cinzel', size: null}}),
    );
    expect(warnings.map((w) => w.message)).toEqual([
      'Font "Cinzel" lacks 1 character: ☠ U+2620 (first at line 1)',
    ]);
  });

  it('US-010 AC-5: the missing-font warnings come before the glyph warnings', async () => {
    const {warnings} = await run(
      'Text ☠\n',
      fonts({heading: {family: 'Nope', size: null}}),
    );
    expect(warnings.map((w) => w.code)).toEqual([
      'FONT_MISSING',
      'FONT_GLYPH_MISSING',
    ]);
  });

  it('US-010 AC-5: a note without font settings gets no glyph check of its own', async () => {
    const {warnings} = await run('Text ☠\n', undefined);
    expect(warnings.map((w) => w.code)).not.toContain('FONT_GLYPH_MISSING');
  });
});

describe('US-010 AC-5 the task list uses the resolved body family', () => {
  const TASKS = '- [ ] open\n- [x] done\n';

  it('US-010 AC-5: with a body family that has both glyphs the tasks are written without a warning', async () => {
    const {warnings} = await run(TASKS, fonts());
    expect(warnings).toEqual([]);
  });

  it('US-010 AC-5: with a body family that lacks them the task rule of US-005 reports the resolved family', async () => {
    const {warnings} = await run(
      TASKS,
      fonts({body: {family: 'Cinzel', size: 10}}),
    );
    const messages = warnings.map((w) => w.message);
    expect(messages.some((m) => m.includes('Font "Cinzel" lacks U+2610'))).toBe(
      true,
    );
  });

  it('US-010 AC-5: the family that the default fell back to is the one that is asked, not the missing one', async () => {
    // Default "Foo" is missing, so the body is Libertinus Serif, which has
    // the glyphs: no task warning, only the missing-font warning.
    const {warnings} = await run(TASKS, fonts({default: 'Foo'}));
    expect(warnings.map((w) => w.code)).toEqual(['FONT_MISSING']);
  });
});
