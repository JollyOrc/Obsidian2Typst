// SCAR-029: the manual checks, one file per check in
// docs/technical/manual-checks/ (`M01.md`, …) and the index
// docs/technical/manual-checks.md that links each of them. The one reader of
// these files for the tests.
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

/** The index of the manual checks. */
export const CHECKS_INDEX = 'docs/technical/manual-checks.md';
/** The folder with one file per manual check. */
export const CHECKS_DIR = 'docs/technical/manual-checks';

/**
 * SCAR-029: the file name of check `id` (`M1` → `M01.md`, `M16` →
 * `M16.md`). Throws for an id that is not `M` and a number.
 */
export function checkFile(id: string): string {
  const m = /^M(\d+)$/.exec(id);
  if (m === null) throw new Error(`not a check id: ${id}`);
  return `M${(m[1] as string).padStart(2, '0')}.md`;
}

/** SCAR-029: the text of check `id` from its own file. */
export const readCheck = (id: string): string =>
  readFileSync(join(CHECKS_DIR, checkFile(id)), 'utf8');

/** SCAR-029: the file names in the checks folder, sorted. */
export const checkFiles = (dir: string = CHECKS_DIR): string[] =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort();

/**
 * SCAR-029: the rows of the index table: the check id and the file its link
 * names, in the order of the table. A row is a line that starts with `| [M`.
 */
export function indexRows(
  index: string = readFileSync(CHECKS_INDEX, 'utf8'),
): {id: string; file: string}[] {
  return index
    .split('\n')
    .map((line) => /^\| \[(M\d+)\]\(manual-checks\/([^)]+)\) \|/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({id: m[1] as string, file: m[2] as string}));
}

/** SCAR-029: the index and every check file, in file order, as one text. */
export const readAllChecks = (): string =>
  [
    readFileSync(CHECKS_INDEX, 'utf8'),
    ...checkFiles().map((name) => readFileSync(join(CHECKS_DIR, name), 'utf8')),
  ].join('\n');
