// US-023 AC-1, AC-3, AC-4, AC-8 — the template hook with the real compiler:
// the template's rules reach the PDF only through the hook, the preset wins
// on a conflict (fonts, margins, header), a hook that is not a function fails
// at the hook line, and the composed note keeps its content. Every PDF fact
// was measured first (2026-10-22, the story's Notes). Each check has a guard
// that shows the result it rules out, so a check that cannot see it fails
// (SCAR-023). Source of truth:
// docs/user-stories/US-023-templates-that-style-the-document.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {convert, type ConvertSettings} from '../../src/core/convert';
import {DEFAULT_COVER} from '../../src/core/cover';
import {DEFAULT_FONTS} from '../../src/core/fonts';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {png} from '../support/images';
import {readPdfPages, type PdfPage} from '../support/pdf';

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

let shared: ReturnType<typeof createTypstCompiler> | undefined;
const compiler = () =>
  (shared ??= createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  }));
afterAll(() => shared?.dispose());

const MAP = 'Sample/map.png';
const IMAGES: Record<string, Uint8Array> = {[MAP]: png(60, 40)};

/**
 * The template of A5 MU Print (page, colours, gradients). Each edge strip
 * fades to transparent, so overlapping strips blend (M13 finding, 2026-10-22:
 * opaque strips covered each other and left seams); in the PDF a gradient
 * and its transparency mask are two shading objects, so four strips give 8.
 */
const MU_TEMPLATE = [
  '#let mu-ink = rgb("#1A1A1A")',
  '#let mu-parchment = rgb("#FEFCF0")',
  '#let mu-parchment-edge = rgb("#FBE2C5")',
  '#let mu-umber = rgb("#7A4A2E")',
  '#let mu-blue = rgb("#2F4F9E")',
  '#let mu-gold = rgb("#C9A44A")',
  '#let mu-fade = 13mm',
  '#let mu-fade-end = mu-parchment-edge.transparentize(100%)',
  '#let template(doc) = {',
  '  set page(fill: mu-parchment, background: {',
  '    place(top + left, rect(width: 100%, height: mu-fade, stroke: none, fill: gradient.linear(mu-parchment-edge, mu-fade-end, angle: 90deg)))',
  '    place(bottom + left, rect(width: 100%, height: mu-fade, stroke: none, fill: gradient.linear(mu-parchment-edge, mu-fade-end, angle: 270deg)))',
  '    place(top + left, rect(width: mu-fade, height: 100%, stroke: none, fill: gradient.linear(mu-parchment-edge, mu-fade-end, angle: 0deg)))',
  '    place(top + right, rect(width: mu-fade, height: 100%, stroke: none, fill: gradient.linear(mu-parchment-edge, mu-fade-end, angle: 180deg)))',
  '  })',
  '  set text(fill: mu-ink)',
  '  show heading.where(level: 2): set text(fill: mu-gold)',
  '  show heading.where(level: 4): set text(weight: "regular")',
  '  set line(stroke: 0.75pt + mu-blue)',
  '  set table(stroke: 0.5pt + mu-umber, fill: (x, y) => if y == 0 { mu-gold } else if calc.odd(y) { mu-parchment-edge } else { mu-parchment })',
  '  doc',
  '}',
  '',
].join('\n');

/** The settings with a template copy and, when `hook`, the hook. */
const settingsFor = (
  hook: boolean,
  extra: Partial<ConvertSettings> = {},
): ConvertSettings =>
  ({
    ...SETTINGS,
    fonts: structuredClone(DEFAULT_FONTS),
    template: true,
    templateHook: hook,
    ...extra,
  }) as ConvertSettings;

interface Compiled {
  ok: boolean;
  error: string;
  pages: PdfPage[];
  pdf: string;
  typ: string;
  codes: string[];
}

/**
 * Converts `source` with `settings`, optionally rewrites the Typst, and
 * compiles it with `templateText` as `template.typ` and the bundled fonts.
 */
async function compile(
  source: string,
  templateText: string,
  settings: ConvertSettings,
  rewrite: (typ: string) => string = (typ) => typ,
): Promise<Compiled> {
  const index = new FakeIndex([NOTE_PATH, ...Object.keys(IMAGES)]);
  for (const [path, bytes] of Object.entries(IMAGES)) {
    index.images.set(path, bytes);
  }
  const result = await convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings,
    assets: index,
  });
  const files: Record<string, Uint8Array> = {
    'template.typ': new TextEncoder().encode(templateText),
  };
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
  return compiled.ok
    ? {
        ok: true,
        error: '',
        pages: readPdfPages(compiled.pdf),
        pdf: Buffer.from(compiled.pdf).toString('latin1'),
        typ,
        codes: result.warnings.map((w) => w.code),
      }
    : {
        ok: false,
        error: compiled.error,
        pages: [],
        pdf: '',
        typ,
        codes: result.warnings.map((w) => w.code),
      };
}

const fillsOf = (c: Compiled): Set<string> =>
  new Set(c.pages.flatMap((p) => p.fills));
const shadings = (c: Compiled): number =>
  (c.pdf.match(/\/ShadingType/g) ?? []).length;
const fontsOf = (c: Compiled): string[] =>
  [...c.pdf.matchAll(/\/BaseFont\s*\/[A-Z]{6}\+([A-Za-z-]+)/g)].map(
    (m) => m[1] as string,
  );
/** Inserts `line` right before the first line of the body (after the preamble). */
const beforeBody =
  (line: string) =>
  (typ: string): string => {
    const at = typ.indexOf('\n= ');
    return `${typ.slice(0, at + 1)}${line}\n${typ.slice(at + 1)}`;
  };

const SHORT = '# The Code of Honor\n\n## Tessera\n\nText of the chapter.\n';

describe('US-023 AC-1 the template styles the document through the hook', () => {
  it('US-023 AC-1: the page fill, the ink and the gold of level 2 reach the PDF, with the four edge gradients (8 shading objects)', async () => {
    const c = await compile(SHORT, MU_TEMPLATE, settingsFor(true));
    expect(c.ok, c.error).toBe(true);
    const fills = fillsOf(c);
    for (const colour of ['#fefcf0', '#1a1a1a', '#c9a44a']) {
      expect(fills, colour).toContain(colour);
    }
    expect(shadings(c)).toBe(8);
  });

  it('US-023 AC-1 guard: without the hook the same template changes nothing (measured: no fill, no gradient)', async () => {
    const c = await compile(SHORT, MU_TEMPLATE, settingsFor(false));
    expect(c.ok, c.error).toBe(true);
    const fills = fillsOf(c);
    for (const colour of ['#fefcf0', '#1a1a1a', '#c9a44a']) {
      expect(fills, colour).not.toContain(colour);
    }
    expect(shadings(c)).toBe(0);
  });
});

describe('US-023 AC-3 the preset wins on a conflict', () => {
  // Each conflict template also sets the page fill, so a test also proves
  // that the hook ran (without it the preset "wins" trivially, SCAR-023).
  const FILL = '  set page(fill: rgb("#FEFCF0"))\n';
  const FONT_TEMPLATE = `#let template(doc) = {\n${FILL}  show heading: set text(font: "DejaVu Sans Mono")\n  doc\n}\n`;
  const RULE = '#show heading: set text(font: "DejaVu Sans Mono")';
  const headingFont = {
    ...structuredClone(DEFAULT_FONTS),
    heading: {family: 'Libertinus Serif', size: null},
  };

  it("US-023 AC-3: the template's heading font loses to the preset's (DejaVu Sans Mono is not in the PDF)", async () => {
    const c = await compile(
      SHORT,
      FONT_TEMPLATE,
      settingsFor(true, {fonts: headingFont}),
    );
    expect(c.ok, c.error).toBe(true);
    expect(fillsOf(c)).toContain('#fefcf0');
    expect(fontsOf(c).length).toBeGreaterThan(0);
    expect(fontsOf(c)).not.toContain('DejaVuSansMono');
  });

  it('US-023 AC-3 guard: the same rule after the preset rules wins (DejaVu Sans Mono is in the PDF), so the check can see it', async () => {
    const c = await compile(
      SHORT,
      '#let template(doc) = doc\n',
      settingsFor(true, {fonts: headingFont}),
      beforeBody(RULE),
    );
    expect(c.ok, c.error).toBe(true);
    expect(fontsOf(c)).toContain('DejaVuSansMono');
  });

  const LONG = [
    '# Margins',
    '',
    ...Array.from(
      {length: 40},
      (_, i) =>
        `Paragraph ${i + 1} with enough words to fill a line of the text block and wrap onto the next line of the page.\n`,
    ),
  ].join('\n');
  const MARGIN_TEMPLATE = `#let template(doc) = {\n${FILL}  set page(margin: 5mm)\n  doc\n}\n`;
  const texts = (c: Compiled): string[] => c.pages.map((p) => p.text);

  it("US-023 AC-3: the template's `margin: 5mm` loses to the preset's margins: every page holds the same text as without the template", async () => {
    const plain = await compile(LONG, '', {
      ...settingsFor(false),
      template: false,
    } as ConvertSettings);
    const hooked = await compile(LONG, MARGIN_TEMPLATE, settingsFor(true));
    expect(hooked.ok, hooked.error).toBe(true);
    expect(fillsOf(hooked)).toContain('#fefcf0');
    expect(plain.pages.length).toBeGreaterThan(1);
    expect(texts(hooked)).toEqual(texts(plain));
    expect(hooked.typ).toContain('#set page(width: ');
  });

  it('US-023 AC-3 guard: the same margin after the preset rules changes the pages, so the check can see it', async () => {
    const plain = await compile(LONG, '', {
      ...settingsFor(false),
      template: false,
    } as ConvertSettings);
    const after = await compile(
      LONG,
      '#let template(doc) = doc\n',
      settingsFor(true),
      beforeBody('#set page(margin: 5mm)'),
    );
    expect(after.ok, after.error).toBe(true);
    expect(texts(after)).not.toEqual(texts(plain));
  });

  const HEADER_TEMPLATE = `#let template(doc) = {\n${FILL}  set page(header: align(center)[MU HEADER BAR])\n  doc\n}\n`;
  const CHAPTER = LONG.replace('# Margins\n', '# Book\n\n## Tessera\n');

  it("US-023 AC-3: with the running header off, the template's header is on every page and the page number in the footer", async () => {
    const c = await compile(
      LONG,
      HEADER_TEMPLATE,
      settingsFor(true, {
        pageFurniture: {
          folios: true,
          runningHeader: false,
          runningHeaderLevel: 2,
        },
      }),
    );
    expect(c.ok, c.error).toBe(true);
    expect(c.pages.length).toBeGreaterThan(1);
    c.pages.forEach((page, i) => {
      expect(page.header, `page ${i + 1}`).toContain('MU HEADER BAR');
      expect(page.footer, `page ${i + 1}`).toBe(String(i + 1));
    });
  });

  it("US-023 AC-3: with the running header on (the built-in value), the running title replaces the template's header", async () => {
    const c = await compile(
      CHAPTER,
      HEADER_TEMPLATE,
      settingsFor(true, {
        pageFurniture: {
          folios: true,
          runningHeader: true,
          runningHeaderLevel: 2,
        },
      }),
    );
    expect(c.ok, c.error).toBe(true);
    expect(fillsOf(c)).toContain('#fefcf0');
    expect(c.pages.length).toBeGreaterThan(1);
    for (const page of c.pages) {
      expect(page.header).not.toContain('MU HEADER BAR');
    }
    expect((c.pages[1] as PdfPage).header).toBe('Tessera');
  });
});

describe('US-023 AC-4 a hook that is not a function', () => {
  it('US-023 AC-4: `#let template = 5` fails with the compiler message at the hook line (line 3)', async () => {
    const c = await compile(SHORT, '#let template = 5\n', settingsFor(true));
    expect(c.ok).toBe(false);
    expect(c.error).toContain('expected content or function, found integer');
    expect(c.error).toMatch(/:3:8\b/);
  });
});

describe('US-023 AC-8 the composed note with the MU template (SCAR-002, SCAR-015)', () => {
  const rows = (n: number): string =>
    Array.from({length: n}, (_, i) => `| r${i + 1} | ${i} | ${i * 2} |`).join(
      '\n',
    );
  const COMPOSED = [
    '![[map.png]]',
    '',
    '# The Code of Honor',
    '',
    'Opening paragraph with a footnote.[^1] And some **bold** text, `1d20` dice.',
    '',
    '## Tessera',
    '',
    'Text of the chapter.',
    '',
    '### Attacks',
    '',
    'Text under H3.',
    '',
    '#### Detail',
    '',
    'Text under H4.',
    '',
    '---',
    '',
    '> [!example] Mechanics box',
    '> - Roll 1d20 to determine success.',
    '> - Gain 50 XP.',
    '',
    '| Name | A | B |',
    '|---|---|---|',
    rows(3),
    '',
    '| Long | A | B |',
    '|---|---|---|',
    rows(14),
    '',
    '- one',
    '  - two',
    '    - three',
    '',
    '## Glossary',
    '',
    '### Moss',
    '',
    'The sum of Mind, Body and Agility.',
    '',
    'See [[#Tessera]] for the rules.',
    '',
    '[^1]: Wisdom through study.',
  ].join('\n');
  const STYLE = {
    fill: '#FBE2C5',
    border: {color: '#7A4A2E', width: 0.75},
    title: {color: '#7A4A2E'},
  };

  it('US-023 AC-8: compiles to the cover and two pages with every text, the colours of template and preset, the gradients, the header and the page numbers', async () => {
    const c = await compile(
      COMPOSED,
      MU_TEMPLATE,
      settingsFor(true, {
        headingNumbering: 'none',
        linkPageNumbers: true,
        linkPageLevel: 2,
        linkPageWord: 'p.',
        cover: {...DEFAULT_COVER, mode: 'auto'},
        callouts: {default: STYLE, example: STYLE},
        pageFurniture: {
          folios: true,
          runningHeader: true,
          runningHeaderLevel: 2,
        },
      }),
    );
    expect(c.ok, c.error).toBe(true);
    expect(c.typ).toContain(
      '#link(<h-tessera>)[Tessera]#page-ref(<h-tessera>)',
    );
    expect(c.pages).toHaveLength(3);
    const text = c.pages
      .map((p) => p.text)
      .join(' ')
      .replace(/\s+/g, ' ');
    for (const part of [
      'The Code of Honor',
      'Opening paragraph with a footnote.',
      'Tessera',
      'Attacks',
      'Detail',
      'Mechanics box',
      'Roll 1d20 to determine success.',
      'r14 13 26',
      'three',
      'Moss',
      'The sum of Mind, Body and Agility.',
      'Wisdom through study.',
    ]) {
      expect(text, part).toContain(part);
    }
    const fills = fillsOf(c);
    for (const colour of [
      '#fefcf0',
      '#1a1a1a',
      '#c9a44a',
      '#fbe2c5',
      '#7a4a2e',
    ]) {
      expect(fills, colour).toContain(colour);
    }
    expect(shadings(c)).toBe(8);
    const [cover, first, second] = c.pages as [PdfPage, PdfPage, PdfPage];
    expect(cover.hasImage).toBe(true);
    expect([cover.header, cover.footer]).toEqual(['', '']);
    expect([first.header, first.footer]).toEqual(['', '1']);
    expect(second.header.startsWith('Glossary')).toBe(true);
    expect(second.footer).toBe('2');
  });
});
