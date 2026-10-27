// US-016 AC-6, AC-11, AC-14, AC-15 — callouts with the real compiler: every
// composed shape compiles, a long box crosses pages and its title stays with
// the body, the composed export has its content (SCAR-015: texts, fill colours,
// font, icon), and the joins of a callout with every neighbour keep the text in
// order (SCAR-010). Guard tests show the results the rules prevent. Measured
// first on 2026-10-18 (story Notes). Source of truth:
// docs/user-stories/US-016-callout-styles.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {convert, type ConvertSettings} from '../../src/core/convert';
import {CALLOUT_HELPER} from '../../src/core/emit/callout';
import {DEFAULT_FONTS} from '../../src/core/fonts';
import {type CalloutsSettings} from '../../src/core/markers';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {png} from '../support/images';
import {readPdfPages, type PdfPage} from '../support/pdf';
import {diagnose} from '../support/typst-node';

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);
const FONT_FILES = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'DejaVuSansMono.ttf',
].map((n) => new Uint8Array(readFileSync(join('assets/fonts', n))));

const ICON = 'Layouting/Icons/quill.png';
const IMAGES: Record<string, Uint8Array> = {
  'Sample/assets/map.png': png(30, 20),
  [ICON]: png(16, 16),
};
const FILES = [NOTE_PATH, ...Object.keys(IMAGES)];

/** One compiler for the file: the sweeps of AC-14 compile about 100 times. */
let shared: ReturnType<typeof createTypstCompiler> | undefined;
const compiler = () =>
  (shared ??= createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  }));
afterAll(() => shared?.dispose());

interface Compiled {
  pages: PdfPage[];
  pdf: Uint8Array;
  typ: string;
  codes: string[];
}

/** Converts `source` with `callouts` and compiles it with the bundled fonts. */
async function compile(
  source: string,
  callouts: CalloutsSettings = {},
  rewrite: (typ: string) => string = (typ) => typ,
): Promise<Compiled> {
  const index = new FakeIndex(FILES);
  for (const [path, bytes] of Object.entries(IMAGES)) {
    index.images.set(path, bytes);
  }
  const settings: ConvertSettings = {
    ...SETTINGS,
    callouts,
    fonts: structuredClone(DEFAULT_FONTS),
  };
  const result = await convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings,
    assets: index,
  });
  const files: Record<string, Uint8Array> = {};
  for (const use of result.assets) {
    files[use.to] = IMAGES[use.from] as Uint8Array;
  }
  const typ = rewrite(result.typ);
  const compiled = await compiler().compile({
    file: 'main.typ',
    source: typ,
    files,
    fonts: FONT_FILES,
  });
  if (!compiled.ok) throw new Error(`${compiled.error}\n${typ}`);
  return {
    pages: readPdfPages(compiled.pdf),
    pdf: compiled.pdf,
    typ,
    codes: result.warnings.map((w) => w.code),
  };
}

/** The text of all pages, blanks squashed. */
const textOf = (pages: readonly PdfPage[]): string =>
  pages
    .map((p) => p.text)
    .join(' ')
    .replace(/\s+/g, ' ');

const count = (text: string, part: string): number =>
  text.split(part).length - 1;

/** Fills of all pages. */
const fillsOf = (pages: readonly PdfPage[]): string[] =>
  pages.flatMap((p) => p.fills);

describe('US-016 AC-6, AC-11 every composed shape compiles', () => {
  const SHAPES: Record<string, string> = {
    simple: '> [!example] Rolling dice\n> Roll 6d6.',
    untitled: '> [!note]\n> text',
    empty: '> [!note]',
    nested: '> [!example] Outer\n> a\n>\n> > [!note] Inner\n> > b',
    listItem: '- item\n\n  > [!note] N\n  > q',
    inQuote: '> quoted\n>\n> > [!tip] T\n> > x',
    quoteInside: '> [!note] N\n> > plain quote inside',
    threeLevels: '- item\n\n  > [!example] A\n  > > [!note] B\n  > > c',
    blocks:
      '> [!example] Pools\n> - Mind\n>\n> | a | b |\n> |---|---|\n> | 1 | 2 |\n>\n> ```\n> code\n> ```\n>\n> ![Map](assets/map.png)',
    heading: '> [!example] E\n> ## Two pools\n> text\n\nSee [it](#two-pools).',
    footnote: '> [!note] N\n> x[^1]\n\n[^1]: The note.',
    titleMarkup: '> [!tip] Use **bold**, `code`, # and $ and - x',
    noTitle: '> [!example]\n> x',
    unknown: '> [!banana] Ripe\n> x',
    alias: '> [!faq] Why?\n> x',
  };
  for (const [name, source] of Object.entries(SHAPES)) {
    it(`US-016 AC-11: ${name} compiles and shows its text`, async () => {
      const {pages} = await compile(source, {
        example: {icon: ICON, title: {text: 'Example'}},
      });
      expect(textOf(pages).length, name).toBeGreaterThan(0);
    });
  }

  it('US-016 AC-11 guard: the helper with a style that is not in the dictionary fails to compile (unknown types must be mapped first)', async () => {
    const source = [
      '#let callout-styles = (',
      '  "default": (fill: rgb("#f5f5f5"), stroke: 0.75pt + rgb("#9e9e9e"), inset: 8pt, title-color: rgb("#9e9e9e"), font: none, size: none, icon: none),',
      ')',
      CALLOUT_HELPER,
      '#callout("banana")[x]',
      '',
    ].join('\n');
    const errors = (await diagnose(source)).filter(
      (d) => d.severity === 'error',
    );
    expect(errors.map((e) => e.message).join(' ')).toContain(
      'dictionary does not contain key "banana"',
    );
  });
});

describe('US-016 AC-14 page breaks', () => {
  it('US-016 AC-14: a callout of 120 short paragraphs crosses pages (3 A5 pages or more) and keeps every paragraph', async () => {
    const paragraphs = Array.from(
      {length: 120},
      (_, i) => `> Paragraph ${i} with some words to fill a line.`,
    ).join('\n>\n');
    const {pages} = await compile(`> [!example] Long\n${paragraphs}`);
    expect(pages.length).toBeGreaterThanOrEqual(3);
    const text = textOf(pages);
    for (const i of [0, 59, 119]) {
      expect(count(text, `Paragraph ${i} with`), String(i)).toBe(1);
    }
  });

  /**
   * Filler paragraphs, then a vertical offset, then a callout; the cases
   * `n/d` (filler count / offset in pt) whose title ends a page. Whole
   * paragraphs alone are too coarse to reach the page bottom with the title
   * (measured 2026-10-18 on A5 print: without `sticky` the title is alone at
   * 24 lines with offsets 3 to 12 pt; with `sticky` never).
   */
  async function aloneAt(
    rewrite: (typ: string) => string = (t) => t,
  ): Promise<string[]> {
    const alone: string[] = [];
    for (let n = 20; n <= 34; n++) {
      const filler = Array.from(
        {length: n},
        (_, i) => `Filler line ${i}.`,
      ).join('\n\n');
      for (let d = 0; d <= 12; d += 3) {
        const {pages} = await compile(
          `${filler}\n\n> [!example] Sticky Title\n> First body line.\n>\n> Second body line.`,
          {},
          (typ) =>
            rewrite(
              typ.replace(
                '#callout("example"',
                `#v(${d}pt)\n#callout("example"`,
              ),
            ),
        );
        if (pages.some((p) => p.text.trimEnd().endsWith('Sticky Title'))) {
          alone.push(`${n}/${d}`);
        }
      }
    }
    return alone;
  }

  it('US-016 AC-14: the title is never the last line of a page (20 to 34 filler lines × offsets 0 to 12 pt)', async () => {
    expect(await aloneAt()).toEqual([]);
  }, 180_000);

  it('US-016 AC-14 guard: without sticky the sweep finds a title alone at the page bottom', async () => {
    const alone = await aloneAt((typ) => typ.replace('sticky: true, ', ''));
    expect(alone).toContain('24/6');
    expect(alone.length).toBeGreaterThan(0);
  }, 120_000);
});

describe('US-016 AC-15 the composed export has its content (SCAR-015)', () => {
  const NOTE = [
    '# Rules',
    '',
    '> [!example] Rolling dice',
    '> Rolling 6d6 and getting two sixes.',
    '>',
    '> > [!note] Inner',
    '> > Inside the inner box.',
    '',
    '- item',
    '',
    '  > [!faq] Why?',
    '  > Because.',
    '',
    '> [!banana] Ripe',
    '> Yellow.',
    '',
    '> [!rule-note] House',
    '> Monospace text.',
  ].join('\n');
  const STYLES: CalloutsSettings = {
    example: {fill: '#f3ead7'},
    'rule-note': {font: {family: 'DejaVu Sans Mono'}, icon: ICON},
  };

  it('US-016 AC-15: every title and the body text appear exactly once', async () => {
    const text = textOf((await compile(NOTE, STYLES)).pages);
    for (const part of [
      'Rolling dice',
      'Inner',
      'Why?',
      'Ripe',
      'House',
      'Rolling 6d6',
      'Inside the inner box.',
      'Monospace text.',
    ]) {
      expect(count(text, part), part).toBe(1);
    }
  });

  it('US-016 AC-15: fills a box with the preset example colour and one with the built-in question colour', async () => {
    const fills = fillsOf((await compile(NOTE, STYLES)).pages);
    expect(fills).toContain('#f3ead7');
    expect(fills).toContain('#fdf1e6');
    expect(fills).toContain('#e6f0fc');
    expect(fills).toContain('#f5f5f5');
  });

  it('US-016 AC-15: embeds the style font and holds the icon image beside the body images', async () => {
    const {pdf} = await compile(NOTE, STYLES);
    const text = Buffer.from(pdf).toString('latin1');
    expect(text).toMatch(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?DejaVuSansMono/);
    expect(count(text, '/Subtype /Image')).toBe(1);
  });

  it('US-016 AC-15: the only new warning is one CALLOUT_TYPE_UNKNOWN', async () => {
    const {codes} = await compile(NOTE, STYLES);
    expect(codes).toEqual(['CALLOUT_TYPE_UNKNOWN']);
  });

  it('US-016 AC-15 guard: the same note as plain quotes (headers removed) has none of the callout fills and no icon', async () => {
    const plain = NOTE.replace(/\[![^\]]+\] ?/g, '');
    const {pages, pdf} = await compile(plain, STYLES);
    const fills = fillsOf(pages);
    for (const colour of ['#f3ead7', '#fdf1e6', '#e6f0fc', '#f5f5f5']) {
      expect(fills, colour).not.toContain(colour);
    }
    expect(count(Buffer.from(pdf).toString('latin1'), '/Subtype /Image')).toBe(
      0,
    );
  });
});

describe('US-016 joins of a callout with its neighbours (SCAR-010)', () => {
  const CALLOUT = '> [!note] Title\n> Inside.';
  const NEIGHBOURS: Record<string, string> = {
    paragraph: 'Word.',
    heading: '## Heading',
    list: '- Item',
    ordered: '1. Item',
    table: '| A |\n|---|\n| B |',
    code: '```\nCode\n```',
    image: '![Pic](assets/map.png)',
    quote: '> Quoted',
    callout: '> [!tip] Other\n> More.',
    rule: '---',
    footnoteRef: 'Note[^n].\n\n[^n]: Footnote text.',
  };

  for (const [name, neighbour] of Object.entries(NEIGHBOURS)) {
    it(`US-016: a callout before and after a ${name} keeps the order of the text`, async () => {
      const {pages} = await compile(
        `Start.\n\n${neighbour}\n\n${CALLOUT}\n\n${neighbour}\n\nEnd.`,
      );
      const text = textOf(pages);
      const at = ['Start.', 'Title', 'Inside.', 'End.'].map((w) =>
        text.indexOf(w),
      );
      expect(
        at.every((i) => i >= 0),
        `${name}: ${text}`,
      ).toBe(true);
      expect(
        [...at].sort((a, b) => a - b),
        name,
      ).toEqual(at);
    });
  }

  it('US-016: a callout at the very start and the very end of the note', async () => {
    const {pages} = await compile(`${CALLOUT}\n\nMiddle.\n\n${CALLOUT}`);
    const text = textOf(pages);
    expect(count(text, 'Inside.')).toBe(2);
    expect(text.indexOf('Middle.')).toBeGreaterThan(text.indexOf('Inside.'));
  });

  it('US-016: a callout in a list item followed by the next item', async () => {
    const {pages} = await compile(
      '- one\n\n  > [!note] Title\n  > Inside.\n- two',
    );
    const text = textOf(pages);
    expect(text.indexOf('two')).toBeGreaterThan(text.indexOf('Inside.'));
  });
});
