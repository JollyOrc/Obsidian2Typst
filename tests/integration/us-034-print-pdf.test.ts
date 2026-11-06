// US-034 AC-2, AC-4, AC-6, AC-7, AC-10 to AC-12 — print checks with the
// bundled compiler: the image helper records each block image's drawn width
// (`<o2t-image>`), narrow columns get justification limits, the word-gap scan
// reads justified lines (calibration pin, a gappy narrow line, two columns
// never joined), and its time on a long PDF.
// Source of truth: docs/user-stories/US-034-print-checks-resolution-and-word-gaps.md.
// Red until US-034 is implemented (G2, 2026-11-06).
import {afterAll, describe, expect, it} from 'vitest';
import {type Warning} from '../../src/core/emit/context';
import {compileSource, filler} from '../support/book';
import {ENTRIES, entry} from '../support/entries';
import {compileEntries, disposeEntriesCompiler} from '../support/entries-pdf';
import {png} from '../support/images';

afterAll(disposeEntriesCompiler);

const CHECKS = '../../src/core/checks/print';
interface ChecksModule {
  scanWordGaps(
    pdf: Uint8Array,
    options: {maxWordGap: number},
  ): {
    lines: {page: number; text: string; maxGap: number}[];
    warnings: Warning[];
  };
}
const checks = async (): Promise<ChecksModule> => {
  const path: string = CHECKS;
  return (await import(/* @vite-ignore */ path)) as ChecksModule;
};

describe('US-034 AC-2 and AC-4 drawn widths', () => {
  it('US-034 AC-2: a body image and an entry illustration record their drawn width; an inline image does not', async () => {
    const source = [
      '# Players',
      '',
      'Text with an ![](assets/e-small.png) inline image.',
      '',
      '![](assets/e-wide.png)',
      '',
      '# Menagerie',
      '',
      entry(
        '### Fen Hare',
        [
          'might: 4',
          'layout: page-landscape',
          'illustration: "![](assets/e-wide.png)"',
        ],
        ['Fen hares are quick and shy.'],
      ),
    ].join('\n');
    const images = {
      'Sample/assets/e-wide.png': png(300, 200),
      'Sample/assets/e-small.png': png(40, 30),
    };
    const c = await compileEntries(source, {
      over: {headingRules: {Menagerie: 'entries'}},
      images,
    });
    const facts = c.images;
    expect(facts.filter((f) => f.file.endsWith('e-wide.png'))).toHaveLength(2);
    expect(facts.some((f) => f.file.endsWith('e-small.png'))).toBe(false);
    const drawn = c.pages
      .flatMap((p) => p.images)
      .map((i) => Math.round((i.width * 25.4) / 72));
    for (const f of facts) expect(drawn).toContain(Math.round(f.widthMm));
  });
});

describe('US-034 AC-6 narrow columns', () => {
  it('US-034 AC-6 (decision 2): the portrait column and the lede column get justification-limits; full-width text does not', async () => {
    const source = [
      '# Menagerie',
      '',
      entry(
        '### Reed Cat',
        [
          'might: 4',
          'layout: page-portrait',
          'illustration: "![](assets/e-tall.png)"',
        ],
        ['A lede paragraph of some length.', '', filler(3, 'Body')],
      ),
    ].join('\n');
    const c = await compileEntries(source, {
      over: {headingRules: {Menagerie: 'entries'}, entries: ENTRIES},
      images: {'Sample/assets/e-tall.png': png(100, 200)},
    });
    const limits = c.result.typ.match(/justification-limits:/g) ?? [];
    expect(limits.length).toBeGreaterThanOrEqual(2);
    expect(c.result.typ).toContain('spacing: (min: 80%, max: 150%)');
    expect(c.result.typ).toContain('tracking: (min: -0.01em, max: 0.03em)');
  });
});

describe('US-034 AC-7 and AC-10 the scan', () => {
  it('US-034 AC-10: calibration lines at 200 % and 300 % measure 200 and 300 (±2)', async () => {
    const {scanWordGaps} = await checks();
    const pdf = await compileSource(
      '#set page(width: 148mm, height: 210mm)\n#set text(spacing: 200%)\nAlpha beta gamma delta\n\n#set text(spacing: 300%)\nOmega psi chi phi\n',
    );
    const {lines} = scanWordGaps(pdf, {maxWordGap: 1000});
    const at = (word: string) =>
      lines.find((l) => l.text.includes(word))?.maxGap ?? 0;
    expect(Math.abs(at('Alpha') - 200)).toBeLessThanOrEqual(2);
    expect(Math.abs(at('Omega') - 300)).toBeLessThanOrEqual(2);
  });

  it('US-034 AC-7: a justified narrow line with one stretched gap warns, quoting the line', async () => {
    const {scanWordGaps} = await checks();
    const pdf = await compileSource(
      '#set page(width: 148mm, height: 210mm)\n#set par(justify: true)\n#set text(hyphenate: false)\n#block(width: 40mm)[Go to Ultramegasupercalifragilistic and then more words follow here.]\n',
    );
    const {lines, warnings} = scanWordGaps(pdf, {maxWordGap: 200});
    const gappy = lines.find((l) => l.text.startsWith('Go to'));
    expect(gappy?.maxGap ?? 0).toBeGreaterThan(200);
    expect(warnings.map((w) => w.code)).toContain('TEXT_WIDE_GAP');
    expect(warnings.find((w) => w.code === 'TEXT_WIDE_GAP')?.message).toMatch(
      /^"p\. \d+": "Go to" \(\d+ %\)$/,
    );
  });

  it('US-034 AC-7: two columns on one baseline are never one line', async () => {
    const {scanWordGaps} = await checks();
    const left = Array.from({length: 40}, (_, i) => `Lw${i}`).join(' ');
    const right = Array.from({length: 40}, (_, i) => `Rw${i}`).join(' ');
    const pdf = await compileSource(
      `#set page(width: 148mm, height: 210mm)\n#set par(justify: true)\n#columns(2)[${left} #colbreak() ${right}]\n`,
    );
    const {lines} = scanWordGaps(pdf, {maxWordGap: 1000});
    expect(lines.length).toBeGreaterThan(4);
    expect(
      lines.filter((l) => /Lw\d/.test(l.text) && /Rw\d/.test(l.text)),
    ).toEqual([]);
  });

  it('US-034 AC-12: full-width filler text does not warn at 200 %', async () => {
    const {scanWordGaps} = await checks();
    const pdf = await compileSource(
      `#set page(width: 148mm, height: 210mm)\n#set par(justify: true)\n${filler(12, 'Plain')}\n`,
    );
    const {lines, warnings} = scanWordGaps(pdf, {maxWordGap: 200});
    expect(lines.length).toBeGreaterThan(10);
    expect(warnings.filter((w) => w.code === 'TEXT_WIDE_GAP')).toEqual([]);
  });
});

describe('US-034 AC-11 time', () => {
  it('US-034 AC-11 (SCAR-030): a generated 400-page text PDF scans in under 2 s', async () => {
    const {scanWordGaps} = await checks();
    const pages = Array.from(
      {length: 400},
      (_, i) => `${filler(6, `P${i}`)}\n#pagebreak()`,
    ).join('\n');
    const pdf = await compileSource(
      `#set page(width: 148mm, height: 210mm)\n#set par(justify: true)\n${pages}\n`,
    );
    const t0 = performance.now();
    const {lines} = scanWordGaps(pdf, {maxWordGap: 200});
    const ms = performance.now() - t0;
    expect(lines.length).toBeGreaterThan(400);
    expect(ms).toBeLessThan(2000);
  }, 120_000);
});
