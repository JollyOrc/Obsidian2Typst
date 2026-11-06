// US-034 AC-1, AC-3, AC-5, AC-8, AC-9 — the print checks' settings and
// messages, the settings row, the low-resolution warnings from drawn and pixel
// widths, a failed scan, and the PDF reader moved into src/core.
// The checks and the reader are loaded at run time (they do not exist yet).
// Source of truth: docs/user-stories/US-034-print-checks-resolution-and-word-gaps.md.
// Red until US-034 is implemented (G2, 2026-11-06).
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {type Warning} from '../../src/core/emit/context';
import {formatPresetError, parsePreset} from '../../src/core/presets';
import {TAB_LAYOUT} from '../../src/plugin/settings/layout';

/** The checks module the tickets add. */
const CHECKS = '../../src/core/checks/print';
interface ChecksModule {
  /** US-034 AC-2, AC-3: one warning per file below `minDpi`, at its largest drawn width. */
  lowDpiWarnings(
    images: readonly {file: string; widthMm: number}[],
    pixelWidths: Readonly<Record<string, number>>,
    minDpi: number,
  ): Warning[];
  /** US-034 AC-7, AC-8: the justified lines of a PDF and their widest gap. */
  scanWordGaps(
    pdf: Uint8Array,
    options: {maxWordGap: number},
  ): {
    lines: {page: number; text: string; maxGap: number}[];
    warnings: Warning[];
  };
}
/** The PDF reader moved from tests/support/pdf.ts (AC-9). */
const READER = '../../src/core/pdf/reader';
interface ReaderModule {
  literalBytes(body: string): number[];
  contentTokens(part: string): unknown[];
  /** One pass: object number → offset of the text after `n 0 obj`. */
  objectIndex(pdf: string): Map<number, number>;
}
const load = async <T>(path: string): Promise<T> =>
  (await import(/* @vite-ignore */ path)) as T;
const texts = (ws: readonly Warning[]): string[] =>
  ws.map((w) => `${w.code} ${w.message}`);

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');
function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

describe('US-034 AC-1 images.minDpi', () => {
  it('US-034 AC-1: 0 to 2400 whole numbers; others refused with the message', () => {
    for (const v of [0, 1, 300, 2400])
      expect(errorOf('images:', `  minDpi: ${v}`), String(v)).toBeNull();
    for (const v of [-1, 2401, 300.5]) {
      expect(errorOf('images:', `  minDpi: ${v}`), String(v)).toBe(
        'images.minDpi must be a whole number from 0 to 2400 (line 4)',
      );
    }
  });

  it('US-034 AC-1: the settings tab has the feature row "Print resolution" after "Image fit", with its gear row', () => {
    const items = TAB_LAYOUT.flatMap((s) => s.items) as {
      kind: string;
      name?: string;
      desc?: string;
      rows?: string[];
    }[];
    const names = items.filter((i) => i.kind === 'feature').map((i) => i.name);
    expect(names.indexOf('Print resolution')).toBe(
      names.indexOf('Image fit') + 1,
    );
    const row = items.find((i) => i.name === 'Print resolution');
    expect(row?.desc).toBe('Warns about images below this dpi; off at 0.');
    expect(row?.rows).toEqual(['Minimum print resolution']);
  });
});

describe('US-034 AC-5 the word-gap settings', () => {
  it('US-034 AC-5: entries.maxWordGap 0 or 100 to 1000', () => {
    for (const v of [0, 100, 200, 1000])
      expect(errorOf('entries:', `  maxWordGap: ${v}`), String(v)).toBeNull();
    for (const v of [50, 99, 1001]) {
      expect(errorOf('entries:', `  maxWordGap: ${v}`), String(v)).toBe(
        'entries.maxWordGap must be 0 or a whole number from 100 to 1000 (line 4)',
      );
    }
  });

  it('US-034 AC-5: entries.narrowJustification takes spacing and tracking limits', () => {
    expect(
      errorOf(
        'entries:',
        '  narrowJustification: {spacing: {min: 80, max: 150}, tracking: {min: -0.01, max: 0.03}}',
      ),
    ).toBeNull();
    expect(
      errorOf(
        'entries:',
        '  narrowJustification: {spacing: {min: 160, max: 150}}',
      ),
    ).toBe(
      'entries.narrowJustification.spacing.min must not be above max (line 4)',
    );
  });
});

describe('US-034 AC-3 low resolution', () => {
  const PX = {'assets/small.png': 272};
  const cases: [string, {file: string; widthMm: number}[], number, string[]][] =
    [
      [
        '50 mm, min 300',
        [{file: 'assets/small.png', widthMm: 50}],
        300,
        ['IMAGE_LOW_DPI "assets/small.png": 138 dpi at 50.0 mm (min 300)'],
      ],
      ['50 mm, min 120', [{file: 'assets/small.png', widthMm: 50}], 120, []],
      ['20 mm, min 300', [{file: 'assets/small.png', widthMm: 20}], 300, []],
      [
        '50 and 20 mm',
        [
          {file: 'assets/small.png', widthMm: 20},
          {file: 'assets/small.png', widthMm: 50},
        ],
        300,
        ['IMAGE_LOW_DPI "assets/small.png": 138 dpi at 50.0 mm (min 300)'],
      ],
      ['min 0', [{file: 'assets/small.png', widthMm: 50}], 0, []],
    ];
  for (const [name, images, min, want] of cases) {
    it(`US-034 AC-3: ${name}`, async () => {
      const {lowDpiWarnings} = await load<ChecksModule>(CHECKS);
      expect(texts(lowDpiWarnings(images, PX, min))).toEqual(want);
    });
  }

  it('US-034 AC-2: a file whose pixel width is unknown (vector, SVG) is not checked', async () => {
    const {lowDpiWarnings} = await load<ChecksModule>(CHECKS);
    expect(
      texts(lowDpiWarnings([{file: 'assets/icon.svg', widthMm: 50}], {}, 300)),
    ).toEqual([]);
  });
});

describe('US-034 AC-8 a failed scan', () => {
  it('US-034 AC-8: unreadable bytes give one TEXT_GAP_SCAN_FAILED, never a throw', async () => {
    const {scanWordGaps} = await load<ChecksModule>(CHECKS);
    const result = scanWordGaps(new Uint8Array([1, 2, 3]), {maxWordGap: 200});
    expect(result.warnings.map((w) => w.code)).toEqual([
      'TEXT_GAP_SCAN_FAILED',
    ]);
    expect(result.lines).toEqual([]);
  });
});

describe('US-034 AC-9 the PDF reader in src/core', () => {
  it('US-034 AC-9: literal strings with balanced, unescaped parentheses and escapes', async () => {
    const {literalBytes} = await load<ReaderModule>(READER);
    expect(literalBytes('(a(b)c)')).toEqual(
      [...'a(b)c'].map((c) => c.charCodeAt(0)),
    );
    expect(literalBytes('(x\\)y\\101)')).toEqual([0x78, 0x29, 0x79, 0x41]);
  });

  it('US-034 AC-9: the object index is built in one pass and points after "n 0 obj"', async () => {
    const {objectIndex} = await load<ReaderModule>(READER);
    const pdf =
      '%PDF-1.7\n1 0 obj\n<< /A 1 >>\nendobj\n2 0 obj\n(two)\nendobj\n';
    const index = objectIndex(pdf);
    expect([...index.keys()]).toEqual([1, 2]);
    expect(
      pdf.slice(index.get(2), pdf.indexOf('endobj', index.get(2))).trim(),
    ).toBe('(two)');
  });

  it('US-034 AC-9: tests/support/pdf.ts uses the core reader, with no copy of its functions', () => {
    const support = readFileSync('tests/support/pdf.ts', 'utf8');
    expect(support).toMatch(/from '\.\.\/\.\.\/src\/core\/pdf\/reader'/);
    expect(support).not.toMatch(/^function (literalBytes|contentTokens)\b/m);
  });
});
