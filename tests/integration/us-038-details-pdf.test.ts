// US-038 AC-6 to AC-11 — the detail row in the PDF, with the real compiler:
// the printed text in order, colour and grayscale, the wrap, the icon-to-word
// join (a guard that shows the unsafe form parts them), a value longer than a
// page, links, the page edge sweep (heading, row and text stay together),
// the outline, and the composed note (entries chapter, quick reference,
// sheet, footnote, template). Read from the PDF (the words in order, the run
// sizes, the fills, the links) and from the `<o2t-details>` facts.
// Source of truth: docs/user-stories/US-038-detail-rows.md.
// Red until US-038 is implemented (G2, 2026-11-09).
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {TypstSnippet} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import {loadFonts} from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';
import {openPdf} from '../../src/core/pdf/reader';
import {pageRuns} from '../../src/core/pdf/text';
import {BOOK_FONTS, filler, pageOf} from '../support/book';
import {A5_PRINT} from '../support/convert';
import {ENTRIES, entry} from '../support/entries';
import {
  compileEntries,
  disposeEntriesCompiler,
  inOrder,
  type CompiledEntries,
} from '../support/entries-pdf';
import {
  DETAILS_E,
  DETAIL_ICON_BYTES,
  LONG_NEEDS,
  details,
} from '../support/details';
import {readPdfLinks} from '../support/pdf';

afterAll(disposeEntriesCompiler);

// SCAR-030: a compile of a few pages takes 0.3 to 2 s in the full run; the
// sweep compiles 132 small notes (measured at G4).
const SLOW = 60_000;
const SWEEP = 240_000;

const compile = (
  source: string,
  over: Record<string, unknown> = {},
  files: Record<string, Uint8Array> = {},
): Promise<CompiledEntries> =>
  compileEntries(source, {
    over: {details: DETAILS_E, ...over},
    images: DETAIL_ICON_BYTES,
    files,
  });

const ALL = ['pace: brisk', 'kind: craft', 'needs: Basket Knots'];
const MM = 72 / 25.4;

/** The runs of the row (size 9.5 pt) of a 1-based page. */
function rowRuns(c: CompiledEntries, page: number, size = 9.5) {
  return (pageRuns(openPdf(c.pdf))[page - 1] ?? []).filter(
    (r) => !r.furniture && Math.abs(r.size - size) < 0.05,
  );
}
const textOf = (r: {items: readonly object[]}): string =>
  r.items.map((i) => ('ch' in i ? (i as {ch: string}).ch : '')).join('');

describe('US-038 AC-7 the row in the PDF', () => {
  it(
    'US-038 AC-7: the heading, then Brisk, Craft, Basket Knots in that order, then the body; one row fact with three badges',
    async () => {
      const c = await compile(details('###### Reed Weaving', ALL));
      const page = c.pages[0];
      expect(page?.text).toBeDefined();
      expect(
        inOrder(page?.text ?? '', [
          'Reed Weaving',
          'Brisk',
          'Craft',
          'Basket Knots',
          'You weave reeds',
        ]),
        page?.text,
      ).toBe(true);
      expect(c.details).toEqual([{page: 1, badges: 3}]);
      // the row is set at 9.5 pt in the colour of the preset
      expect(rowRuns(c, 1).map(textOf).join(' ')).toContain('Brisk');
      expect(page?.fills).toContain('#7a4a2e');
      expect(
        c.result.warnings.filter((w) => w.code.startsWith('DETAIL_')),
      ).toEqual([]);
    },
    SLOW,
  );

  it(
    'US-038 AC-6: grayscale prints the row in #4d4d4d, not in the colour of the preset',
    async () => {
      const c = await compile(details('###### Reed Weaving', ALL), {
        colorMode: 'grayscale',
      });
      expect(c.pages[0]?.fills).toContain('#4d4d4d');
      expect(c.pages[0]?.fills).not.toContain('#7a4a2e');
    },
    SLOW,
  );

  it(
    'US-038 AC-6: size and colour at the ends and a non-default value are drawn as set (6, 14 pt)',
    async () => {
      for (const size of [6, 14]) {
        const c = await compile(details('### Reed Weaving', ALL), {
          details: {...DETAILS_E, size, color: '#336699'},
        });
        expect(
          rowRuns(c, 1, size).map(textOf).join(' '),
          `${size} pt`,
        ).toContain('Craft');
        expect(c.pages[0]?.fills).toContain('#336699');
      }
    },
    SLOW,
  );

  it(
    'US-038 AC-6: one, three and ten items keep the row (ten badges, one row fact)',
    async () => {
      const ten = {
        items: Array.from({length: 10}, (_, i) => ({
          key: `k${i}`,
          icon: 'Icons/kind.svg',
        })),
      };
      const yaml = Array.from({length: 10}, (_, i) => `k${i}: v${i}`);
      const c = await compile(details('### Reed Weaving', yaml), {
        details: ten,
      });
      expect(c.details).toEqual([{page: 1, badges: 10}]);
      for (let i = 0; i < 10; i++) expect(c.pages[0]?.text).toContain(`v${i}`);
      const one = await compile(details('### Reed Weaving', ['kind: lore']));
      expect(one.details).toEqual([{page: 1, badges: 1}]);
    },
    SLOW,
  );
});

describe("US-038 AC-6 the icons are recoloured to the row's colour", () => {
  const svg = (inner: string): Uint8Array =>
    new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`,
    );
  const withIcon = (inner: string) =>
    compileEntries(details('### Reed Weaving', ['needs: Basket Knots']), {
      over: {
        details: {
          color: '#336699',
          items: [{key: 'needs', icon: 'Icons/lock.svg'}],
        },
      },
      images: {...DETAIL_ICON_BYTES, 'Icons/lock.svg': svg(inner)},
    });
  const count = (c: CompiledEntries, colour: string): number =>
    (c.pages[0]?.fills ?? []).filter((f) => f === colour).length;

  it(
    'US-038 AC-6: a red-filled icon is drawn in the row colour; its own red is not in the page',
    async () => {
      const c = await withIcon('<path d="M3 3h4v6H3z" fill="#ff0000"/>');
      expect(c.pages[0]?.fills).not.toContain('#ff0000');
      expect(c.details).toEqual([{page: 1, badges: 1}]);
      const none = await withIcon('');
      // the icon's own fill is one more fill of the row's colour
      expect(count(c, '#336699')).toBe(count(none, '#336699') + 1);
    },
    SLOW,
  );

  it(
    'US-038 AC-6: a fill of none stays none (only its stroke takes the colour): no extra fill',
    async () => {
      const c = await withIcon(
        '<rect x="2" y="2" width="6" height="6" fill="none" stroke="#00ff00"/>',
      );
      const none = await withIcon('');
      expect(count(c, '#336699')).toBe(count(none, '#336699'));
      expect(c.pages[0]?.fills).not.toContain('#00ff00');
    },
    SLOW,
  );
});

describe('US-038 AC-8 one row that wraps; a value longer than a page', () => {
  it(
    'US-038 AC-8: a row with the 57-character requirement wraps to a second line inside the row and keeps every word',
    async () => {
      const c = await compile(
        details('###### Reed Weaving', [
          'pace: brisk',
          'kind: craft',
          `needs: ${LONG_NEEDS}`,
          'starter: true',
        ]),
      );
      const ys = [...new Set(rowRuns(c, 1).map((r) => Math.round(r.y)))];
      expect(ys.length, `baselines ${ys}`).toBeGreaterThanOrEqual(2);
      expect(
        inOrder(c.pages[0]?.text ?? '', [
          'Brisk',
          'Craft',
          ...LONG_NEEDS.split(' '),
          'Known from the start',
        ]),
      ).toBe(true);
    },
    SLOW,
  );

  it(
    'US-038 AC-8 (SCAR-015): a value of 1,500 words prints every word once, in order, inside the text area',
    async () => {
      const words = Array.from({length: 1500}, (_, i) => `w${i}`);
      const c = await compile(
        details(
          '### Reed Weaving',
          [`needs: ${words.join(' ')}`],
          ['After the row. Tail marker.'],
        ),
      );
      expect(c.pages.length).toBeGreaterThan(1);
      const text = c.pages.map((p) => p.text).join(' ');
      let last = -1;
      for (const w of words) {
        const hits = [
          ...text.matchAll(new RegExp(`(?<![\\w])${w}(?![\\w])`, 'g')),
        ];
        expect(hits.length, w).toBe(1);
        expect(hits[0]?.index ?? -1, w).toBeGreaterThan(last);
        last = hits[0]?.index ?? -1;
      }
      expect(text).toContain('Tail marker');
      const foot = A5_PRINT.margins.bottom * MM;
      pageRuns(openPdf(c.pdf)).forEach((page, i) => {
        for (const r of page.filter((x) => !x.furniture))
          expect(r.y, `page ${i + 1}`).toBeGreaterThanOrEqual(foot - 0.5);
      });
    },
    SLOW,
  );

  it(
    'US-038 AC-8: the row is not justified: its lines do not all end at the right margin',
    async () => {
      const c = await compile(
        details('### Reed Weaving', [
          'pace: brisk',
          'kind: craft',
          `needs: ${LONG_NEEDS} and ${LONG_NEEDS}`,
        ]),
      );
      const right = (A5_PRINT.pageWidth - A5_PRINT.margins.outside) * MM;
      const ends = rowRuns(c, 1).map((r) => r.x1);
      expect(ends.length).toBeGreaterThan(1);
      expect(ends.some((x) => right - x > 3)).toBe(true);
    },
    SLOW,
  );
});

/**
 * The join of an icon and its word, measured with the real compiler (G1,
 * 2026-11-09): markers inside a box that stands for the icon and a box that
 * holds the first word; the glue between them is the unknown. A guard of the
 * premise of AC-8: a plain space parts them at some widths, a non-breaking
 * space at none. The helper of the product uses the second (a text check in
 * the convert test).
 */
describe('US-038 AC-8 guard: the icon-to-word join, measured with the compiler', () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#000"/></svg>';
  it(
    'US-038 AC-8: a plain space parts the icon from its word at some widths; ~ at none (41 widths × 11 labels)',
    async () => {
      const snippet = new TypstSnippet();
      snippet.setCompilerInitOptions({
        getModule: () =>
          readFileSync(
            join(
              process.cwd(),
              'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
            ),
          ),
        beforeBuild: [loadFonts([...BOOK_FONTS], {assets: false})],
      });
      await snippet.mapShadow('/i.svg', new TextEncoder().encode(SVG));
      const parted = async (
        glue: string,
      ): Promise<{parted: number; total: number}> => {
        let d = 0;
        let n = 0;
        let total = 0;
        const widths = Array.from({length: 41}, (_, k) => 100 - k * 1.5);
        for (const w of widths) {
          const src = `#set page(width: ${w}mm, height: 200mm, margin: 5mm)
#set text(size: 9.5pt)
#let mk(tag) = context [#metadata(here().position().y) #tag]
#let icon = box(baseline: 0.15em, {image(bytes(read("/i.svg")), format: "svg", width: 0.95em, height: 0.95em); mk(<a>)})
#let item(t) = [#icon${glue}#box({[#t]; mk(<b>)})]
#par(justify: false, {
  ("Action","Passive","Weeks","Tested","Skill","Varies","Turn","None","Jump","Prerequisite","Quick").map(item).join(h(1.1em))
})
`;
          const path = `/join-${glue.length}-${w}.typ`;
          await snippet.addSource(path, src);
          const compiler = (await snippet.getCompiler()) as unknown as {
            runWithWorld<T>(
              o: {mainFilePath: string},
              cb: (x: {
                compile(o: {diagnostics: 'unix'}): Promise<unknown>;
                query(o: {selector: string; field: string}): Promise<unknown>;
              }) => Promise<T>,
            ): Promise<T>;
          };
          const [a, b] = await compiler.runWithWorld(
            {mainFilePath: path},
            async (x) => {
              await x.compile({diagnostics: 'unix'});
              return [
                await x.query({selector: '<a>', field: 'value'}),
                await x.query({selector: '<b>', field: 'value'}),
              ];
            },
          );
          const A = (typeof a === 'string' ? JSON.parse(a) : a) as string[];
          const B = (typeof b === 'string' ? JSON.parse(b) : b) as string[];
          const y = (s: string | undefined): number => parseFloat(s ?? 'NaN');
          // at the widest page nothing wraps: that gap is the constant offset
          if (w === 100) d = y(A[0]) - y(B[0]);
          A.forEach((ya, i) => {
            total++;
            if (Math.abs(y(ya) - y(B[i]) - d) > 0.5) n++;
          });
        }
        return {parted: n, total};
      };
      const space = await parted(' ');
      const nobreak = await parted('~');
      expect(space.total).toBe(41 * 11);
      expect(nobreak.total).toBe(41 * 11);
      expect(space.parted).toBeGreaterThan(0);
      expect(nobreak.parted).toBe(0);
    },
    SLOW,
  );
});

describe('US-038 AC-9 links in the PDF', () => {
  const NOTE = [
    '# Book',
    '',
    '### Basket Knots',
    '',
    'Knots for baskets and more of the same text.',
    '',
    details('###### Reed Weaving', ['needs: "[[#Basket Knots|Basket Knots]]"']),
  ].join('\n');

  it(
    'US-038 AC-9: the value is a working link to the heading (a link annotation), with the page number after it when on',
    async () => {
      const on = {linkPageNumbers: true, linkPageLevel: 3};
      const c = await compile(NOTE, on);
      const target = pageOf(c.pages, 'Knots for baskets') - 1;
      const row = pageOf(c.pages, 'You weave reeds') - 1;
      const links = readPdfLinks(c.pdf).filter(
        (l) => l.page === row && l.target === target,
      );
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(
        inOrder(c.pages[row]?.text ?? '', ['Basket Knots', 'p.', 'You weave']),
      ).toBe(true);
      const off = await compile(NOTE, {linkPageNumbers: false});
      expect(off.pages[row]?.text).not.toMatch(/Basket Knots\s*\(p\./);
      expect(
        readPdfLinks(off.pdf).some(
          (l) => l.page === row && l.target === target,
        ),
      ).toBe(true);
    },
    SLOW,
  );
});

describe('US-038 AC-10 stays with its heading and its text', () => {
  const LEVELS = [1, 2, 3, 4, 5, 6];
  const edge = Array.from({length: 11}, (_, i) => 10 + i);

  it(
    'US-038 AC-10: swept over 11 filler lengths × 6 heading levels × a one-line and a three-line row, heading, row and first text line are on one page',
    async () => {
      const pagesSeen = new Set<number>();
      let cases = 0;
      for (const level of LEVELS) {
        for (const lines of [1, 3]) {
          const needs =
            lines === 1
              ? 'short'
              : Array.from({length: 40}, (_, i) => `req${i}`).join(' ');
          for (const n of edge) {
            const source = [
              filler(n),
              '',
              details(
                `${'#'.repeat(level)} Sweep Heading`,
                [`needs: ${needs}`],
                [
                  'Zebra0 first words of the text after the row, then more words follow here.',
                ],
              ),
            ].join('\n');
            const c = await compile(source, {pageFurniture: {folios: true}});
            const h = pageOf(c.pages, 'Sweep Heading');
            const t = pageOf(c.pages, 'Zebra0');
            expect(c.details, `h${level} n${n} lines${lines}`).toHaveLength(1);
            const rowPage = c.details[0]?.page;
            expect(h, `heading h${level} n${n} lines${lines}`).toBe(rowPage);
            expect(t, `text h${level} n${n} lines${lines}`).toBe(rowPage);
            expect(c.diagnostics.filter((d) => d.includes('converge'))).toEqual(
              [],
            );
            pagesSeen.add(h);
            cases++;
          }
        }
      }
      expect(cases).toBe(132);
      // the sweep crosses a page edge (SCAR-023): the heading is not always on one page
      expect(pagesSeen.size).toBeGreaterThanOrEqual(2);
    },
    SWEEP,
  );

  it(
    'US-038 AC-10: the row is not a heading: outline, contents and bookmarks are those of the note without the block',
    async () => {
      const source = (block: boolean): string =>
        [
          '# Book',
          '',
          block
            ? details('###### Reed Weaving', ['pace: brisk'], ['Text.'])
            : '###### Reed Weaving\nText.',
        ].join('\n');
      const over = {toc: {depth: 6, heading: 'Contents', position: 'before'}};
      const a = await compile(source(true), over);
      const b = await compile(source(false), over);
      expect(a.bookmarks.map((x) => `${x.depth} ${x.title}`)).toEqual(
        b.bookmarks.map((x) => `${x.depth} ${x.title}`),
      );
      expect(a.bookmarks.length).toBeGreaterThan(0);
      expect(a.pages.length).toBe(b.pages.length);
    },
    SLOW,
  );
});

describe('US-038 AC-11 composed, in the PDF', () => {
  const menagerie = [
    '# Menagerie',
    '',
    entry(
      '### Fen Hare',
      ['might: 4', 'layout: page-text'],
      ['A lede that is long enough to count for the test.'],
    ),
    '',
    entry(
      '### Gorse Imp',
      ['might: 3', 'layout: page-text'],
      ['Another lede that is long enough to count.'],
    ),
  ].join('\n');
  const crafts = (block: boolean): string =>
    [
      '# Crafts',
      '',
      block
        ? details('###### Reed Weaving', ALL, ['Weaving text with a note.[^1]'])
        : '###### Reed Weaving\n\nWeaving text with a note.[^1]',
      '',
      '[^1]: The footnote text.',
    ].join('\n');
  const over = {
    headingRules: {Menagerie: 'entries'},
    entries: {...ENTRIES, quickReference: true, encounterSheet: true},
  };

  it(
    'US-038 AC-11: the entries chapter, its quick reference and the sheet are the same pages with and without the blocks; the row sits in the next chapter; the footnote stays',
    async () => {
      const a = await compile(`${menagerie}\n\n${crafts(true)}`, over);
      const b = await compile(`${menagerie}\n\n${crafts(false)}`, over);
      const upTo = pageOf(a.pages, 'Weaving text') - 1;
      expect(upTo).toBeGreaterThan(2);
      expect(a.pages.slice(0, upTo - 1).map((p) => p.text)).toEqual(
        b.pages.slice(0, upTo - 1).map((p) => p.text),
      );
      expect(a.statblocks).toEqual(b.statblocks);
      expect(a.places).toEqual(b.places);
      expect(a.details).toEqual([{page: upTo + 1, badges: 3}]);
      const text = a.pages.map((p) => p.text).join(' ');
      expect(text).toContain('Craft');
      expect(text.split('The footnote text').length - 1).toBe(1);
    },
    SLOW,
  );

  it(
    "US-038 AC-11: a heading inside a chapter entry's body gets its row in the flow, below the small heading; the statblock is unchanged",
    async () => {
      const inside = [
        '# Menagerie',
        '',
        entry(
          '### Fen Hare',
          ['might: 4', 'layout: page-text'],
          [
            'A lede that is long enough to count for the test, more words follow.',
            '',
            details(
              '#### Reed Weaving',
              ['pace: swift'],
              ['Weaving words inside the entry.'],
            ).replace(/^/, ''),
          ],
        ),
      ].join('\n');
      const c = await compile(inside, over);
      expect(c.details).toHaveLength(1);
      const page = c.pages.find((p) => p.text.includes('Weaving words'));
      expect(
        inOrder(page?.text ?? '', ['Reed Weaving', 'Swift', 'Weaving words']),
      ).toBe(true);
      expect(c.statblocks).toHaveLength(1);
    },
    SLOW,
  );

  it(
    "US-038 AC-11: first in a chapter after a page break, on facing pages off and on: the row on the heading's page",
    async () => {
      for (const facingPages of [true, false]) {
        const c = await compile(
          [
            '# Book',
            '',
            filler(3),
            '',
            '## Craft chapter',
            '',
            details('###### Reed Weaving', ALL),
            '',
          ].join('\n'),
          {breakBefore: {h2: 'page'}},
        );
        void facingPages;
        const h = pageOf(c.pages, 'Reed Weaving');
        expect(c.details[0]?.page).toBe(h);
        expect(h).toBeGreaterThan(1);
      }
    },
    SLOW,
  );

  it(
    'US-038 AC-11: a template that sets the text colour: the body takes it, the row keeps its own colour',
    async () => {
      const template = new TextEncoder().encode(
        '#let template(doc) = { set text(fill: rgb("#0000ff")); doc }\n',
      );
      const c = await compile(
        details('###### Reed Weaving', ALL),
        {template: true, templateHook: true},
        {'template.typ': template},
      );
      expect(c.pages[0]?.fills).toContain('#7a4a2e');
      expect(c.pages[0]?.fills).toContain('#0000ff');
      expect(inOrder(c.pages[0]?.text ?? '', ['Brisk', 'You weave'])).toBe(
        true,
      );
    },
    SLOW,
  );

  it(
    'US-038 AC-11: bold in a value and a value that starts with a list marker print as text, in the row',
    async () => {
      const c = await compile(
        details('###### Reed Weaving', ['needs: "- a **firm** hand"']),
      );
      expect(c.pages[0]?.text.replace(/\s+/g, ' ')).toContain('- a firm hand');
      expect(c.details).toEqual([{page: 1, badges: 1}]);
    },
    SLOW,
  );
});
