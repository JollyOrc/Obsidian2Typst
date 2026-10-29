// US-028 AC-4 to AC-8, AC-11, AC-12 — images that stay with their text, with
// the real compiler. The text before the image is swept over page edges; the
// pages are judged by rules that hold for any page size (the probe measured
// them on A5 at G1 and G2): an image is on the page where its text ends, or
// on the next page; on a right page nothing flows up past it; on a left page
// a floated image lets the text after it fill the gap; in a container it
// never floats. The decisions are read back from the compiler (AC-5) and must
// agree with the pages.
// Source of truth: docs/user-stories/US-028-image-fit.md.
import {afterAll, describe, expect, it} from 'vitest';
import {
  bookCompiler,
  BOOK_FONTS,
  BOOK_IMAGES,
  convertBook,
  disposeBookCompiler,
  filler,
  MAP_PATH,
  pageOf,
  type BookOptions,
} from '../support/book';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parsePreset} from '../../src/core/presets';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {createFontSet} from '../../src/plugin/fonts';
import {convertNote, type PrepareDeps} from '../../src/plugin/prepare-note';
import {
  DEFAULT_PLUGIN_DATA,
  type PluginData,
} from '../../src/plugin/settings/data';
import {LoopbackWorker} from '../support/fake-worker';
import {readPdfPages, type PdfPage} from '../support/pdf';
import {listFiles, SAMPLE_DIR, VAULT} from '../support/sample';

afterAll(() => disposeBookCompiler());

interface Run {
  pages: PdfPage[];
  decisions: {d: string; line: number; name: string}[];
  typ: string;
}

/** Converts and compiles; returns the pages and the decisions read back. */
async function compileFit(source: string, options: BookOptions): Promise<Run> {
  const result = await convertBook(source, options);
  const files: Record<string, Uint8Array> = {};
  for (const use of result.assets) {
    files[use.to] = BOOK_IMAGES[use.from] as Uint8Array;
  }
  const compiled = await bookCompiler().compile({
    file: 'main.typ',
    source: result.typ,
    files,
    fonts: [...BOOK_FONTS],
  });
  if (!compiled.ok) throw new Error(`${compiled.error}\n${result.typ}`);
  const decisions =
    (compiled as unknown as {fitDecisions?: Run['decisions']}).fitDecisions ??
    [];
  return {pages: readPdfPages(compiled.pdf), decisions, typ: result.typ};
}

let measuredText: number | undefined;

/**
 * US-028 AC-6: the text width of the test page, as the drawn width of the
 * 800 px image at the top level (wider than the text, so it gets the text
 * width; checked by the reader test at the end).
 */
async function textWidth(): Promise<number> {
  if (measuredText === undefined) {
    const run = await compileFit('Text.\n\n![[wide.png]]\n\nMore.', {});
    measuredText = run.pages.flatMap((p) => p.images)[0]?.width ?? 0;
  }
  return measuredText;
}

const fit = (minScale: number, more: Record<string, unknown> = {}) =>
  ({extra: {images: {minScale}, ...more}}) satisfies BookOptions;

/** The first page that carries an image, 1-based; 0 when none. */
const imagePage = (pages: readonly PdfPage[]): number =>
  pages.findIndex((p) => p.hasImage) + 1;

/** Text before, the image, text after. */
const around = (
  k: number,
  image = '![[map.png]]',
  after = 'AFTER START.',
): string =>
  [
    filler(k),
    '',
    'BEFORE END.',
    '',
    image,
    '',
    after,
    '',
    filler(6, 'Tail'),
  ].join('\n');

interface Seen {
  kept: number;
  floated: number;
  moved: number;
  /** AC-13 (decision 11): the image starts the next page after its text. */
  turned: number;
  /** AC-8: a float whose text after it starts on the next page (the edge). */
  edge: number;
}

/**
 * US-028 AC-4, AC-8 (decision 12): the text after a floated image fills the
 * gap; in a sweep (one paragraph more each case) only the last case of a run
 * of floats may leave it, the tightest edge. `kinds[k]` is case k's kind.
 */
function expectFloatsFill(kinds: readonly (keyof Seen)[], why: string): void {
  kinds.forEach((kind, k) => {
    if (kind !== 'edge') return;
    const next = kinds[k + 1];
    expect(
      next === 'floated' || next === 'edge',
      `${why}: k = ${k} leaves the gap inside a run of floats (AC-4)\n${kinds.join(' ')}`,
    ).toBe(false);
  });
}

/**
 * Checks one run by the rules of AC-4 and returns its kind. `floats` false: a
 * container or a page break follows (no float allowed).
 */
function judge(
  run: Run,
  sides: boolean,
  floats: boolean,
  why: string,
): keyof Seen {
  const {pages, decisions} = run;
  const text = pageOf(pages, 'BEFORE END.');
  const image = imagePage(pages);
  const after = pageOf(pages, 'AFTER START.');
  const decision = decisions[0]?.d;
  expect(decisions, `one decision read back\n${why}`).toHaveLength(1);
  if (image === text) {
    expect(['full', 'shrink'], why).toContain(decision);
    return 'kept';
  }
  if (decision === 'full') {
    // AC-13 (decision 11): even the space above no longer fit at the page
    // bottom; the image starts the next page right after its text, as at
    // 100: nothing stands before it on its page (a caption stands below it).
    expect(image, `the page after its text\n${why}`).toBe(text + 1);
    expect(
      pages[image - 1]?.text.trimStart() ?? '',
      `nothing before the image on its page\n${why}`,
    ).toMatch(/^((\d+\.)*\d+\s+)?(A map of the valley\s+)?(AFTER START\.|$)/);
    return 'turned';
  }
  expect(image, `the image is on the text page or the next\n${why}`).toBe(
    text + 1,
  );
  if (decision === 'float') {
    expect(floats, `no float here\n${why}`).toBe(true);
    expect(
      !sides || text % 2 === 0,
      `a float only from a left page\n${why}`,
    ).toBe(true);
    // the text after it fills the gap (AC-8: at the tightest edge it may
    // not; `expectFloatsFill` keeps that to the last case of a run)
    expect([text, text + 1], why).toContain(after);
    return after === text ? 'floated' : 'edge';
  }
  expect(decision, why).toBe('move');
  expect(
    after,
    `nothing flows up past a moved image\n${why}`,
  ).toBeGreaterThanOrEqual(image);
  if (floats && sides)
    expect(text % 2, `a move only from a right page\n${why}`).toBe(1);
  return 'moved';
}

describe(
  'US-028 AC-4, AC-12 the sweep at the top level (SCAR-021)',
  {timeout: 900_000},
  () => {
    for (const [minScale, facing] of [
      [70, true],
      [50, true],
      [10, true],
      [99, true],
      [70, false],
    ] as const) {
      it(`US-028 AC-4: minScale ${minScale}, facing pages ${facing ? 'on' : 'off'}: every case kept, floated or moved by the rules; each kind seen`, async () => {
        const seen: Seen = {kept: 0, floated: 0, moved: 0, turned: 0, edge: 0};
        const kinds: (keyof Seen)[] = [];
        for (let k = 0; k <= 30; k++) {
          const run = await compileFit(around(k), {
            facingPages: facing,
            ...fit(minScale),
          });
          kinds.push(judge(run, facing, true, `k = ${k}`));
          seen[kinds[k] as keyof Seen]++;
        }
        expectFloatsFill(kinds, `minScale ${minScale}`);
        expect(seen.kept).toBeGreaterThan(0);
        expect(seen.floated, JSON.stringify(seen)).toBeGreaterThan(0);
        if (facing) expect(seen.moved, JSON.stringify(seen)).toBeGreaterThan(0);
        else expect(seen.moved).toBe(0);
      });
    }

    it('US-028 AC-4: shrinking keeps an image that today goes to the next page (minScale 70 vs 100)', async () => {
      let rescued = 0;
      for (let k = 0; k <= 30; k++) {
        const today = await compileFit(around(k), fit(100));
        const shrunk = await compileFit(around(k), fit(70));
        const text = pageOf(today.pages, 'BEFORE END.');
        if (
          imagePage(today.pages) === text + 1 &&
          shrunk.decisions[0]?.d === 'shrink'
        ) {
          expect(imagePage(shrunk.pages)).toBe(
            pageOf(shrunk.pages, 'BEFORE END.'),
          );
          rescued++;
        }
      }
      expect(rescued).toBeGreaterThan(0);
    });

    it('US-028 AC-4: the decision is stable: two fresh compiles of each case agree (SCAR-021, SCAR-023)', async () => {
      for (const k of [6, 8, 10, 18, 20]) {
        const first = await compileFit(around(k), fit(70));
        disposeBookCompiler();
        const second = await compileFit(around(k), fit(70));
        expect(second.decisions, `k = ${k}`).toEqual(first.decisions);
        expect(imagePage(second.pages)).toBe(imagePage(first.pages));
      }
    });
  },
);

describe(
  'US-028 AC-6 containers: shrink only (measured)',
  {timeout: 900_000},
  () => {
    const containers: [string, (image: string) => string][] = [
      [
        'callout',
        (img) => `> [!note]\n> BEFORE END.\n>\n> ${img}\n>\n> AFTER START.`,
      ],
      [
        'callout in a callout',
        (img) =>
          `> [!note]\n> Outer.\n>\n> > [!note]\n> > BEFORE END.\n> >\n> > ${img}\n> >\n> > AFTER START.`,
      ],
      ['quote', (img) => `> BEFORE END.\n>\n> ${img}\n>\n> AFTER START.`],
      ['list item', (img) => `- BEFORE END.\n\n  ${img}\n\n  AFTER START.`],
      // amendment 2026-10-29 (measured): the reserves add up
      [
        'callout in a quote',
        (img) =>
          `> Quote.\n>\n> > [!note]\n> > BEFORE END.\n> >\n> > ${img}\n> >\n> > AFTER START.`,
      ],
      [
        'quote in a list item',
        (img) =>
          `- Item.\n\n  > BEFORE END.\n  >\n  > ${img}\n  >\n  > AFTER START.`,
      ],
    ];
    for (const [name, wrap] of containers) {
      for (const image of ['![[map.png]]', '![[wide.png]]']) {
        it(`US-028 AC-6: ${name}, ${image}: never floats; kept or moved by the rules; never wider than its container`, async () => {
          const text = await textWidth();
          for (let k = 0; k <= 26; k++) {
            const run = await compileFit(
              `${filler(k)}\n\n${wrap(image)}\n\n${filler(4, 'Tail')}`,
              fit(70),
            );
            judge(run, true, false, `${name} k = ${k}`);
            // the width comes from the container (user's answer 2026-10-29)
            const drawn = run.pages.flatMap((p) => p.images);
            expect(drawn, `${name} k = ${k}`).toHaveLength(1);
            // a callout's body is the text width less 2 × its inset (8 pt;
            // the stroke takes no room in Typst, measured 2026-10-29)
            const bound = name.includes('callout') ? text - 16 : text - 1;
            expect(drawn[0]?.width, `${name} k = ${k}`).toBeLessThanOrEqual(
              bound + 0.01,
            );
          }
        });
      }
    }
  },
);

describe(
  'US-028 AC-6 a callout style at its bounds (amendment 2026-10-29; measured)',
  {timeout: 900_000},
  () => {
    it('US-028 AC-6: inset 50 pt and border 10 pt: never floats; kept or moved by the rules', async () => {
      for (let k = 0; k <= 26; k++) {
        const run = await compileFit(
          `${filler(k)}\n\n> [!note]\n> BEFORE END.\n>\n> ![[map.png]]\n>\n> AFTER START.\n\n${filler(4, 'Tail')}`,
          {
            ...fit(70),
            over: {callouts: {note: {inset: 50, border: {width: 10}}}},
          },
        );
        judge(run, true, false, `k = ${k}`);
        // 225 pt wide; the box leaves the text width less 2 × 50 pt (the
        // stroke takes no room, measured 2026-10-29)
        const drawn = run.pages.flatMap((p) => p.images);
        expect(drawn[0]?.width, `k = ${k}`).toBeLessThanOrEqual(
          (await textWidth()) - 100 + 0.01,
        );
      }
    });
  },
);

describe(
  'US-028 AC-2, AC-3 the parts and the page breaks of US-026, US-027 (decisions 5 to 7; measured)',
  {timeout: 900_000},
  () => {
    const BOOK = {colophonHeading: 'hidden', backNotesHeading: 'hidden'};

    it('US-028 AC-3: the last block of the colophon never floats; the first chapter stays on a left page', async () => {
      for (let k = 0; k <= 26; k++) {
        const run = await compileFit(
          `# Colophon\n\n${filler(k)}\n\nBEFORE END.\n\n![[map.png]]\n\n# Rules\n\nAFTER START.\n\n${filler(3)}`,
          fit(70, {book: BOOK}),
        );
        judge(run, true, false, `k = ${k}`);
        expect(pageOf(run.pages, 'AFTER START.') % 2, `k = ${k}`).toBe(0);
      }
    });

    it('US-028 AC-3: the last block before the back notes never floats; signature 8 and the back notes on the last page hold', async () => {
      for (let k = 0; k <= 26; k++) {
        const run = await compileFit(
          `# Rules\n\n${filler(k)}\n\nBEFORE END.\n\n![[map.png]]\n\n# Back notes\n\nAFTER START.`,
          fit(70, {book: {...BOOK, signature: 8}}),
        );
        judge(run, true, false, `k = ${k}`);
        expect(run.pages.length % 8, `k = ${k}`).toBe(0);
        expect(run.pages.at(-1)?.text, `k = ${k}`).toContain('AFTER START.');
      }
    });

    it('US-028 AC-2 (decision 7): inside the back notes an image never floats; signature 8 and the back notes on the last page hold', async () => {
      for (let k = 0; k <= 26; k++) {
        const run = await compileFit(
          `# Rules\n\nText.\n\n# Back notes\n\n${filler(k)}\n\nBEFORE END.\n\n![[map.png]]\n\nAFTER START.\n\n${filler(3, 'Tail')}`,
          fit(70, {book: {...BOOK, signature: 8}}),
        );
        judge(run, true, false, `k = ${k}`);
        expect(run.pages.length % 8, `k = ${k}`).toBe(0);
        expect(run.pages.at(-1)?.text, `k = ${k}`).toContain('Tail 2');
      }
    });

    it('US-028 AC-3: before contents placed in the body an image never floats (US-027)', async () => {
      for (let k = 0; k <= 26; k++) {
        const run = await compileFit(
          `# Rules\n\n${filler(k)}\n\nBEFORE END.\n\n![[map.png]]\n\n# Lore\n\nAFTER START.`,
          fit(70, {toc: {depth: 1, heading: 'Lore', position: 'before'}}),
        );
        judge(run, true, false, `k = ${k}`);
      }
    });
  },
);

describe('US-028 AC-3, AC-7 captions and sizes', {timeout: 900_000}, () => {
  for (const [name, image] of [
    ['a captioned image', '![A map of the valley|](assets/map.png)'],
    ['width 200 px', '![[map.png|200]]'],
    ['width and height 400x100 px', '![[map.png|400x100]]'],
    ['width and height 200x300 px', '![[tall.png|200x300]]'],
  ] as const) {
    it(`US-028 AC-7: ${name}: every case by the rules`, async () => {
      const kinds: (keyof Seen)[] = [];
      for (let k = 0; k <= 26; k++) {
        kinds.push(
          judge(
            await compileFit(around(k, image), fit(70)),
            true,
            true,
            `${name} k = ${k}`,
          ),
        );
      }
      expectFloatsFill(kinds, name);
    });
  }
});

describe(
  'US-028 AC-4 before a page break (decision 5)',
  {timeout: 600_000},
  () => {
    it('US-028 AC-4: an image before an H1 with a break is moved, never floated; the heading follows it', async () => {
      let moved = 0;
      for (let k = 0; k <= 26; k++) {
        const source = `${filler(k)}\n\nBEFORE END.\n\n![[map.png]]\n\n# AFTER START.\n\n${filler(3)}`;
        const run = await compileFit(
          source,
          fit(70, {breakBefore: {h1: 'page'}}),
        );
        if (judge(run, true, false, `k = ${k}`) === 'moved') moved++;
        expect(pageOf(run.pages, 'AFTER START.')).toBeGreaterThan(
          imagePage(run.pages),
        );
      }
      expect(moved).toBeGreaterThan(0);
    });
  },
);

describe(
  'US-028 AC-5 the decisions read back after a compile',
  {timeout: 120_000},
  () => {
    it('US-028 AC-5: each image gives one decision with its line and its name, in document order', async () => {
      const source = `${filler(2)}\n\n![[map.png]]\n\n${filler(2)}\n\n![[wide.png]]\n\nEnd.`;
      const run = await compileFit(source, fit(70));
      // filler(2) is three lines (two paragraphs, a blank): map.png on line
      // 5, the second filler on lines 7 to 9, wide.png on line 11 (the
      // user's answer of 2026-10-29: the test had 9).
      expect(run.decisions.map((d) => [d.line, d.name])).toEqual([
        [5, 'map.png'],
        [11, 'wide.png'],
      ]);
    });

    it('US-028 AC-5: the compiler service returns the decision values of a document in order (typst.ts query, measured)', async () => {
      const compiled = await bookCompiler().compile({
        file: 'main.typ',
        source:
          '#metadata((d: "float", line: 12, name: "map.png")) <o2t-fit-decision>\n#metadata((d: "shrink", line: 30, name: "b.png")) <o2t-fit-decision>\nText.\n',
        files: {},
        fonts: [...BOOK_FONTS],
      });
      expect(compiled.ok).toBe(true);
      expect(
        (compiled as unknown as {fitDecisions?: unknown[]}).fitDecisions,
      ).toEqual([
        {d: 'float', line: 12, name: 'map.png'},
        {d: 'shrink', line: 30, name: 'b.png'},
      ]);
    });

    it('US-028 AC-5 guard: at 100 nothing is read back', async () => {
      const run = await compileFit(around(8), fit(100));
      expect(run.decisions).toEqual([]);
    });
  },
);

describe(
  'US-028 AC-11 the composed book (SCAR-002)',
  {timeout: 600_000},
  () => {
    it('US-028 AC-11: cover, colophon, back notes, breaks, contents, callout, caption, size, table cell, footnotes, page refs: compiles; every text and image; the signature holds', async () => {
      const source = [
        '# Colophon',
        '',
        'Printed in 2026.',
        '',
        '# Rules',
        '',
        `Intro, see [Combat](#combat) and a footnote[^1].`,
        '',
        filler(8),
        '',
        '![A map of the valley|](assets/map.png)',
        '',
        '## Combat',
        '',
        filler(6),
        '',
        '> [!note]',
        '> In the box.',
        '>',
        '> ![[wide.png]]',
        '',
        '![[map.png|300x150]]',
        '',
        '| Cell |',
        '|--|',
        '| ![[map.png]] |',
        '',
        filler(4, 'Last'),
        '',
        '![[tall.png]]',
        '',
        '# Lore',
        '',
        'Lore text.',
        '',
        '# Back notes',
        '',
        'Back note text.',
        '',
        '[^1]: The footnote text.',
      ].join('\n');
      const run = await compileFit(source, {
        cover: 'cover',
        over: {linkPageNumbers: true, linkPageLevel: 2, linkPageWord: 'p.'},
        extra: {
          images: {minScale: 70},
          book: {signature: 8, romanFrontMatter: true},
          breakBefore: {h1: 'right'},
          toc: {depth: 2},
        },
      });
      const all = run.pages.map((p) => p.text).join(' ');
      for (const text of [
        'Printed in 2026.',
        'Intro, see',
        'A map of the valley',
        'In the box.',
        'Cell',
        'Lore text.',
        'Back note text.',
        'The footnote text.',
      ]) {
        expect(all, text).toContain(text);
      }
      expect(run.pages.length % 8).toBe(0);
      expect(run.pages[run.pages.length - 1]?.text).toContain(
        'Back note text.',
      );
      // the figure, the callout image, the sized image, the image right before
      // the page-break heading `# Lore` (lines + 2: the cover line in front)
      const lineOf = (text: string) => source.split('\n').indexOf(text) + 3;
      expect(run.decisions.map((d) => d.line)).toEqual([
        lineOf('![A map of the valley|](assets/map.png)'),
        lineOf('> ![[wide.png]]'),
        lineOf('![[map.png|300x150]]'),
        lineOf('![[tall.png]]'),
      ]);
      // decision 9: the name as written
      expect(run.decisions[0]?.name).toBe('assets/map.png');
      expect(run.decisions[1]?.name).toBe('wide.png');
      expect(run.decisions[3]?.name).toBe('tall.png');
      expect(run.decisions[1]?.d).not.toBe('float'); // in a callout
      expect(run.decisions[3]?.d).not.toBe('float'); // before a page break
      // the heading follows the image it comes after
      const lastImage = run.pages.findLastIndex((p) => p.hasImage) + 1;
      expect(pageOf(run.pages, 'Lore text.')).toBeGreaterThan(lastImage);
      expect(run.pages.filter((p) => p.hasImage).length).toBeGreaterThanOrEqual(
        4,
      );
    });
  },
);

describe('US-028 AC-6 the PDF reader reads drawn image sizes (SCAR-028)', () => {
  it('US-028 AC-6: guard — known images give their drawn widths in order; a page without one gives none', async () => {
    const compiled = await bookCompiler().compile({
      file: 'main.typ',
      source:
        '#set page(width: 300pt, height: 400pt, margin: 20pt)\nText.\n\n#image("a.png", width: 100pt)\n\n#box(image("a.png", width: 40pt, height: 10pt))\n#pagebreak()\nNo image.',
      files: {'a.png': BOOK_IMAGES[MAP_PATH] as Uint8Array},
      fonts: [...BOOK_FONTS],
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const pages = readPdfPages(compiled.pdf);
    // map.png is 300 × 200 px: 100 pt wide is 66.7 pt high
    expect(pages[0]?.images.map((i) => Math.round(i.width))).toEqual([100, 40]);
    expect(Math.round(pages[0]?.images[0]?.height ?? 0)).toBe(67);
    // AC-13: its place: the left margin (20 pt), below the text line, inside
    // the page (400 pt high, PDF points from the lower left corner)
    const first = pages[0]?.images[0];
    expect(first?.x).toBeCloseTo(20, 2);
    expect((first?.y ?? 0) + (first?.height ?? 0)).toBeLessThan(380);
    expect(first?.y ?? 0).toBeGreaterThan(20);
    expect(pages[1]?.images).toEqual([]);
    // the text width of the test page: what the container bounds rest on
    const top = await textWidth();
    // (the image is 800 px = 600 pt: less means it was held to the text)
    expect(top).toBeGreaterThan(200);
    expect(top).toBeLessThan(600);
  });
});

describe(
  'US-028 AC-13 the look as today (decision 11; measured)',
  {timeout: 600_000},
  () => {
    it("US-028 AC-13: where every image fits, the pages at 70 equal those at 100: each image's page, place and size, each page's text", async () => {
      const source = [
        'Intro text.',
        '',
        // small sizes, so that no image comes near a page bottom
        '![A map|120](assets/map.png)',
        '',
        'Text after the figure.',
        '',
        '> Quote text.',
        '>',
        '> | a | b |',
        '> |--|--|',
        '> | c | d |',
        '>',
        '> ![[map.png|120]]',
        '>',
        '> More quote.',
        '',
        '> [!note]',
        '> Box text.',
        '>',
        '> ![[wide.png|200]]',
        '>',
        '> More box.',
        '',
        '- Item text.',
        '',
        '  ![[map.png|120]]',
        '',
        '  More item.',
        '',
        'Plain text.',
        '',
        '![[map.png|120]]',
        '',
        'End text.',
      ].join('\n');
      const today = await compileFit(source, {});
      const fitted = await compileFit(source, fit(70));
      // the rule acted on every image and kept each at full size
      expect(fitted.decisions.map((d) => d.d)).toEqual([
        'full',
        'full',
        'full',
        'full',
        'full',
      ]);
      const places = (run: Run): string[] =>
        run.pages.flatMap((p, i) =>
          p.images.map(
            (m) =>
              `p${i + 1} ${m.x.toFixed(2)} ${m.y.toFixed(2)} ${m.width.toFixed(2)}x${m.height.toFixed(2)}`,
          ),
        );
      expect(places(today)).toHaveLength(5);
      expect(places(fitted)).toEqual(places(today));
      expect(fitted.pages.map((p) => p.text)).toEqual(
        today.pages.map((p) => p.text),
      );
    });
  },
);

/**
 * US-028 AC-4 (decision 13): the M18 settings — the `Contents` preset of M17
 * single-sided with `images.minScale`, and the Defaults of the M18 vault.
 */
const M18_PRESET = (minScale: number): string =>
  [
    '---',
    'schemaVersion: 1',
    'page:',
    '  trimSize: A5',
    '  facingPages: false',
    '  folios: true',
    '  runningHeader: true',
    '  runningHeaderLevel: 2',
    'cover:',
    '  mode: auto',
    'book:',
    '  signature: 8',
    '  romanFrontMatter: true',
    '  firstChapter: left',
    'toc:',
    '  depth: 2',
    'images:',
    `  minScale: ${minScale}`,
    'headingRules:',
    '  Senectus Netus: colophon',
    '  Pretium Fames: back-notes',
    '---',
    '',
  ].join('\n');
const M18_DATA: PluginData = {
  ...DEFAULT_PLUGIN_DATA,
  defaults: {
    externalLinkFootnotes: true,
    linkPageNumbers: true,
    page: {folios: true, runningHeader: true, runningHeaderLevel: 4},
    fonts: {
      body: {size: 12},
      heading: {size: 18},
      code: {family: 'DejaVu Sans Mono'},
    },
  },
};

/** The probe's page and the floated figure's page of each call, read back. */
const READ_PAGES = (calls: number): string =>
  `\n#context { for i in range(1, ${calls + 1}) { let f = query(label("o2t-fit-" + str(i) + "-f")); [#metadata((d: "pos", line: i, name: str(locate(label("o2t-fit-" + str(i))).page()))) <o2t-fit-decision>]; [#metadata((d: "fpage", line: i, name: if f.len() > 0 { str(f.first().location().page()) } else { "-" })) <o2t-fit-decision>] } }\n`;

describe(
  'US-028 AC-4 (decision 13) the sample Book.md single-sided: no float on its own page',
  // SCAR-030: two whole-book compiles, about 7.5 s each alone (2026-10-29)
  {timeout: 600_000},
  () => {
    // a compiler of its own: a Typst panic was seen after many whole-book
    // compiles in one instance (decision 12, not verified)
    const compiler = createTypstCompiler({
      createWorker: () => new LoopbackWorker(),
      compilerWasm: async () =>
        new Uint8Array(
          readFileSync(
            'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
          ),
        ),
    });
    afterAll(() => compiler.dispose());
    const files = listFiles(SAMPLE_DIR)
      .filter((f) => f !== 'manifest.json')
      .map((f) => `${VAULT}/${f}`);
    const bytes = (path: string): Uint8Array =>
      new Uint8Array(
        readFileSync(join(SAMPLE_DIR, path.slice(VAULT.length + 1))),
      );
    const fonts = createFontSet({
      bundled: async () => BOOK_FONTS,
      vault: {
        files: () => files,
        folderExists: async () => false,
        readBytes: async (path) => bytes(path),
      },
      compiler,
    });
    // convertNote reads only notes.read, vault.files / readHead / readText,
    // fonts and settings.data; the store (presets) is not used
    const deps = {
      notes: {
        read: async (path: string) => new TextDecoder().decode(bytes(path)),
      },
      vault: {
        files: () => files,
        readHead: async (path: string, n = 16) => bytes(path).subarray(0, n),
        readText: async () => null,
      },
      fonts,
      settings: {data: M18_DATA},
    } as unknown as PrepareDeps;

    async function compileM18(minScale: number) {
      const parsed = parsePreset(M18_PRESET(minScale));
      if (!parsed.ok) throw new Error('the M18 preset is invalid');
      const prepared = await convertNote(
        deps,
        `${VAULT}/Book.md`,
        'M18',
        parsed,
      );
      if (!prepared.ok) throw new Error(prepared.message);
      const assets: Record<string, Uint8Array> = {};
      for (const use of prepared.uses) assets[use.to] = bytes(use.from);
      const calls = (prepared.typ.match(/^#fit-flow\(/gm) ?? []).length;
      const compiled = await compiler.compile({
        file: 'main.typ',
        source: prepared.typ + (calls > 0 ? READ_PAGES(calls) : ''),
        files: assets,
        fonts: [...BOOK_FONTS, ...prepared.fonts],
      });
      if (!compiled.ok) throw new Error(String(compiled.error));
      const all =
        (compiled as unknown as {fitDecisions?: Run['decisions']})
          .fitDecisions ?? [];
      return {
        pages: readPdfPages(compiled.pdf),
        decisions: all.filter((d) => d.d !== 'pos' && d.d !== 'fpage'),
        probe: all.filter((d) => d.d === 'pos').map((d) => Number(d.name)),
        floated: all.filter((d) => d.d === 'fpage').map((d) => d.name),
      };
    }

    it('US-028 AC-4 (decision 13): every floated image stands on the page after its probe; figure-10.png is kept where it stands at 100', async () => {
      const today = await compileM18(100);
      const fitted = await compileM18(70);
      expect(fitted.decisions).toHaveLength(70);
      let floats = 0;
      fitted.decisions.forEach((d, i) => {
        if (d.d !== 'float') return;
        floats++;
        expect(fitted.floated[i], `${d.name}: the page of the float`).toBe(
          String((fitted.probe[i] ?? 0) + 1),
        );
      });
      expect(floats).toBeGreaterThan(0);
      // figure-10.png (line 1126) fits after its text at 100 (measured p. 68)
      const at = fitted.decisions.findIndex((d) => d.line === 1126);
      expect(fitted.decisions[at]?.name).toBe('assets/figure-10.png');
      expect(fitted.decisions[at]?.d).toBe('full');
      const page = fitted.probe[at] ?? 0;
      const place = (pages: PdfPage[]) =>
        pages[page - 1]?.images.map((m) => [
          m.x.toFixed(2),
          m.y.toFixed(2),
          m.width.toFixed(1),
          m.height.toFixed(1),
        ]);
      expect(place(today.pages)).toHaveLength(1);
      expect(place(fitted.pages)).toEqual(place(today.pages));
    });
  },
);
