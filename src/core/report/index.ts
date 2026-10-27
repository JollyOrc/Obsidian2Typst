// US-006: the texts of the warning report, the notices, and the names of the
// report files. Pure: no Obsidian, Node, or I/O imports. The warning record
// itself is the `Warning` of `core/emit` (ordered by line by `EmitContext`).
import type {Warning} from '../emit';

/** One row of the summary table (US-006 AC-8). */
export interface CodeCount {
  code: string;
  count: number;
}

/** Options of {@link buildReport}. */
export interface ReportOptions {
  /**
   * Vault path of the source note: every source line becomes a link that
   * opens the note at that line (US-006 AC-2b). `null` or absent: plain
   * numbers (the export-folder file, or a source outside the vault).
   */
  linkFile?: string | null;
}

/**
 * US-006 AC-2: a message as one table cell. A backslash, `|`, `[` and `]`
 * are escaped so that the cell stays one cell and the vault note creates no
 * link; a line break is one blank.
 */
export function escapeCell(text: string): string {
  return text
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/** US-006 AC-8: one row per code, by count (highest first), then by code. */
export function summarize(warnings: readonly Warning[]): CodeCount[] {
  const counts = new Map<string, number>();
  for (const {code} of warnings) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts]
    .map(([code, count]) => ({code, count}))
    .sort(
      (a, b) =>
        b.count - a.count || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
    );
}

/**
 * US-006 AC-2b: the address that opens `file` at `line`. The file is
 * percent-encoded, parentheses included, so that it is safe in a Markdown link.
 */
export function gotoLink(file: string, line: number): string {
  const encoded = encodeURIComponent(file)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  return `obsidian://obsidian2typst-goto?file=${encoded}&line=${line}`;
}

/** The source line cell: `-` without a line, a link when `linkFile` is set. */
function lineCell(line: number, linkFile: string | null): string {
  if (line <= 0) return '-';
  return linkFile === null
    ? String(line)
    : `[${line}](${gotoLink(linkFile, line)})`;
}

/**
 * US-006 AC-2, AC-2b, AC-8: the report as Markdown: a summary by code, then
 * the details in the order of `warnings`. Without warnings: `No warnings.`.
 * The same input gives the same text (no time, no state).
 */
export function buildReport(
  warnings: readonly Warning[],
  options: ReportOptions = {},
): string {
  if (warnings.length === 0) return '# Export warnings\n\nNo warnings.\n';
  const linkFile = options.linkFile ?? null;
  const lines = [
    '# Export warnings',
    '',
    '| code | count |',
    '|------|-------|',
    ...summarize(warnings).map(({code, count}) => `| ${code} | ${count} |`),
    '',
    '## Details',
    '',
    '| code | message | source line |',
    '|------|---------|-------------|',
    ...warnings.map(
      ({code, message, line}) =>
        `| ${code} | ${escapeCell(message)} | ${lineCell(line, linkFile)} |`,
    ),
  ];
  return `${lines.join('\n')}\n`;
}

const plural = (count: number): string =>
  `${count} warning${count === 1 ? '' : 's'}`;

/** US-006 AC-3: the notice after an export; `null` without warnings. */
export function reportNotice(count: number, reportPath: string): string | null {
  return count === 0
    ? null
    : `Exported with ${plural(count)}. Report: ${reportPath}`;
}

/** US-006 AC-4: the notice of a strict-mode abort, with the first five. */
export function strictNotice(warnings: readonly Warning[]): string {
  const first = warnings
    .slice(0, 5)
    .map(({code, line}) => (line > 0 ? `line ${line}: ${code}` : code));
  return [
    `Export aborted: ${plural(warnings.length)} (strict mode)`,
    ...first,
  ].join('\n');
}

/** US-006 AC-2b: `Book export warnings.md` for `Sample/Book.md`. */
export function warningsNoteName(sourcePath: string): string {
  const name = sourcePath.slice(
    Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\')) + 1,
  );
  return `${name.replace(/\.md$/, '')} export warnings.md`;
}

/** US-006 AC-2b: the vault path of the note; slashes around `folder` are ignored. */
export function warningsNotePath(sourcePath: string, folder: string): string {
  const name = warningsNoteName(sourcePath);
  const base = folder.replace(/^\/+|\/+$/g, '');
  return base === '' ? name : `${base}/${name}`;
}
