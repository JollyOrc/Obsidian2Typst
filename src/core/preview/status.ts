// US-012 AC-4, AC-11: the text of the status line. Pure core: no Obsidian or
// I/O imports.

/** What the line is made from (the preview state has more fields). */
export interface StatusState {
  status: 'no-note' | 'idle' | 'compiling' | 'ready' | 'error' | 'export';
  noteName: string | null;
  error: string | null;
  hint: string | null;
  /** Warnings of the last successful run; null when there is none yet. */
  warnings: number | null;
}

/** US-012 AC-11: `2 warnings`, `1 warning`, `no warnings`. */
export function warningCountText(count: number): string {
  if (count === 0) return 'no warnings';
  return count === 1 ? '1 warning' : `${count} warnings`;
}

/**
 * US-012 AC-4, AC-9, AC-11: the status line. With no note it is
 * `Open a note to preview it`; otherwise it starts with `Preview of: <name>`
 * and continues, separated by ` · `, with `Compiling…`, the export text, the
 * error message, or the warning count of the last run, and then the hint
 * (`Note changed; press Refresh`) when there is one.
 */
export function statusLine(state: StatusState): string {
  if (state.status === 'no-note') return 'Open a note to preview it';
  const parts = [`Preview of: ${state.noteName ?? ''}`];
  if (state.status === 'compiling') parts.push('Compiling…');
  else if (state.status === 'export')
    parts.push('Export running; the preview updates afterwards');
  else if (state.status === 'error' && state.error !== null)
    parts.push(state.error);
  else if (state.warnings !== null)
    parts.push(warningCountText(state.warnings));
  if (state.hint !== null) parts.push(state.hint);
  return parts.join(' · ');
}
