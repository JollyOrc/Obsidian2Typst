// US-013: escape literal text for Typst markup. The only function that does
// this; code and string literals have their own functions (SCAR-001).
//
// Transforms (ids are listed in the shared-utility register):
//  - backslash:          `\`  -> `\\`
//  - special-chars:      `$ # @ < > [ ] ~ * _ ` ` get a backslash in front
//  - double-slash:       `//` -> `\/\/` (a single `/` stays)
//  - soft-hyphen:        `-?` -> `\-?`
//  - line-start-heading: `=`-run followed by a blank or the line end at a line start -> first `=` escaped
//  - line-start-list:    `-`, `+`, `/` followed by a blank or the line end at a line start -> escaped
//  - line-start-enum:    digits + `.` followed by a blank or the line end at a line start -> the dot escaped
// (A marker at the end of a line is an empty item in Typst, so it is escaped too.)
// Everything else is unchanged on purpose: typography (`--`, `---`, `...`,
// quotes), non-ASCII, `{ } ( ) : % & ^ |`. Not idempotent: escape once.
// Evidence: docs/technical/typst-escaping-findings.md.

export interface MarkupOptions {
  /** True when the text starts a content block (paragraph, list item, `[...]`). */
  atBlockStart: boolean;
}

export interface Transform {
  id: string;
  description: string;
}

export const MARKUP_TRANSFORMS: readonly Transform[] = [
  {id: 'backslash', description: 'backslash is doubled'},
  {
    id: 'special-chars',
    description: '$ # @ < > [ ] ~ * _ and backtick get a backslash',
  },
  {id: 'double-slash', description: '// becomes \\/\\/'},
  {id: 'soft-hyphen', description: '-? becomes \\-?'},
  {
    id: 'line-start-heading',
    description:
      '= run plus blank or line end at a line start: first = escaped',
  },
  {
    id: 'line-start-list',
    description: '-, + or / plus blank or line end at a line start: escaped',
  },
  {
    id: 'line-start-enum',
    description:
      'digits plus . and a blank or line end at a line start: the dot escaped',
  },
];

const SPECIAL = new Set([
  '$',
  '#',
  '@',
  '<',
  '>',
  '[',
  ']',
  '~',
  '*',
  '_',
  '`',
]);

function isBlank(c: string | undefined): boolean {
  return c === ' ' || c === '\t';
}

/** A marker needs escaping when a blank follows or the line ends (an empty item). */
function endsMarker(c: string | undefined): boolean {
  return c === undefined || isBlank(c);
}

/** Index of the character to escape because it starts a line marker, or -1. */
function lineMarkerIndex(line: string): number {
  let i = 0;
  while (isBlank(line[i])) i++;
  const c = line[i];
  if (c === '=') {
    let j = i;
    while (line[j] === '=') j++;
    return endsMarker(line[j]) ? i : -1;
  }
  if (c === '-' || c === '+' || c === '/') {
    return endsMarker(line[i + 1]) ? i : -1;
  }
  if (c !== undefined && c >= '0' && c <= '9') {
    let j = i;
    while (
      line[j] !== undefined &&
      (line[j] as string) >= '0' &&
      (line[j] as string) <= '9'
    )
      j++;
    return line[j] === '.' && endsMarker(line[j + 1]) ? j : -1;
  }
  return -1;
}

function escapeLine(line: string, lineStart: boolean): string {
  const marker = lineStart ? lineMarkerIndex(line) : -1;
  let out = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i] as string;
    if (i === marker) {
      out += `\\${c}`;
    } else if (c === '\\' || SPECIAL.has(c)) {
      out += `\\${c}`;
    } else if (c === '/' && line[i + 1] === '/') {
      out += '\\/\\/';
      i++;
    } else if (c === '-' && line[i + 1] === '?') {
      out += '\\-?';
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

export function escapeMarkup(text: string, options: MarkupOptions): string {
  return text
    .split('\n')
    .map((line, index) => escapeLine(line, index > 0 || options.atBlockStart))
    .join('\n');
}
