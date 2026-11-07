// US-034 AC-13, US-024 decision 1 — the sample vault's gap paragraph still
// gaps: the Reed Cat entry of `Menagerie.md` (page-portrait, a 45 % column
// with the narrow-column limits) is compiled with the sample preset's
// `entries` and a template that justifies the text (the plugin itself sets
// no `justify`; a book's template does, US-023; the paragraph was chosen in
// a justified column), and the scan warns about a line of its gap
// paragraph, named by the entry. Measured 2026-11-07: 352 % and 325 % with
// the limits, 440 % and 413 % without. If a change to the layout or to Typst ever closes the gap,
// this test fails and the paragraph is chosen again (US-024 decision 1).
// Source of truth: docs/user-stories/US-034-print-checks-resolution-and-word-gaps.md.
// Added at G4 of #133 (2026-11-07).
import {readFileSync} from 'node:fs';
import {afterAll, describe, expect, it} from 'vitest';
import {entryPages, scanWordGaps} from '../../src/core/checks/print';
import {parsePreset} from '../../src/core/presets';
import {compileEntries, disposeEntriesCompiler} from '../support/entries-pdf';

afterAll(disposeEntriesCompiler);

const SAMPLE = 'tests/fixtures/sample';

/** The `### Reed Cat` section of Menagerie.md, up to the next heading. */
function reedCat(): string {
  const text = readFileSync(`${SAMPLE}/Menagerie.md`, 'utf8');
  const from = text.indexOf('### Reed Cat');
  const to = text.indexOf('\n#', from + 1);
  return text.slice(from, to < 0 ? undefined : to);
}

describe('US-034 AC-13 the fixture gap paragraph', () => {
  it('US-034 AC-13 (US-024 decision 1): the Reed Cat gap paragraph warns, named by the entry', async () => {
    const preset = parsePreset(
      readFileSync(`${SAMPLE}/presets/Entries.md`, 'utf8'),
    );
    if (!preset.ok) throw new Error('presets/Entries.md is not valid');
    const entries = (preset.fields as {entries: unknown}).entries;
    const icons = Object.fromEntries(
      ['fine', 'hurt', 'down', 'fading', 'gone'].map((n) => [
        `Sample/assets/icons/${n}.svg`,
        new Uint8Array(readFileSync(`${SAMPLE}/assets/icons/${n}.svg`)),
      ]),
    );
    const c = await compileEntries(`# Menagerie\n\n${reedCat()}\n`, {
      over: {
        headingRules: {Menagerie: 'entries'},
        entries,
        template: true,
        templateHook: true,
      },
      files: {
        'template.typ': new TextEncoder().encode(
          '#let template(body) = { set par(justify: true); body }\n',
        ),
      },
      images: {
        ...icons,
        'Sample/assets/entry-tall.png': new Uint8Array(
          readFileSync(`${SAMPLE}/assets/entry-tall.png`),
        ),
      },
    });
    expect(c.places.map((p) => p.layout)).toEqual(['page-portrait']);
    expect(c.result.typ).toContain('justification-limits');
    const {warnings} = scanWordGaps(c.pdf, {
      maxWordGap: 200,
      entries: entryPages(c.places, c.ends),
    });
    const gaps = warnings.filter((w) => w.code === 'TEXT_WIDE_GAP');
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((w) => w.message.startsWith('"Reed Cat": '))).toBe(true);
    const words = new Set(
      'Ut pariatur nostrud cillum pariaturdosed dolor ipsum excillumin dolor veniam esse irureadipiscingipsum consequat in duis etadipiscingex ut labore exercitation minim enim reprehenderit dolore ullamco ullamco sit nostrud ut.'.split(
        ' ',
      ),
    );
    const quoted = gaps.map(
      (w) => /: "(.*)" \(\d+ %\)$/.exec(w.message)?.[1] ?? '',
    );
    expect(
      quoted.some((q) => q.split(' ').every((word) => words.has(word))),
      quoted.join(' | '),
    ).toBe(true);
  });
});
