// Test support for US-037: readers of a PDF's file structure — the catalog
// in force (the last revision) and the cross-reference sections, followed
// from the end of the file through every `/Prev`. Written from the PDF syntax
// for classic xref tables (ISO 32000-1, 7.5.4 to 7.5.6), not from the bytes
// of one file; each rule has a test of its own
// (`tests/unit/us-037-pdf-structure-reader.test.ts`, SCAR-028). Out of
// scope: xref streams and object streams (Typst 0.14.2 writes neither;
// `tests/integration/us-037-spreads-pdf.test.ts` guards that).
import {latin1, openPdf} from '../../src/core/pdf/reader';

/** One cross-reference section, found from a `startxref` or a `/Prev`. */
export interface XrefSection {
  /** Offset of the keyword `xref`. */
  at: number;
  /** The trailer dictionary after the section, as text (`<<` … `>>`). */
  trailer: string;
  /** In-use entries: object number, generation and offset. */
  entries: {num: number; gen: number; offset: number}[];
}

/** The result of walking a PDF's cross-reference sections. */
export interface XrefWalk {
  /** The sections, newest first (the one `startxref` names comes first). */
  sections: XrefSection[];
  /** In-use entries checked against the object header they point at. */
  checked: number;
  /** Every mismatch found; empty when the structure holds. */
  problems: string[];
}

/** The trailer dictionary that starts at `at` (the text after `trailer`). */
function dictAt(text: string, at: number): string {
  const open = text.indexOf('<<', at);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < text.length - 1; i++) {
    if (text[i] === '<' && text[i + 1] === '<') {
      depth++;
      i++;
    } else if (text[i] === '>' && text[i + 1] === '>') {
      depth--;
      i++;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return text.slice(open);
}

/**
 * US-037 AC-1, AC-2: walks the classic xref sections from the last
 * `startxref` through every `/Prev`; checks that each offset points at the
 * keyword `xref`, and that each in-use entry points at `num gen obj`. Free
 * entries (`f`) are not checked. Stops on a loop of `/Prev`.
 */
export function walkXref(bytes: Uint8Array): XrefWalk {
  const text = latin1(bytes);
  const problems: string[] = [];
  const sections: XrefSection[] = [];
  let checked = 0;
  const last = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(text);
  if (last === null) return {sections, checked, problems: ['no startxref']};
  const seen = new Set<number>();
  for (let at: number | null = Number(last[1]); at !== null;) {
    if (seen.has(at)) {
      problems.push(`loop at ${at}`);
      break;
    }
    seen.add(at);
    if (!text.startsWith('xref', at)) {
      problems.push(`offset ${at} is not "xref"`);
      break;
    }
    const trailerAt = text.indexOf('trailer', at);
    if (trailerAt < 0) {
      problems.push(`no trailer after ${at}`);
      break;
    }
    const table = text.slice(at + 4, trailerAt);
    const entries: XrefSection['entries'] = [];
    const lines = table.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
    let num = 0;
    for (const line of lines) {
      const head = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
      if (head !== null) {
        num = Number(head[1]);
        continue;
      }
      const entry = /^(\d{10}) (\d{5}) ([nf])\s*$/.exec(line);
      if (entry === null) {
        problems.push(`bad xref line "${line}"`);
        continue;
      }
      if (entry[3] === 'n') {
        const offset = Number(entry[1]);
        const gen = Number(entry[2]);
        entries.push({num, gen, offset});
        checked++;
        if (!text.startsWith(`${num} ${gen} obj`, offset)) {
          problems.push(`object ${num} ${gen} not at ${offset}`);
        }
      }
      num++;
    }
    const trailer = dictAt(text, trailerAt);
    sections.push({at, trailer, entries});
    const prev = /\/Prev\s+(\d+)/.exec(trailer);
    at = prev === null ? null : Number(prev[1]);
  }
  return {sections, checked, problems};
}

/** The catalog in force: the newest trailer's `/Root` and its newest text. */
export interface PdfCatalog {
  /** The catalog's object number. */
  object: number;
  /** The catalog's dictionary text, as the last definition writes it. */
  dict: string;
  /** The top-level keys of the dictionary, in order (`Type`, `Pages`, …). */
  keys: string[];
  /** The value of `/PageLayout` (a name without `/`); null without one. */
  pageLayout: string | null;
}

/** The top-level keys of a dictionary text (nested dictionaries skipped). */
function topKeys(dict: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let expectKey = true;
  for (let i = 0; i < dict.length; i++) {
    const two = dict.slice(i, i + 2);
    if (two === '<<') {
      depth++;
      i++;
      if (depth === 2) expectKey = false;
      continue;
    }
    if (two === '>>') {
      depth--;
      i++;
      if (depth === 1) expectKey = true;
      continue;
    }
    if (depth !== 1) continue;
    if (dict[i] === '/') {
      const name = /^\/([^\s/<>[\]()]+)/.exec(dict.slice(i))?.[1] ?? '';
      if (expectKey) keys.push(name);
      expectKey = !expectKey;
      i += name.length;
    } else if (!/\s/.test(dict[i] as string) && !expectKey) {
      // A value that is not a name: skip to its end (a reference, a
      // number, an array or a string) and expect the next key.
      const rest = dict.slice(i);
      const value =
        /^(\d+\s+\d+\s+R|[-+.\d]+|true|false|null|\[[^\]]*\]|\((?:\\.|[^\\)])*\))/.exec(
          rest,
        )?.[0] ?? (dict[i] as string);
      i += value.length - 1;
      expectKey = true;
    }
  }
  return keys;
}

/**
 * US-037 AC-2, AC-10: the catalog in force — the `/Root` of the newest
 * trailer (the one before the last `startxref`), read at its last
 * definition in the file.
 */
export function readPdfCatalog(bytes: Uint8Array): PdfCatalog {
  const text = latin1(bytes);
  const end = text.lastIndexOf('startxref');
  const trailerAt = text.lastIndexOf('trailer', end);
  if (end < 0 || trailerAt < 0) throw new Error('PDF trailer not found');
  const trailer = dictAt(text, trailerAt);
  const root = /\/Root\s+(\d+)\s+\d+\s+R/.exec(trailer);
  if (root === null) throw new Error('PDF trailer has no /Root');
  const object = Number(root[1]);
  const body = openPdf(bytes).object(object);
  const dict = dictAt(body, 0);
  return {
    object,
    dict,
    keys: topKeys(dict),
    pageLayout: /\/PageLayout\s*\/([^\s/<>[\]()]+)/.exec(dict)?.[1] ?? null,
  };
}
