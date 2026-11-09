// US-033 AC-9, AC-11 — the quick reference's texts stay inside their cells:
// on A5 the narrow columns (the box value, the stats, the page) take the
// width of their content and Entry and Track share the rest (the Section
// column became section rows for #139), so a word such as "Horrors" or
// "Tussock" never runs into the next
// cell. Found in M21 (2026-11-07): the table's eight columns were of equal
// width and long words overran them.
// Source of truth: docs/user-stories/US-033-entry-openers-navigation-quick-reference.md.
import {afterAll, describe, expect, it} from 'vitest';
import {resolvePageSetup} from '../../src/core/layout/page-setup';
import {openPdf} from '../../src/core/pdf/reader';
import {pageRuns} from '../../src/core/pdf/text';
import {DEFAULT_FONTS} from '../../src/core/fonts';
import {ENTRIES, entry} from '../support/entries';
import {compileEntries, disposeEntriesCompiler} from '../support/entries-pdf';

afterAll(disposeEntriesCompiler);

describe('US-033 AC-9 the quick reference cells', () => {
  it('US-033 AC-9, AC-11: on A5 no text of a row comes closer than 4 pt to the next cell’s text', async () => {
    const names = ['Tussock Vole', 'Cinder Wraith', 'Marsh Owl', 'Gorse Imp'];
    const source = [
      '# Menagerie',
      '',
      '## Horrors',
      '',
      'Intro.',
      '',
      ...names.map((n) =>
        entry(
          `### ${n}`,
          [
            'vigour: 46',
            'might: 6',
            'wits: 1',
            'speed: 6',
            'states: [Fine, Fading]',
            'layout: page-text',
          ],
          ['A lede that is long enough to count for the entry here.'],
        ),
      ),
    ].join('\n');
    const c = await compileEntries(source, {
      over: {
        // The sample preset's page (M21): A5, a 105 mm text width.
        page: (() => {
          const r = resolvePageSetup({
            trimSize: 'A5',
            margins: {top: 20, bottom: 25, inside: 23, outside: 20},
            facingPages: true,
          } as never);
          if (!r.ok) throw new Error('page');
          return r.value;
        })(),
        // M21's Defaults: body text 12 pt (the table at 0.85 em).
        fonts: {
          ...structuredClone(DEFAULT_FONTS),
          body: {...DEFAULT_FONTS.body, size: 12},
        },
        headingRules: {Menagerie: 'entries'},
        entries: {...ENTRIES, quickReference: true},
      },
    });
    const index = c.pages.findIndex((p) => p.text.includes('Quick Reference'));
    expect(index).toBeGreaterThan(0);
    const runs = pageRuns(openPdf(c.pdf))[index] ?? [];
    const rows = new Map<string, {x0: number; x1: number; text: string}[]>();
    for (const r of runs.filter((r) => !r.furniture)) {
      const key = r.y.toFixed(0);
      const text = r.items
        .map((i) => ('ch' in i ? i.ch : ''))
        .join('')
        .trim();
      if (text === '') continue;
      rows.set(key, [...(rows.get(key) ?? []), {x0: r.x0, x1: r.x1, text}]);
    }
    const tight: string[] = [];
    for (const row of rows.values()) {
      if (row.some((r) => r.text.includes('Quick Reference'))) continue;
      row.sort((a, b) => a.x0 - b.x0);
      for (let i = 1; i < row.length; i++) {
        const a = row[i - 1] as {x1: number; text: string};
        const b = row[i] as {x0: number; text: string};
        if (b.x0 - a.x1 < 4)
          tight.push(`${a.text}|${b.text} ${(b.x0 - a.x1).toFixed(1)}`);
      }
    }
    expect(tight).toEqual([]);
  });
});
