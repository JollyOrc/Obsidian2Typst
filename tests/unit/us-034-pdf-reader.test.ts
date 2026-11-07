// US-034 AC-9 — the syntax rules of the core PDF reader, checked on their own
// (SCAR-028: a test reader is not trusted unchecked): FlateDecode against
// node:zlib, the object index past stream data, literal-string escapes, CMap
// ranges, and fonts read once per font object.
// Source of truth: docs/user-stories/US-034-print-checks-resolution-and-word-gaps.md.
// Added at G4 of #131 (2026-11-07).
import {deflateRawSync, deflateSync, constants} from 'node:zlib';
import {describe, expect, it} from 'vitest';
import {inflate} from '../../src/core/pdf/inflate';
import {
  contentTokens,
  latin1,
  literalBytes,
  objectIndex,
  openPdf,
  readCMap,
} from '../../src/core/pdf/reader';

const sample = (n: number): Uint8Array => {
  // Text with repeats (matches) and a pseudo-random tail (literals).
  const out = new Uint8Array(n);
  let x = 7;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = i % 3 === 0 ? 65 + ((i >> 4) % 26) : (x >>> 24) & 0xff;
  }
  return out;
};

describe('US-034 AC-9 inflate (FlateDecode) matches node:zlib', () => {
  it('US-034 AC-9: stored, fixed and dynamic blocks, zlib-wrapped and raw', () => {
    const inputs = [
      new Uint8Array(0),
      new TextEncoder().encode('BT /f1 10 Tf (Hello) Tj ET '.repeat(400)),
      sample(70_000),
    ];
    for (const data of inputs) {
      for (const level of [0, 1, 6, 9]) {
        expect(inflate(deflateSync(data, {level}))).toEqual(data);
        expect(inflate(deflateRawSync(data, {level}))).toEqual(data);
      }
      const fixed = deflateSync(data, {strategy: constants.Z_FIXED});
      expect(inflate(fixed)).toEqual(data);
    }
  });

  it('US-034 AC-9: a truncated stream throws', () => {
    const z = deflateSync(sample(5000));
    expect(() => inflate(z.subarray(0, z.length >> 1))).toThrow(/inflate/);
  });
});

describe('US-034 AC-9 the object index and streams', () => {
  const data = deflateSync(Buffer.from('BT (fake 9 0 obj) Tj ET'));
  const pdf = latin1(
    new Uint8Array([
      ...Buffer.from(
        `%PDF-1.7\n1 0 obj\n<< /Length ${data.length} /Filter /FlateDecode >>\nstream\n`,
        'latin1',
      ),
      ...data,
      ...Buffer.from(
        '\nendstream\nendobj\n2 0 obj\n<< /Length 15 >>\nstream\n3 0 obj endobj\nendstream\nendobj\n4 0 obj\n[1 2]\nendobj\n',
        'latin1',
      ),
    ]),
  );

  it('US-034 AC-9: object headers inside stream data are not indexed', () => {
    expect([...objectIndex(pdf).keys()]).toEqual([1, 2, 4]);
  });

  it('US-034 AC-9: streams are read by /Length and inflated when compressed', () => {
    const file = openPdf(Uint8Array.from(pdf, (c) => c.charCodeAt(0)));
    expect(file.stream(1)).toBe('BT (fake 9 0 obj) Tj ET');
    expect(file.stream(2)).toBe('3 0 obj endobj\n');
    expect(file.object(4).trim()).toBe('[1 2]');
    expect(() => file.object(3)).toThrow(/not found/);
  });

  it('US-034 AC-9: fonts are read once per font object', () => {
    const cmap = '1 beginbfchar <0003> <0041> endbfchar';
    const text = `%PDF-1.7\n5 0 obj\n<< /ToUnicode 6 0 R >>\nendobj\n6 0 obj\n<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream\nendobj\n`;
    const file = openPdf(Uint8Array.from(text, (c) => c.charCodeAt(0)));
    const first = file.toUnicode(5);
    expect(first.get(3)).toBe('A');
    expect(file.toUnicode(5)).toBe(first);
  });
});

describe('US-034 AC-9 strings, tokens and CMaps', () => {
  it('US-034 AC-9: named escapes, short octal and a line continuation', () => {
    expect(literalBytes('(a\\nb\\7\\0123)')).toEqual([97, 10, 98, 7, 10, 51]);
    expect(literalBytes('(ab\\\ncd)')).toEqual([97, 98, 99, 100]);
  });

  it('US-034 AC-9: a TJ array with nested parentheses and a hex string', () => {
    expect(contentTokens('[(a(b)c) -20 <0041>] TJ')).toEqual([
      {t: '['},
      {t: 'str', bytes: [97, 40, 98, 41, 99]},
      {t: 'op', v: '-20'},
      {t: 'str', bytes: [0, 0x41]},
      {t: ']'},
      {t: 'op', v: 'TJ'},
    ]);
  });

  it('US-034 AC-9: bfrange counts up the last code unit', () => {
    const map = readCMap(
      '1 beginbfrange <0010> <0012> <00660066> endbfrange 1 beginbfchar <0001> <0020> endbfchar',
    );
    expect([map.get(16), map.get(17), map.get(18), map.get(1)]).toEqual([
      'ff',
      'fg',
      'fh',
      ' ',
    ]);
  });
});
