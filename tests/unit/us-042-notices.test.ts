// US-042 AC-11 — the texts of the notices after an export (core, no Obsidian):
// finished with and without warnings, failed, cancelled, strict mode. Amends
// US-006 AC-3 and AC-4. Source of truth: docs/user-stories/US-042-ui-standard.md.
import {describe, expect, it} from 'vitest';
import {
  CANCELLED_NOTICE,
  failedNotice,
  finishedNotice,
  strictNotice,
} from '../../src/core/report';

describe('US-042 AC-11: finished', () => {
  it('without warnings: the PDF and the folder', () => {
    expect(
      finishedNotice({pdf: 'Book.pdf', folder: '/out/a5', warnings: 0}),
    ).toBe('✅ Exported Book.pdf to /out/a5');
  });
  it('one warning, singular', () => {
    expect(
      finishedNotice({pdf: 'Book.pdf', folder: '/out/a5', warnings: 1}),
    ).toBe(
      '✅ Exported Book.pdf to /out/a5, 1 warning (see export-warnings.md)',
    );
  });
  it('several warnings', () => {
    expect(
      finishedNotice({pdf: 'Fen Hare.pdf', folder: 'C:\\out', warnings: 217}),
    ).toBe(
      '✅ Exported Fen Hare.pdf to C:\\out, 217 warnings (see export-warnings.md)',
    );
  });
});

describe('US-042 AC-11: failed and cancelled', () => {
  it('failed names the reason', () => {
    expect(failedNotice('unknown variable: foo')).toBe(
      '❌ Export failed: unknown variable: foo',
    );
  });
  it('cancelled', () => {
    expect(CANCELLED_NOTICE).toBe('❌ Export cancelled.');
  });
});

describe('US-042 AC-11: strict mode', () => {
  const w = (code: string, line: number) => ({code, message: code, line});
  it('the count in the first line, then the first five as today', () => {
    const text = strictNotice([
      w('A', 1),
      w('B', 2),
      w('C', 0),
      w('D', 4),
      w('E', 5),
      w('F', 6),
    ]);
    const lines = text.split('\n');
    expect(lines[0]).toBe('❌ Export aborted: 6 warnings (strict mode)');
    expect(text).toContain('line 1: A');
    expect(text).toContain('C');
    expect(text).not.toContain('F');
  });
  it('one warning, singular', () => {
    expect(strictNotice([w('A', 3)]).split('\n')[0]).toBe(
      '❌ Export aborted: 1 warning (strict mode)',
    );
  });
});
