// US-037: a PDF with facing pages opens as spreads in a viewer's two-page
// view. Typst 0.14.2 writes no `/PageLayout`; this file appends one
// incremental update to the bytes Typst writes — a revision of the catalog
// with `/PageLayout /TwoPageRight` (page 1 alone, then 2+3, 4+5), an xref
// section with that one object, and Typst's trailer with `/Prev`. Pure code
// on the bytes (no Obsidian, Node or I/O imports); the only writer of
// `/PageLayout` (AC-12). Measured: `docs/technical/spike-page-layout.md`.
import type {Warning} from '../emit';
import {latin1, openPdf} from './reader';

/** US-037 AC-9: why a PDF cannot be updated. */
export type SpreadsFailure =
  | 'no startxref'
  | 'no xref table'
  | 'no trailer'
  | 'no catalog'
  | 'encrypted'
  | 'already updated';

/** US-037: the bytes to write, and whether they carry the update. */
export type SpreadsUpdate =
  | {status: 'updated' | 'kept'; pdf: Uint8Array}
  | {status: 'failed'; pdf: Uint8Array; reason: SpreadsFailure};

/** The entry the revision adds (AC-1). */
const ENTRY = '\n  /PageLayout /TwoPageRight';

/** `startxref`, its offset and `%%EOF` at the end (a line end allowed). */
const START_XREF = /startxref\s+(\d+)\s+%%EOF\s*$/;

/**
 * US-037 | AC-10: True when `dict` (a dictionary's text from its `<<`) has a
 * `/PageLayout` key at its top level; one in a nested dictionary does not
 * count. Strings are skipped so that a `<<` inside `(…)` does not nest.
 */
function hasTopLevelPageLayout(dict: string): boolean {
  let depth = 0;
  for (let i = 0; i < dict.length; i++) {
    const ch = dict[i];
    if (ch === '(') {
      let open = 1;
      for (i++; i < dict.length && open > 0; i++) {
        if (dict[i] === '\\') i++;
        else if (dict[i] === '(') open++;
        else if (dict[i] === ')') open--;
      }
      i--;
    } else if (ch === '<' && dict[i + 1] === '<') {
      depth++;
      i++;
    } else if (ch === '>' && dict[i + 1] === '>') {
      depth--;
      i++;
    } else if (
      depth === 1 &&
      /^\/PageLayout(?=[\s/<>[\]()%{}])/.test(dict.slice(i, i + 12))
    ) {
      return true;
    }
  }
  return false;
}

/** The latin1 bytes of `text` after a copy of `head`. */
function appended(head: Uint8Array, text: string): Uint8Array {
  const out = new Uint8Array(head.length + text.length);
  out.set(head);
  for (let i = 0; i < text.length; i++) {
    out[head.length + i] = text.charCodeAt(i) & 0xff;
  }
  return out;
}

/**
 * US-037 | AC-1, AC-2, AC-3, AC-9, AC-10: The bytes of `pdf` with one
 * incremental update that makes the document open as spreads.
 *
 * Appends `⏎⏎`, the catalog object again under its own number and
 * generation with `⏎  /PageLayout /TwoPageRight` directly after its opening
 * `<<` (every other byte of its text as Typst wrote it), a blank line, an
 * `xref` section with one 20-byte entry for it, the last trailer's
 * dictionary as written with `  /Prev <startxref>⏎` before its closing `>>`,
 * and `startxref` / `%%EOF` (no line end after it). No object number is
 * added, so `/Size` stays. `pdf` is not changed; the result is a new array.
 *
 * Assumes the form Typst 0.14.2 writes (one revision, a classic xref table,
 * no encryption). Any other form is `failed` with its reason and `pdf`
 * itself; a catalog that already has a top-level `/PageLayout` is `kept`
 * with `pdf` itself. Reports nothing (SCAR-038): the export run turns a
 * failure into {@link pageLayoutFailedWarning}. Deterministic: the result
 * depends on the bytes only.
 */
export function withTwoPageRight(pdf: Uint8Array): SpreadsUpdate {
  const failed = (reason: SpreadsFailure): SpreadsUpdate => ({
    status: 'failed',
    pdf,
    reason,
  });
  const text = latin1(pdf);
  const end = START_XREF.exec(text);
  if (end === null) return failed('no startxref');
  const prev = Number(end[1]);
  if (!text.startsWith('xref', prev)) return failed('no xref table');
  const trailerAt = text.lastIndexOf('trailer', end.index);
  if (trailerAt < prev) return failed('no trailer');
  const open = text.indexOf('<<', trailerAt);
  const close = text.lastIndexOf('>>', end.index);
  if (open < 0 || close < open) return failed('no trailer');
  const trailer = text.slice(open, close + 2);
  const root = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(trailer);
  if (root === null || !/\/Size\s+\d+/.test(trailer)) {
    return failed('no trailer');
  }
  if (/\/Encrypt\b/.test(trailer)) return failed('encrypted');
  if (/\/Prev\b/.test(trailer)) return failed('already updated');

  const num = root[1] as string;
  const gen = root[2] as string;
  let body: string;
  try {
    body = openPdf(pdf).object(Number(num));
  } catch {
    return failed('no catalog');
  }
  const catalog = body.trim();
  if (!catalog.startsWith('<<')) return failed('no catalog');
  if (hasTopLevelPageLayout(catalog)) return {status: 'kept', pdf};

  const revision = `<<${ENTRY}${catalog.slice(2)}`;
  let tail = '\n\n';
  const objectAt = text.length + tail.length;
  tail += `${num} ${gen} obj\n${revision}\nendobj\n\n`;
  const xrefAt = text.length + tail.length;
  const entry = `${String(objectAt).padStart(10, '0')} ${gen.padStart(5, '0')} n\r\n`;
  const newTrailer = `${trailer.slice(0, -2).replace(/[ \t]*$/, '')}  /Prev ${prev}\n>>`;
  tail +=
    `xref\n${num} 1\n${entry}` +
    `trailer\n${newTrailer}\nstartxref\n${xrefAt}\n%%EOF`;
  return {status: 'updated', pdf: appended(pdf, tail)};
}

/**
 * US-037 | AC-9: The warning for a PDF that could not be updated, with its
 * reason; no source line.
 */
export function pageLayoutFailedWarning(reason: SpreadsFailure): Warning {
  return {
    code: 'PDF_PAGE_LAYOUT_FAILED',
    message: `The PDF could not be set to open as spreads (${reason}); it is written as compiled`,
    line: 0,
  };
}
