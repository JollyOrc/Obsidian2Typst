// US-034 AC-9: the PDF content-stream reader, as pure code on the PDF bytes
// (no Obsidian, Node or I/O imports). Moved from `tests/support/pdf.ts`, which
// now reads its pages through it; the word-gap scan (#133) uses it too, so
// the tests and the product share one reader (SCAR-017).
//
// Scope: the PDFs Typst 0.14.2 writes (no object streams, no encryption)
// and the one incremental update `page-layout.ts` appends (US-037): a number
// defined twice keeps the last definition, which is the new catalog. Transforms, documented here (SCAR-001):
// - The file is read as latin1: one character per byte, so offsets in the
//   text are offsets in the bytes and stream data survives the round trip.
// - `objectIndex`: one pass over the file; each `n 0 obj` records the offset
//   just after its header. A stream's data is skipped by its direct
//   `/Length` (else up to `endstream`), so bytes inside a stream are never
//   taken for an object header. A number defined twice keeps the last
//   definition (the PDF rule for updates).
// - `literalBytes`: a `(…)` literal string; balanced unescaped parentheses
//   are part of the string; `\n \r \t \b \f` are their control bytes, `\ddd`
//   (one to three octal digits) the byte of that value, `\` before any other
//   character that character, a backslash before a line end is a
//   continuation (both removed).
// - `hexBytes`: a `<…>` string's digits, whitespace ignored, an odd last
//   digit padded with 0.
// - `readCMap`: a ToUnicode CMap's `bfchar` pairs and `bfrange` ranges
//   (destination as UTF-16 code units, the range's last unit counted up);
//   array destinations of `bfrange` are not read (Typst does not write them).
// - Streams: `/FlateDecode` is inflated (`inflate.ts`); other filters are
//   returned as stored.
import {inflate} from './inflate';

/** A token of a content stream; dictionaries' `<<` and `>>` are skipped. */
export type PdfToken =
  | {t: 'str'; bytes: number[]}
  | {t: 'name' | 'op'; v: string}
  | {t: '['}
  | {t: ']'};

/** The bytes as a latin1 string (one character per byte), in chunks. */
export function latin1(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return out;
}

/** The bytes of a latin1 string. */
function bytesOf(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

const NAMED_ESCAPES: Readonly<Record<string, number>> = {
  n: 10,
  r: 13,
  t: 9,
  b: 8,
  f: 12,
};

/**
 * The bytes of a PDF literal string written with its parentheses, such as
 * `(a(b)c)` or `(\000\003)`, escapes resolved. Reads up to the parenthesis
 * that balances the first one.
 */
export function literalBytes(literal: string): number[] {
  const out: number[] = [];
  let depth = 0;
  for (let i = literal.indexOf('('); i < literal.length; i++) {
    const ch = literal[i] as string;
    if (ch === '\\') {
      const octal = /^[0-7]{1,3}/.exec(literal.slice(i + 1, i + 4));
      const next = literal[i + 1] ?? '';
      if (octal !== null) {
        out.push(Number.parseInt(octal[0], 8) & 0xff);
        i += octal[0].length;
      } else if (next === '\r' || next === '\n') {
        i += next === '\r' && literal[i + 2] === '\n' ? 2 : 1;
      } else {
        out.push(NAMED_ESCAPES[next] ?? next.charCodeAt(0));
        i += 1;
      }
      continue;
    }
    if (ch === '(') {
      depth += 1;
      if (depth === 1) continue;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) break;
    }
    out.push(ch.charCodeAt(0));
  }
  return out;
}

/** The bytes of a hex string's digits (whitespace ignored, odd digit padded). */
export function hexBytes(hex: string): number[] {
  const digits = hex.replace(/\s+/g, '');
  const padded = digits.length % 2 === 0 ? digits : `${digits}0`;
  return (padded.match(/../g) ?? []).map((h) => Number.parseInt(h, 16));
}

/** The index after the `)` that closes the literal string opening at `at`. */
function literalEnd(part: string, at: number): number {
  let depth = 1;
  let j = at + 1;
  while (j < part.length && depth > 0) {
    const c = part[j] as string;
    if (c === '\\') j++;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    j++;
  }
  return j;
}

const DELIMITER = /[\s()<>[\]{}/%]/;
const SPACE = /\s/;

/**
 * The tokens of a content stream part. A literal string may hold balanced,
 * unescaped parentheses (`(a(b)c)`, as Typst writes some glyph runs), so it is
 * read by counting them, not with a pattern.
 */
export function contentTokens(part: string): PdfToken[] {
  const out: PdfToken[] = [];
  let i = 0;
  while (i < part.length) {
    const ch = part[i] as string;
    if (SPACE.test(ch)) {
      i++;
    } else if (ch === '(') {
      const j = literalEnd(part, i);
      out.push({t: 'str', bytes: literalBytes(part.slice(i, j))});
      i = j;
    } else if (ch === '<' && part[i + 1] === '<') {
      i += 2;
    } else if (ch === '>' && part[i + 1] === '>') {
      i += 2;
    } else if (ch === '<') {
      const end = part.indexOf('>', i);
      const stop = end < 0 ? part.length : end;
      out.push({t: 'str', bytes: hexBytes(part.slice(i + 1, stop))});
      i = stop + 1;
    } else if (ch === '[' || ch === ']') {
      out.push({t: ch});
      i++;
    } else if (ch === '/') {
      let j = i + 1;
      while (j < part.length && !DELIMITER.test(part[j] as string)) j++;
      out.push({t: 'name', v: part.slice(i + 1, j)});
      i = j;
    } else if (ch === '%') {
      while (i < part.length && part[i] !== '\n' && part[i] !== '\r') i++;
    } else {
      let j = i + 1;
      while (j < part.length && !DELIMITER.test(part[j] as string)) j++;
      out.push({t: 'op', v: part.slice(i, j)});
      i = j;
    }
  }
  return out;
}

/** glyph number → text, from the `bfchar` and `bfrange` parts of a CMap. */
export function readCMap(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  const text = (hex: string): string =>
    String.fromCharCode(
      ...(hex.match(/.{4}/g) ?? []).map((h) => Number.parseInt(h, 16)),
    );
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of (block[1] as string).matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g,
    )) {
      map.set(Number.parseInt(m[1] as string, 16), text(m[2] as string));
    }
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of (block[1] as string).matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g,
    )) {
      const from = Number.parseInt(m[1] as string, 16);
      const to = Number.parseInt(m[2] as string, 16);
      const dest = text(m[3] as string);
      const head = dest.slice(0, -1);
      const last = dest.charCodeAt(dest.length - 1);
      for (let code = from; code <= to; code++) {
        map.set(code, head + String.fromCharCode(last + code - from));
      }
    }
  }
  return map;
}

const OBJ_HEADER = /(\d+)\s+(\d+)\s+obj\b/g;
/** The `stream` keyword (not the end of a name such as `/XRefStream`). */
const STREAM = /(?<![A-Za-z/])stream(?=\r\n|\n|\r)/g;

/** The offset of the next `stream` keyword at or after `from`; -1 without. */
function streamAt(text: string, from: number): number {
  STREAM.lastIndex = from;
  return STREAM.exec(text)?.index ?? -1;
}

/**
 * The offset where object data ends (the `endobj` keyword, or the end of the
 * file), with a stream's data skipped by its direct `/Length`.
 */
function objectEnd(pdf: string, from: number): number {
  const endobj = pdf.indexOf('endobj', from);
  const stream = streamAt(pdf, from);
  if (stream < 0 || (endobj >= 0 && endobj < stream)) {
    return endobj < 0 ? pdf.length : endobj;
  }
  const length = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(pdf.slice(from, stream));
  let data = stream + 'stream'.length;
  if (pdf[data] === '\r') data += 1;
  if (pdf[data] === '\n') data += 1;
  const after =
    length === null ? pdf.indexOf('endstream', data) : data + Number(length[1]);
  const end = pdf.indexOf('endobj', Math.max(after, data));
  return end < 0 ? pdf.length : end;
}

/**
 * US-034 AC-9: object number → offset of the text after `n 0 obj`, built in
 * one pass over the file (stream data skipped, see the header of this file).
 */
export function objectIndex(pdf: string): Map<number, number> {
  const index = new Map<number, number>();
  OBJ_HEADER.lastIndex = 0;
  for (let m = OBJ_HEADER.exec(pdf); m !== null; m = OBJ_HEADER.exec(pdf)) {
    const before = m.index === 0 ? '\n' : (pdf[m.index - 1] as string);
    if (!SPACE.test(before)) continue;
    const start = m.index + m[0].length;
    index.set(Number(m[1]), start);
    OBJ_HEADER.lastIndex = objectEnd(pdf, start);
  }
  return index;
}

/** A PDF opened for reading: its text, its objects and their streams. */
export interface PdfFile {
  /** The whole file as latin1 text. */
  text: string;
  /** Object number → offset after `n 0 obj`. */
  index: Map<number, number>;
  /** The text of object `n` after its header up to `endobj` (stream included). */
  object(n: number): string;
  /** The data of object `n`'s stream as latin1 text, inflated when compressed. */
  stream(n: number): string;
  /**
   * The ToUnicode map of font object `n` (glyph → text); empty without one.
   * Read once per font object.
   */
  toUnicode(n: number): Map<number, string>;
}

/** US-034 AC-9: opens `bytes` for reading; the index is built once here. */
export function openPdf(bytes: Uint8Array): PdfFile {
  const text = latin1(bytes);
  const index = objectIndex(text);
  const fonts = new Map<number, Map<number, string>>();
  const object = (n: number): string => {
    const start = index.get(n);
    if (start === undefined) throw new Error(`PDF object ${n} not found`);
    return text.slice(start, objectEnd(text, start));
  };
  const stream = (n: number): string => {
    const body = object(n);
    const at = streamAt(body, 0);
    if (at < 0) return '';
    let begin = at + 'stream'.length;
    if (body[begin] === '\r') begin += 1;
    if (body[begin] === '\n') begin += 1;
    const length = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(body.slice(0, at));
    let end =
      length === null
        ? body.lastIndexOf('endstream')
        : begin + Number(length[1]);
    if (end < begin) end = body.length;
    const raw = body.slice(begin, end);
    return /\/FlateDecode/.test(body.slice(0, at))
      ? latin1(inflate(bytesOf(raw)))
      : raw;
  };
  const toUnicode = (n: number): Map<number, string> => {
    const known = fonts.get(n);
    if (known !== undefined) return known;
    const ref = /\/ToUnicode (\d+) 0 R/.exec(object(n));
    const map: Map<number, string> =
      ref === null ? new Map() : readCMap(stream(Number(ref[1])));
    fonts.set(n, map);
    return map;
  };
  return {text, index, object, stream, toUnicode};
}
