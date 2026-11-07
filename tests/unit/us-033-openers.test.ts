// US-033 AC-3, AC-4, AC-12, AC-13 — the quick reference's settings and the
// opener warnings made from the compile's facts: ENTRY_BLANK_PAGE for a
// section, SECTION_INTRO_OVERFLOW, and no ENTRY_UNPAIRED when an opener
// fills the right page. Through the report module of US-032 (loaded at run
// time); pages are read from the PDF in tests/integration/us-033-openers-pdf.test.ts.
// Source of truth: docs/user-stories/US-033-entry-openers-navigation-quick-reference.md.
// Red until US-033 is implemented (G2, 2026-11-06).
import {describe, expect, it} from 'vitest';
import {type Warning} from '../../src/core/emit/context';
import {formatPresetError, parsePreset} from '../../src/core/presets';
import {
  type EntryEnd,
  type EntryPlace,
  type SectionPlace,
} from '../support/entries-pdf';

const REPORT = '../../src/core/entries/report';
interface ReportModule {
  /** US-031 AC-5/AC-10 and US-033 AC-3/AC-4/AC-13: the page warnings of a chapter. */
  sectionWarnings(
    sections: readonly SectionPlace[],
    places: readonly EntryPlace[],
    ends: readonly EntryEnd[],
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

describe('US-033 AC-12 settings', () => {
  it('US-033 AC-12: quickReference is a switch; quickReferenceTitle is text', () => {
    expect(
      errorOf(
        'entries:',
        '  quickReference: true',
        '  quickReferenceTitle: Index',
      ),
    ).toBeNull();
    expect(errorOf('entries:', '  quickReference: yes')).toBe(
      'entries.quickReference must be true or false (line 4)',
    );
    expect(errorOf('entries:', '  quickReferenceTitle: [a]')).toBe(
      'entries.quickReferenceTitle must be text (line 4)',
    );
  });
});

const P = (
  heading: string,
  page: number,
  size: 'page' | 'spread' = 'page',
): EntryPlace => ({
  heading,
  layout: size === 'page' ? 'page-text' : 'spread-text',
  size,
  page,
});
const E = (heading: string, page: number): EntryEnd => ({
  heading,
  page,
  overflowLines: 0,
});

describe('US-033 AC-3 reusing a free page', () => {
  it('US-033 AC-3: a section ending on a left page — its opener on the facing right page, no warning', async () => {
    const {sectionWarnings} = await report();
    const ws = sectionWarnings(
      [
        {section: 'Beasts', page: 1, introEnd: 1},
        {section: 'Horrors', page: 3, introEnd: 3},
      ],
      [P('Reed Cat', 2), P('Bog Wight', 4)],
      [E('Reed Cat', 2), E('Bog Wight', 4)],
    );
    expect(texts(ws)).toEqual([]);
  });

  it('US-033 AC-3: a section ending on a right page — a blank left page, ENTRY_BLANK_PAGE for the next section', async () => {
    const {sectionWarnings} = await report();
    const ws = sectionWarnings(
      [
        {section: 'Beasts', page: 1, introEnd: 1},
        {section: 'Horrors', page: 5, introEnd: 5},
      ],
      [P('Fen Hare', 2), P('Marsh Owl', 3), P('Bog Wight', 6)],
      [E('Fen Hare', 2), E('Marsh Owl', 3), E('Bog Wight', 6)],
    );
    expect(texts(ws)).toEqual(['ENTRY_BLANK_PAGE "Horrors"']);
  });

  it('US-033 AC-3 with US-031 AC-10: an unpaired entry whose right page is not an opener still warns', async () => {
    const {sectionWarnings} = await report();
    const ws = sectionWarnings(
      [{section: 'Beasts', page: 1, introEnd: 1}],
      [P('Fen Hare', 2), P('Cave Wyrm', 4, 'spread')],
      [E('Fen Hare', 2), E('Cave Wyrm', 5)],
    );
    expect(texts(ws)).toEqual(['ENTRY_UNPAIRED "Fen Hare"']);
  });
});

describe('US-033 AC-4 long intros', () => {
  it('US-033 AC-4: an intro that runs on gives SECTION_INTRO_OVERFLOW, and its gap page no ENTRY_BLANK_PAGE', async () => {
    const {sectionWarnings} = await report();
    const ws = sectionWarnings(
      [{section: 'Horrors', page: 9, introEnd: 10}],
      [P('Bog Wight', 12)],
      [E('Bog Wight', 12)],
    );
    expect(texts(ws)).toEqual(['SECTION_INTRO_OVERFLOW "Horrors"']);
  });
});

describe('US-033 AC-13 once each', () => {
  it('US-033 AC-13: repeated facts (a second layout pass) give each warning once', async () => {
    const {sectionWarnings} = await report();
    const s = {section: 'Horrors', page: 9, introEnd: 10};
    const ws = sectionWarnings(
      [s, s],
      [P('Bog Wight', 12)],
      [E('Bog Wight', 12)],
    );
    expect(texts(ws)).toEqual(['SECTION_INTRO_OVERFLOW "Horrors"']);
  });
});
