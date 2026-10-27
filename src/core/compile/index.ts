// US-007: the pure parts of compiling inside the plugin: the names of the
// exported files, the text of a compile error, and the request/result types.
// No Obsidian, Node or I/O imports.

/** What the compiler is given (US-007 AC-11). */
export interface CompileRequest {
  /** Name of the main file, for example `Rules.typ`; errors name this file. */
  file: string;
  /** The Typst source of the main file. */
  source: string;
  /** Files the document reads (assets, template), by path below the export folder. */
  files: Readonly<Record<string, Uint8Array>>;
  /** Font files (US-010). */
  fonts: readonly Uint8Array[];
}

/** The outcome of a compile; `error` is the text for the notice (US-007 AC-4). */
export type CompileResult =
  | {ok: true; pdf: Uint8Array}
  | {ok: false; kind: 'typst' | 'worker'; error: string};

/** The names of the files an export writes for one note. */
export interface ExportNames {
  base: string;
  typ: string;
  pdf: string;
  template: string;
}

/** The fixed name of the template copy (US-008). */
const TEMPLATE_FILE = 'template.typ';

/**
 * US-007 AC-1, AC-1b: `<note>.typ` and `<note>.pdf` next to `template.typ`.
 * A note called `template` (any case) would replace the template copy, so its
 * files are `template-note.*`.
 */
export function exportNames(noteName: string): ExportNames {
  const base =
    noteName.toLowerCase() === 'template' ? 'template-note' : noteName;
  return {
    base,
    typ: `${base}.typ`,
    pdf: `${base}.pdf`,
    template: TEMPLATE_FILE,
  };
}

const ERROR_LINE = /^(.+):(\d+):(\d+): error: (.*)$/;

/**
 * US-007 AC-4: the first error of the compiler's text as a notice, for
 * example `Typst error at test.typ:41:8: unknown variable: foo`. The compiler
 * writes `<path>:<line>:<column>: error: <text>`; the leading `/` of the path
 * is dropped. Any other text becomes `Typst error: <first line>`.
 */
export function formatCompileError(raw: string): string {
  const lines = raw
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  for (const line of lines) {
    const match = ERROR_LINE.exec(line);
    if (match === null) continue;
    const [, path, row, column, text] = match;
    const shown = (path as string).replace(/^\//, '');
    return `Typst error at ${shown}:${row}:${column}: ${text}`;
  }
  return `Typst error: ${lines[0] ?? 'unknown error'}`;
}
