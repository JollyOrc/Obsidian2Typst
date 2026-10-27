// US-015 AC-8: the line map. The emitters put a mark before every block when
// asked; the marks are found and removed again line by line. Pure: no
// Obsidian, Node, or I/O imports.
import type {LineMapEntry} from './types';

/** A private-use character that the source does not contain, or null. */
function freeSentinel(source: string): string | null {
  for (let code = 0xe000; code <= 0xf8ff; code++) {
    const char = String.fromCharCode(code);
    if (!source.includes(char)) return char;
  }
  return null;
}

/** The marks of one export and the way to take them out again. */
export interface LineMarks {
  /** The text to put before a block that starts at `line` of the source. */
  mark(line: number): string;
  /**
   * Removes the marks from `text`. Returns its lines without marks and one
   * entry per line that had a mark; the last mark of a line is the innermost
   * block, so it wins. `typLine` counts from the first line of `text`.
   */
  extract(text: string): {lines: string[]; entries: LineMapEntry[]};
}

/** Marks that cannot occur in `source`; without a free character, no marks. */
export function createLineMarks(source: string): LineMarks {
  const sentinel = freeSentinel(source);
  if (sentinel === null) {
    return {
      mark: () => '',
      extract: (text) => ({lines: text.split('\n'), entries: []}),
    };
  }
  const found = new RegExp(`${sentinel}(\\d+)${sentinel}`, 'g');
  return {
    mark: (line) => `${sentinel}${line}${sentinel}`,
    extract(text) {
      const entries: LineMapEntry[] = [];
      const lines = text.split('\n').map((line, index) => {
        let sourceLine: number | undefined;
        const clean = line.replace(found, (_, digits: string) => {
          sourceLine = Number(digits);
          return '';
        });
        if (sourceLine !== undefined) {
          entries.push({typLine: index + 1, sourceLine});
        }
        return clean;
      });
      return {lines, entries};
    },
  };
}
