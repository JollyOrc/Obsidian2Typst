// US-031 AC-7a, AC-7b, AC-9, AC-14; US-032 AC-2, AC-9; US-034 AC-2
// (amendment for #139) — the landscape illustration directly under the
// text, grown into the free space and centred when the width limits it,
// today's fallback when the free space is smaller than its slot; the
// portrait forms (columns or stacked), the larger picture winning by the
// table of AC-7b. Read from the pages (drawn size and position of each
// image), the `<o2t-entry>` facts (form, the widths compared) and the
// `<o2t-image>` facts.
// Source of truth: docs/user-stories/US-031-entry-layouts-on-facing-pages.md.
// Red until #139's layouts are implemented (G2, 2026-11-09).
import {afterAll, describe, expect, it} from 'vitest';
import {filler} from '../support/book';
import {A5_PRINT} from '../support/convert';
import {ENTRIES, entry} from '../support/entries';
import {
  compileEntries,
  disposeEntriesCompiler,
  type CompiledEntries,
  type EntryPlace,
} from '../support/entries-pdf';
import {png} from '../support/images';

afterAll(disposeEntriesCompiler);

// SCAR-030: one chapter compile is 0.3 to 2 s in the full run; sweeps more.
const SLOW = 30_000;
const SWEEP = 120_000;

const pt = (mm: number): number => (mm * 72) / 25.4;
const mm = (points: number): number => (points * 25.4) / 72;
const TEXT_W =
  A5_PRINT.pageWidth - A5_PRINT.margins.inside - A5_PRINT.margins.outside;
const TEXT_H =
  A5_PRINT.pageHeight - A5_PRINT.margins.top - A5_PRINT.margins.bottom;
const BOTTOM = A5_PRINT.margins.bottom;

const IMAGES = {
  'Sample/assets/e-wide.png': png(300, 200), // 3:2
  'Sample/assets/e-square.png': png(200, 200), // 1:1
  'Sample/assets/e-tall.png': png(100, 200), // 1:2
  'Sample/assets/e-slim.png': png(50, 200), // 1:4
  'Sample/assets/e-three.png': png(150, 200), // 3:4
  'Sample/assets/e-near.png': png(180, 200), // 9:10
};
const LEDE = [
  'Fen hares are quick and shy. They live in reed beds and flee at the first sound.',
];

function e(
  name: string,
  layout: string,
  paragraphs: number,
  image?: string,
  extra = 0,
): string {
  const yaml = ['might: 4', `layout: ${layout}`];
  if (image !== undefined) yaml.push(`illustration: "![](assets/${image})"`);
  // #160: `extra` short words in a last paragraph, to reach a window of
  // about 1.5 lines that whole paragraphs step over.
  const tail =
    extra === 0
      ? []
      : ['', Array.from({length: extra}, (_, i) => `w${i}`).join(' ')];
  return entry(`### ${name}`, yaml, [
    ...LEDE,
    '',
    filler(paragraphs, name),
    ...tail,
  ]);
}
const chapter = (...entries: string[]): string =>
  [
    '# Menagerie',
    '',
    '## Beasts',
    '',
    'Beasts intro.',
    '',
    ...entries.flatMap((x) => [x, '']),
  ].join('\n');

const compile = (
  source: string,
  over: Record<string, unknown> = {},
  facing = true,
): Promise<CompiledEntries> =>
  compileEntries(source, {
    over: {headingRules: {Menagerie: 'entries'}, ...over},
    images: IMAGES,
    book: {facingPages: facing},
  });

const place = (c: CompiledEntries, heading: string): EntryPlace => {
  const p = c.places.find((x) => x.heading === heading);
  if (p === undefined) throw new Error(`no <o2t-entry> for ${heading}`);
  return p;
};
/** The illustration on 1-based page `page` (the only image there). */
const imageOn = (c: CompiledEntries, page: number) =>
  c.pages[page - 1]?.images[0];
/** The text area's centre line, x in pt, for a 1-based page. */
const centreX = (page: number): number => {
  const even = page % 2 === 0;
  const left = even ? A5_PRINT.margins.outside : A5_PRINT.margins.inside;
  return pt(left + TEXT_W / 2);
};
const noConvergeWarning = (c: CompiledEntries): void =>
  expect(c.diagnostics.filter((d) => /converge/i.test(d))).toEqual([]);

describe('US-031 AC-7a the landscape illustration under the text, grown', () => {
  it(
    'US-031 AC-7a: spread-landscape with all text on the left page — a 1:1 picture grows to the text width, centred in the right page',
    async () => {
      const c = await compile(
        chapter(e('Cave Wyrm', 'spread-landscape', 2, 'e-square.png')),
      );
      const right = place(c, 'Cave Wyrm').page + 1;
      const img = imageOn(c, right);
      expect(img?.width).toBeCloseTo(pt(TEXT_W), 0);
      expect(img?.height).toBeCloseTo(pt(TEXT_W), 0);
      // Centred vertically: as much room below as above, in the text area.
      expect(mm(img?.y ?? 0) - BOTTOM).toBeCloseTo((TEXT_H - TEXT_W) / 2, 0);
      expect(place(c, 'Cave Wyrm').grown).toBe(true);
      noConvergeWarning(c);
    },
    SLOW,
  );

  it(
    'US-031 AC-7a (G0 answer 8): a 3:2 picture cannot grow (already at text width) and is centred, not at the page foot',
    async () => {
      const c = await compile(
        chapter(e('Cave Wyrm', 'spread-landscape', 2, 'e-wide.png')),
      );
      const img = imageOn(c, place(c, 'Cave Wyrm').page + 1);
      expect(img?.width).toBeCloseTo(pt(TEXT_W), 0);
      expect(img?.height).toBeCloseTo(pt((TEXT_W * 2) / 3), 0);
      expect(mm(img?.y ?? 0) - BOTTOM).toBeCloseTo(
        (TEXT_H - (TEXT_W * 2) / 3) / 2,
        0,
      );
    },
    SLOW,
  );

  it(
    'US-031 AC-7a, AC-14 (SCAR-021): across right-page text lengths the picture is never smaller than its slot, sits in the free space, is centred when the width limits it, or falls back to the next page; one compile settles',
    async () => {
      let grown = 0;
      let fallback = 0;
      for (const n of [16, 20, 24, 28, 32, 34, 36]) {
        const name = `Cave ${n}`;
        const c = await compile(
          chapter(e(name, 'spread-landscape', n, 'e-square.png')),
        );
        noConvergeWarning(c);
        const p = place(c, name);
        const slot = Math.min(TEXT_W, TEXT_H / 2) * ((p.scale ?? 100) / 100);
        if (p.grown === true) {
          grown++;
          // Under the text: on the entry's last page (the right page, or
          // the page after it when the text itself runs past the spread).
          const last = c.ends.find((x) => x.heading === name)?.page ?? 0;
          const img = imageOn(c, last);
          expect(img, name).toBeDefined();
          expect(mm(img?.width ?? 0)).toBeGreaterThanOrEqual(slot - 0.2);
          // Inside the text area; centred: the gap below equals the gap above
          // when the picture is at the text width (width-limited).
          expect(mm(img?.y ?? 0)).toBeGreaterThanOrEqual(BOTTOM - 0.2);
          if (Math.abs(mm(img?.width ?? 0) - TEXT_W) < 0.2) {
            const below = mm(img?.y ?? 0) - BOTTOM;
            expect(below, `${name} centred`).toBeGreaterThan(0.2);
          } else {
            // Height-limited: it fills the free height down to the foot.
            expect(mm(img?.y ?? 0) - BOTTOM).toBeLessThan(0.5);
          }
        } else {
          fallback++;
          // Today's rule: at the slot's size, on the page after the spread.
          const end = c.ends.find((x) => x.heading === name);
          expect(end?.page ?? 0).toBeGreaterThan(p.page + 1);
          expect(end?.overflowLines ?? 0).toBeGreaterThan(0);
        }
      }
      // SCAR-023: both branches were reached by the sweep.
      expect(grown).toBeGreaterThan(0);
      expect(fallback).toBeGreaterThan(0);
    },
    SWEEP,
  );

  it(
    'US-031 AC-9 (amended): page-landscape — a 1:1 picture under a short text grows past 40 % of the text height',
    async () => {
      const c = await compile(
        chapter(e('Square One', 'page-landscape', 1, 'e-square.png')),
      );
      const img = imageOn(c, place(c, 'Square One').page);
      expect(mm(img?.height ?? 0)).toBeGreaterThan(TEXT_H * 0.4 + 1);
      expect(mm(img?.y ?? 0)).toBeGreaterThanOrEqual(BOTTOM - 0.2);
      expect(place(c, 'Square One').grown).toBe(true);
    },
    SLOW,
  );

  it(
    'US-034 AC-2 (amended): the grown picture is recorded at its drawn width',
    async () => {
      const c = await compile(
        chapter(e('Cave Wyrm', 'spread-landscape', 2, 'e-square.png')),
      );
      const fact = c.images.find((i) => i.file.endsWith('e-square.png'));
      expect(fact?.widthMm).toBeCloseTo(TEXT_W, 0);
    },
    SLOW,
  );

  it(
    'US-032 AC-9 (amended, G0 answer 9): the space below a centred picture counts as unused on the right page',
    async () => {
      const c = await compile(
        chapter(e('Cave Wyrm', 'spread-landscape', 2, 'e-wide.png')),
      );
      const end = c.ends.find((x) => x.heading === 'Cave Wyrm');
      const expected = Math.round(
        ((TEXT_H - (TEXT_W * 2) / 3) / 2 / TEXT_H) * 100,
      );
      expect(end?.rightEmpty ?? -1).toBeGreaterThanOrEqual(expected - 2);
      expect(end?.rightEmpty ?? 999).toBeLessThanOrEqual(expected + 2);
    },
    SLOW,
  );
});

/** US-031 AC-7b's table, applied to an entry's recorded measurements. */
function expectedForm(p: EntryPlace): 'columns' | 'stacked' {
  if (p.text === false) return 'stacked';
  const stackFits = (p.stackW ?? 0) >= (p.minW ?? Infinity) - 0.01;
  if (p.colFits === true && stackFits)
    return (p.stackW ?? 0) > (p.colW ?? 0) + 0.01 ? 'stacked' : 'columns';
  if (stackFits) return 'stacked';
  return 'columns';
}

describe('US-031 AC-7b the portrait forms', () => {
  it(
    'US-031 AC-7b: no text left — a 1:2 picture fills the text height, centred (stacked)',
    async () => {
      const c = await compile(
        chapter(e('Reed Cat', 'spread-portrait', 2, 'e-tall.png')),
      );
      const p = place(c, 'Reed Cat');
      expect(p.form).toBe('stacked');
      const img = imageOn(c, p.page + 1);
      expect(mm(img?.height ?? 0)).toBeCloseTo(TEXT_H, 0);
      expect(mm(img?.width ?? 0)).toBeCloseTo(TEXT_H / 2, 0);
      expect((img?.x ?? 0) + (img?.width ?? 0) / 2).toBeCloseTo(
        centreX(p.page + 1),
        0,
      );
    },
    SLOW,
  );

  it(
    'US-031 AC-7b (G1 answer 2): no text left and a tie (1:4) — centred in the text area, not at the outer edge',
    async () => {
      const c = await compile(
        chapter(e('Reed Eel', 'spread-portrait', 2, 'e-slim.png')),
      );
      const p = place(c, 'Reed Eel');
      const img = imageOn(c, p.page + 1);
      expect(mm(img?.width ?? 0)).toBeCloseTo(TEXT_H / 4, 0);
      expect((img?.x ?? 0) + (img?.width ?? 0) / 2).toBeCloseTo(
        centreX(p.page + 1),
        0,
      );
      expect(p.form).toBe('stacked');
    },
    SLOW,
  );

  it(
    "US-031 AC-7b (G0 answer 13, G1 answer 1): across text lengths the form follows the table and the drawn picture is the chosen form's; each row is reached",
    async () => {
      // Inputs calibrated at G4 of #142 (A5, the test preset), recalibrated
      // at G2 of #160 (the line spacing below a split shortened the text):
      // each reaches one row of the table; the row with an overflowing column
      // and a stacked form that fits exists only in a window of about 1.5
      // lines, reached at minScale 100 with a 9:10 picture on a page, six
      // paragraphs and 6 to 18 extra words (12 taken).
      const seen = new Set<string>();
      const log: string[] = [];
      const cases: [string, string, number, number, number?][] = [
        ['e-tall.png', 'spread-portrait', 2, 70], // no text
        ['e-tall.png', 'spread-portrait', 14, 70], // both fit, stacked larger
        ['e-tall.png', 'spread-portrait', 18, 70], // both fit, columns larger
        ['e-tall.png', 'spread-portrait', 21, 70], // columns only
        // Neither fits, with a stamp-sized stacked picture (G1 answer 1:
        // it does not win; G4 of #142, a mutant that let it win survived).
        ['e-tall.png', 'spread-portrait', 22, 70],
        ['e-tall.png', 'spread-portrait', 30, 70], // neither, no room at all
        ['e-near.png', 'page-portrait', 6, 100, 12], // stacked only
      ];
      for (const [image, layout, n, min, extra] of cases) {
        // A short name: the filler repeats it in every paragraph.
        const name = `X${seen.size}${log.length}`;
        const c = await compile(chapter(e(name, layout, n, image, extra)), {
          entries: {...ENTRIES, image: {minScale: min}},
        });
        noConvergeWarning(c);
        const p = place(c, name);
        expect(p.form, name).toBe(expectedForm(p));
        if (n === 22) {
          expect(p.stackW ?? 0, name).toBeGreaterThan(0);
          expect(p.colFits, name).toBe(false);
        }
        // The picture: on the spread's right page, or on the entry's page.
        const page = layout === 'spread-portrait' ? p.page + 1 : p.page;
        const drawnW = mm(imageOn(c, page)?.width ?? 0);
        const want = p.form === 'stacked' ? (p.stackW ?? 0) : (p.colW ?? 0);
        // On a page the stacked form's free height is estimated below the
        // head (1.2 em); on the right page it is exact.
        expect(Math.abs(drawnW - want), name).toBeLessThan(
          layout === 'spread-portrait' ? 0.5 : 1.5,
        );
        const stackFits = (p.stackW ?? 0) >= (p.minW ?? Infinity) - 0.01;
        log.push(`${name}: ${JSON.stringify(p)}`);
        seen.add(
          p.text === false
            ? 'none'
            : `${p.colFits === true ? 'C' : 'c'}${stackFits ? 'S' : 's'}`,
        );
      }
      // SCAR-023: every row of the table was reached.
      expect([...seen].sort(), log.join('\n')).toEqual([
        'CS',
        'Cs',
        'cS',
        'cs',
        'none',
      ]);
    },
    SWEEP,
  );

  it(
    'US-031 AC-9, AC-15 (amended): page-portrait uses the same table, on facing pages and without them',
    async () => {
      for (const facing of [true, false]) {
        const c = await compile(
          chapter(e('Short Cat', 'page-portrait', 0, 'e-three.png')),
          {},
          facing,
        );
        const p = place(c, 'Short Cat');
        expect(p.form).toBe(expectedForm(p));
        expect(p.form).toBeDefined();
      }
    },
    SLOW,
  );
});

describe('US-032 AC-2 (amended) the automatic choice with the portrait forms', () => {
  it(
    'US-032 AC-2 (G0 answer 11): a portrait entry whose column overflows but whose stacked form fits is placed on one page (page-portrait)',
    async () => {
      // Calibrated at G4 of #142: minScale 100, a 9:10 picture, six
      // paragraphs; recalibrated at G2 of #160 with 12 extra words (the
      // window is 6 to 18); the column overflows at 100 %, the stacked
      // picture is larger than the columns picture at 100 %.
      const c = await compile(
        chapter(e('Auto Cat', 'auto', 6, 'e-near.png', 12)),
        {
          entries: {...ENTRIES, image: {minScale: 100}},
        },
      );
      const p = place(c, 'Auto Cat');
      expect(p.colFits).toBe(false);
      expect(p.form).toBe('stacked');
      expect(p.layout).toBe('page-portrait');
      expect(p.size).toBe('page');
    },
    SLOW,
  );
});
