// US-032 AC-1, AC-2 (report), AC-5, AC-7, AC-9 to AC-11 — the two settings
// and their messages, and the warnings made from the compile's entry facts
// (`<o2t-entry>`, `<o2t-entry-end>`): ENTRY_AUTO, ENTRY_OVERFLOW,
// ENTRY_SPREAD_EMPTY, once per entry, a conflict not also reported as auto.
// The report is a pure function in src/core, loaded at run time (it does not
// exist yet). Placement itself is read from the PDF in
// tests/integration/us-032-fit-pdf.test.ts.
// Source of truth: docs/user-stories/US-032-entry-fit-overflow-and-auto-layout.md.
// Red until US-032 is implemented (G2, 2026-11-06).
import {describe, expect, it} from 'vitest';
import {type Warning} from '../../src/core/emit/context';
import {formatPresetError, parsePreset} from '../../src/core/presets';
import {type EntryEnd, type EntryPlace} from '../support/entries-pdf';

/** The report module the ticket adds (a string keeps tsc from resolving it). */
const REPORT = '../../src/core/entries/report';
interface ReportModule {
  /** US-032 AC-10: the layout warnings from the compile's facts, once per entry. */
  entryLayoutWarnings(
    places: readonly EntryPlace[],
    ends: readonly EntryEnd[],
    options: {emptyWarn: number},
  ): Warning[];
}
const report = async (): Promise<ReportModule> => {
  const path: string = REPORT;
  return (await import(/* @vite-ignore */ path)) as ReportModule;
};
const texts = (ws: readonly Warning[]): string[] =>
  ws.map((w) => `${w.code} ${w.message}`);

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');
function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

describe('US-032 AC-1 settings', () => {
  it('US-032 AC-1: entries.image.minScale 10 to 100; 9 and 101 are refused', () => {
    for (const v of [10, 70, 100])
      expect(
        errorOf('entries:', '  image:', `    minScale: ${v}`),
        String(v),
      ).toBeNull();
    for (const v of [9, 101, 50.5]) {
      expect(
        errorOf('entries:', '  image:', `    minScale: ${v}`),
        String(v),
      ).toBe(
        'entries.image.minScale must be a whole number from 10 to 100 (line 5)',
      );
    }
  });

  it('US-032 AC-1: entries.emptyWarn 0 to 100; -1 and 101 are refused', () => {
    for (const v of [0, 50, 100])
      expect(errorOf('entries:', `  emptyWarn: ${v}`), String(v)).toBeNull();
    for (const v of [-1, 101]) {
      expect(errorOf('entries:', `  emptyWarn: ${v}`), String(v)).toBe(
        'entries.emptyWarn must be a whole number from 0 to 100 (line 4)',
      );
    }
  });
});

const P = (
  heading: string,
  layout: string,
  page: number,
  extra: Partial<EntryPlace> = {},
): EntryPlace => ({
  heading,
  layout,
  size: layout.startsWith('page') ? 'page' : 'spread',
  page,
  ...extra,
});
const E = (
  heading: string,
  page: number,
  extra: Partial<EntryEnd> = {},
): EntryEnd => ({heading, page, overflowLines: 0, ...extra});

describe('US-032 AC-2 and AC-11 the automatic choice reported', () => {
  it('US-032 AC-2: each automatic choice gives ENTRY_AUTO with the layout', async () => {
    const {entryLayoutWarnings} = await report();
    const ws = entryLayoutWarnings(
      [
        P('Marsh Owl', 'page-landscape', 4, {auto: true}),
        P('Fen Hare', 'page-text', 5),
      ],
      [E('Marsh Owl', 4), E('Fen Hare', 5)],
      {emptyWarn: 50},
    );
    expect(texts(ws)).toEqual(['ENTRY_AUTO "Marsh Owl": page-landscape']);
  });

  it('US-032 AC-11: a replaced layout is reported as a conflict, not also as auto', async () => {
    const {entryLayoutWarnings} = await report();
    const ws = entryLayoutWarnings(
      [
        P('Reed Cat', 'page-landscape', 4, {
          auto: true,
          asked: 'page-portrait',
          reason: 'image is landscape',
        }),
      ],
      [E('Reed Cat', 4)],
      {emptyWarn: 50},
    );
    expect(texts(ws)).toEqual([
      'ENTRY_LAYOUT_CONFLICT "Reed Cat": page-portrait → page-landscape (image is landscape)',
    ]);
  });
});

describe('US-032 AC-5 and AC-7 overflow', () => {
  it('US-032 AC-5: an overflow names the layout and the lines over', async () => {
    const {entryLayoutWarnings} = await report();
    const ws = entryLayoutWarnings(
      [P('Cave Wyrm', 'spread-landscape', 6)],
      [E('Cave Wyrm', 8, {overflowLines: 6, rightEmpty: 0})],
      {emptyWarn: 50},
    );
    expect(texts(ws)).toEqual([
      'ENTRY_OVERFLOW "Cave Wyrm": spread-landscape, about 6 lines over',
    ]);
  });

  it('US-032 AC-7: an overflowing page entry names the partner that moved', async () => {
    const {entryLayoutWarnings} = await report();
    const ws = entryLayoutWarnings(
      [P('Fen Hare', 'page-text', 4), P('Marsh Owl', 'page-text', 6)],
      [
        E('Fen Hare', 5, {overflowLines: 4, partnerMoved: 'Marsh Owl'}),
        E('Marsh Owl', 6),
      ],
      {emptyWarn: 50},
    );
    expect(texts(ws)).toEqual([
      'ENTRY_OVERFLOW "Fen Hare": page-text, about 4 lines over (partner "Marsh Owl" moved)',
    ]);
  });
});

describe('US-032 AC-9 the near miss', () => {
  const spread = (empty: number) => ({
    places: [P('Dragonet', 'spread-text', 6)],
    ends: [E('Dragonet', 7, {rightEmpty: empty})],
  });
  const cases: [number, number, boolean][] = [
    [85, 50, true],
    [85, 80, true],
    [85, 90, false],
    [40, 50, false],
    [50, 50, true],
    [100, 100, true],
    [85, 1, true],
    [85, 0, false],
  ];
  for (const [empty, threshold, warns] of cases) {
    it(`US-032 AC-9: right page ${empty} % empty, emptyWarn ${threshold} → ${warns ? 'warning' : 'none'}`, async () => {
      const {entryLayoutWarnings} = await report();
      const {places, ends} = spread(empty);
      const ws = entryLayoutWarnings(places, ends, {emptyWarn: threshold});
      expect(texts(ws)).toEqual(
        warns
          ? [
              `ENTRY_SPREAD_EMPTY "Dragonet": spread-text, right page ${empty} % empty – consider an illustration or trimming`,
            ]
          : [],
      );
    });
  }

  it('US-032 AC-9: full-image never gives ENTRY_SPREAD_EMPTY', async () => {
    const {entryLayoutWarnings} = await report();
    const ws = entryLayoutWarnings(
      [P('Bog Wight', 'full-image', 6)],
      [E('Bog Wight', 7, {rightEmpty: 100})],
      {emptyWarn: 50},
    );
    expect(texts(ws)).toEqual([]);
  });
});

describe('US-032 AC-10 once per entry', () => {
  it('US-032 AC-10: facts repeated for an entry (laid out twice) give each warning once', async () => {
    const {entryLayoutWarnings} = await report();
    const place = P('Marsh Owl', 'page-landscape', 4, {auto: true});
    const ws = entryLayoutWarnings(
      [place, place],
      [E('Marsh Owl', 4), E('Marsh Owl', 4)],
      {emptyWarn: 50},
    );
    expect(texts(ws)).toEqual(['ENTRY_AUTO "Marsh Owl": page-landscape']);
  });
});
