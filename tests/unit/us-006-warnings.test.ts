// US-006 — warning record, report text, notices (unit, pure core). Source of
// truth: docs/user-stories/US-006-warnings-and-strict-mode.md. The report is
// exact text; its tables are also read back with the Markdown parser, because
// the vault note is rendered by a Markdown engine (SCAR-009, SCAR-010).
import MarkdownIt from 'markdown-it';
import {describe, expect, it} from 'vitest';
import {EmitContext, type Warning} from '../../src/core/emit';
import {
  buildReport,
  escapeCell,
  gotoLink,
  reportNotice,
  strictNotice,
  summarize,
  warningsNoteName,
  warningsNotePath,
} from '../../src/core/report';
import {blocks} from '../support/blocks';
import {fakeAssets} from '../support/images';

const w = (code: string, message: string, line: number): Warning => ({
  code,
  message,
  line,
});
const SOURCE = 'Sample/compiledtext.md';

describe('US-006 AC-1 the warning record', () => {
  it('US-006 AC-1: gives each warning a code, a message and a 1-based source line', () => {
    expect(blocks('See [[Nowhere]]').warnings).toEqual([
      w('LINK_UNRESOLVED', 'No heading matches "[[Nowhere]]"', 1),
    ]);
    expect(blocks('a\n\nb [[Nowhere]]').warnings[0]?.line).toBe(3);
  });

  it('US-006 AC-1: orders warnings by line, then by order of detection', () => {
    const out = blocks('![](b.bmp) ![](a.bmp)\n\n![](c.bmp)\n\n![](d.bmp)', {
      assets: fakeAssets({}),
    });
    expect(out.warnings.map((x) => [x.line, x.message])).toEqual([
      [1, 'Image type .bmp is not supported: b.bmp'],
      [1, 'Image type .bmp is not supported: a.bmp'],
      [3, 'Image type .bmp is not supported: c.bmp'],
      [5, 'Image type .bmp is not supported: d.bmp'],
    ]);
  });

  it('US-006 AC-1: puts a warning with line 0 before the warnings of the note', () => {
    const ctx = new EmitContext();
    ctx.warn('LINK_UNRESOLVED', 'x', 3);
    ctx.warn('FONT_MISSING', 'Font "Foo" is not available', 0);
    ctx.warn('ASSET_MISSING', 'y', 1);
    expect(ctx.finish().map((x) => [x.line, x.code])).toEqual([
      [0, 'FONT_MISSING'],
      [1, 'ASSET_MISSING'],
      [3, 'LINK_UNRESOLVED'],
    ]);
  });
});

describe('US-006 AC-2 the report file', () => {
  const two = [
    w('LINK_UNRESOLVED', 'No heading matches "[[Nowhere]]"', 412),
    w('ASSET_MISSING', 'Image file not found: assets/crypt.png', 977),
  ];

  it('US-006 AC-2: builds the export-warnings.md table with code, message, source line', () => {
    expect(buildReport(two)).toBe(
      [
        '# Export warnings',
        '',
        '| code | count |',
        '|------|-------|',
        '| ASSET_MISSING | 1 |',
        '| LINK_UNRESOLVED | 1 |',
        '',
        '## Details',
        '',
        '| code | message | source line |',
        '|------|---------|-------------|',
        '| LINK_UNRESOLVED | No heading matches "\\[\\[Nowhere\\]\\]" | 412 |',
        '| ASSET_MISSING | Image file not found: assets/crypt.png | 977 |',
        '',
      ].join('\n'),
    );
  });

  it('US-006 AC-2: writes a warning without a line as - in the source line column', () => {
    const row = buildReport([
      w('FONT_MISSING', 'Font "Foo" is not available', 0),
    ])
      .split('\n')
      .find((line) => line.startsWith('| FONT_MISSING | Font'));
    expect(row).toBe('| FONT_MISSING | Font "Foo" is not available | - |');
  });

  it('US-006 AC-2: escapes | as \\| in table cells', () => {
    expect(escapeCell('a|b')).toBe('a\\|b');
    expect(escapeCell('||')).toBe('\\|\\|');
    expect(buildReport([w('X_Y', 'a|b', 1)])).toContain('| X_Y | a\\|b | 1 |');
  });

  it('US-006 AC-2: escapes every bracket, a backslash and a line break in a message', () => {
    expect(escapeCell('[[Nowhere]]')).toBe('\\[\\[Nowhere\\]\\]');
    expect(escapeCell('x [y](z)')).toBe('x \\[y\\](z)');
    expect(escapeCell('C:\\a\\b')).toBe('C:\\\\a\\\\b');
    expect(escapeCell('one\ntwo\r\nthree')).toBe('one two three');
    expect(escapeCell('plain text')).toBe('plain text');
  });

  it("US-006 AC-2: writes 'No warnings.' when there are none (stale report overwritten)", () => {
    expect(buildReport([])).toBe('# Export warnings\n\nNo warnings.\n');
    expect(buildReport([], {linkFile: SOURCE})).toBe(
      '# Export warnings\n\nNo warnings.\n',
    );
  });

  it('US-006 AC-2: ends with exactly one line break and has no blank line inside a table', () => {
    const text = buildReport(two);
    expect(text.endsWith('|\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    const lines = text.split('\n');
    const at = lines.indexOf('| code | message | source line |');
    expect(lines.slice(at).filter((line) => line === '').length).toBe(1);
  });

  it('US-006 AC-2: is the same text for the same warnings (no timestamp, no state)', () => {
    expect(buildReport(two)).toBe(buildReport(two));
    expect(buildReport(two)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('US-006 AC-2b the vault note', () => {
  it("US-006 AC-2b: builds the vault note '<source name> export warnings.md' without a timestamp", () => {
    expect(warningsNoteName('Sample/compiledtext.md')).toBe(
      'compiledtext export warnings.md',
    );
    expect(warningsNoteName('note.md')).toBe('note export warnings.md');
    expect(warningsNoteName('a.b.md')).toBe('a.b export warnings.md');
    expect(warningsNoteName('C:\\books\\x.md')).toBe('x export warnings.md');
  });

  it("US-006 AC-2b: puts the note into the 'Warnings note folder' (default: vault root)", () => {
    const name = 'compiledtext export warnings.md';
    expect(warningsNotePath(SOURCE, '')).toBe(name);
    expect(warningsNotePath(SOURCE, 'Reports')).toBe(`Reports/${name}`);
    expect(warningsNotePath(SOURCE, '/Reports/')).toBe(`Reports/${name}`);
    expect(warningsNotePath(SOURCE, 'A/B//')).toBe(`A/B/${name}`);
    expect(warningsNotePath(SOURCE, '/')).toBe(name);
  });

  it('US-006 AC-2b: makes each source line an obsidian://obsidian2typst-goto?file=...&line=... link', () => {
    expect(gotoLink(SOURCE, 412)).toBe(
      'obsidian://obsidian2typst-goto?file=Sample%2Fcompiledtext.md&line=412',
    );
    expect(
      buildReport(
        [w('LINK_UNRESOLVED', 'No heading matches "[[Nowhere]]"', 412)],
        {
          linkFile: SOURCE,
        },
      ),
    ).toContain(
      '| LINK_UNRESOLVED | No heading matches "\\[\\[Nowhere\\]\\]" | [412](obsidian://obsidian2typst-goto?file=Sample%2Fcompiledtext.md&line=412) |',
    );
  });

  it('US-006 AC-2b: encodes the file so that it reads back unchanged', () => {
    for (const file of [
      'Folder/ü & x=1.md',
      'a b/c#d?e.md',
      '100%/x.md',
      'a)b(c.md',
    ]) {
      const url = new URL(gotoLink(file, 7));
      expect(url.searchParams.get('file')).toBe(file);
      expect(url.searchParams.get('line')).toBe('7');
      expect(gotoLink(file, 7)).not.toMatch(/[()\s]/);
    }
  });

  it('US-006 AC-2b: shows a plain number when the source file is outside the vault', () => {
    const text = buildReport([w('LINK_UNRESOLVED', 'x', 412)], {
      linkFile: null,
    });
    expect(text).toContain('| LINK_UNRESOLVED | x | 412 |');
    expect(text).not.toContain('obsidian2typst-goto');
  });

  it('US-006 AC-2b: shows - and no link for a warning without a line', () => {
    const text = buildReport([w('FONT_MISSING', 'x', 0)], {linkFile: SOURCE});
    expect(text).toContain('| FONT_MISSING | x | - |');
    expect(text).not.toContain('obsidian2typst-goto');
  });
});

describe('US-006 AC-5 warnings from several stories in one run', () => {
  it('US-006 AC-5: reports a missing image (line 10), an unresolved link (line 4), an unused footnote (line 7) in the order 4, 7, 10', () => {
    const md = [
      'a',
      '',
      '',
      'See [[Nowhere]]',
      '',
      '',
      '[^u]: unused',
      '',
      '',
      '![](assets/crypt.png)',
    ].join('\n');
    const {warnings} = blocks(md, {assets: fakeAssets({})});
    expect(warnings.map((x) => [x.line, x.code])).toEqual([
      [4, 'LINK_UNRESOLVED'],
      [7, 'FOOTNOTE_UNUSED'],
      [10, 'ASSET_MISSING'],
    ]);
    const rows = buildReport(warnings)
      .split('\n')
      .filter((line) => /^\| [A-Z_]+ \| .* \| \d+ \|$/.test(line));
    expect(rows.map((row) => row.split(' | ').at(-1))).toEqual([
      '4 |',
      '7 |',
      '10 |',
    ]);
  });

  it('US-006 AC-5: puts a warning without a line before them', () => {
    const rows = buildReport([
      w('FONT_MISSING', 'f', 0),
      w('LINK_UNRESOLVED', 'l', 4),
    ])
      .split('\n')
      .filter((line) => /^\| [A-Z_]+ \| \w+ \| (\d+|-) \|$/.test(line));
    expect(rows.map((row) => row.split(' ')[1])).toEqual([
      'FONT_MISSING',
      'LINK_UNRESOLVED',
    ]);
  });
});

describe('US-006 AC-8 the grouped summary', () => {
  const many = [
    ...Array.from({length: 2}, () => w('B_CODE', 'b', 1)),
    ...Array.from({length: 2}, () => w('A_CODE', 'a', 2)),
    ...Array.from({length: 5}, () => w('C_CODE', 'c', 3)),
    w('D_CODE', 'd', 4),
  ];

  it('US-006 AC-8: summarizes by code, sorted by count then code', () => {
    expect(summarize(many)).toEqual([
      {code: 'C_CODE', count: 5},
      {code: 'A_CODE', count: 2},
      {code: 'B_CODE', count: 2},
      {code: 'D_CODE', count: 1},
    ]);
    expect(summarize([])).toEqual([]);
  });

  it('US-006 AC-8: writes a summary table by code, sorted by count then code, above the details', () => {
    const lines = buildReport(many).split('\n');
    expect(lines.slice(0, 11)).toEqual([
      '# Export warnings',
      '',
      '| code | count |',
      '|------|-------|',
      '| C_CODE | 5 |',
      '| A_CODE | 2 |',
      '| B_CODE | 2 |',
      '| D_CODE | 1 |',
      '',
      '## Details',
      '',
    ]);
    expect(
      buildReport(many, {linkFile: SOURCE}).split('\n').slice(0, 11),
    ).toEqual(lines.slice(0, 11));
  });

  it('US-006 AC-8: keeps the notice as a single count', () => {
    expect(reportNotice(many.length, 'E/export-warnings.md')).toBe(
      'Exported with 10 warnings. Report: E/export-warnings.md',
    );
  });
});

describe('US-006 AC-3 the notice', () => {
  it("US-006 AC-3: shows 'Exported with 2 warnings' and, for one warning, '1 warning', with the report path", () => {
    expect(reportNotice(2, 'Export/run1/export-warnings.md')).toBe(
      'Exported with 2 warnings. Report: Export/run1/export-warnings.md',
    );
    expect(reportNotice(1, 'Export/run1/export-warnings.md')).toBe(
      'Exported with 1 warning. Report: Export/run1/export-warnings.md',
    );
  });

  it('US-006 AC-3: shows no notice when there are no warnings', () => {
    expect(reportNotice(0, 'Export/run1/export-warnings.md')).toBeNull();
  });
});

describe('US-006 AC-4 the strict-mode notice', () => {
  it("US-006 AC-4: shows 'Export aborted: 2 warnings (strict mode)' with the first five warnings as 'line 412: LINK_UNRESOLVED'", () => {
    expect(
      strictNotice([
        w('LINK_UNRESOLVED', 'x', 412),
        w('ASSET_MISSING', 'y', 977),
      ]),
    ).toBe(
      'Export aborted: 2 warnings (strict mode)\nline 412: LINK_UNRESOLVED\nline 977: ASSET_MISSING',
    );
    expect(strictNotice([w('LINK_UNRESOLVED', 'x', 412)])).toBe(
      'Export aborted: 1 warning (strict mode)\nline 412: LINK_UNRESOLVED',
    );
  });

  it('US-006 AC-4: lists only the first five, with the total in the first line', () => {
    const seven = Array.from({length: 7}, (_, i) => w('C', 'c', i + 1));
    const lines = strictNotice(seven).split('\n');
    expect(lines[0]).toBe('Export aborted: 7 warnings (strict mode)');
    expect(lines.slice(1)).toEqual([
      'line 1: C',
      'line 2: C',
      'line 3: C',
      'line 4: C',
      'line 5: C',
    ]);
  });

  it('US-006 AC-4: writes a warning without a line as the code alone', () => {
    expect(strictNotice([w('FONT_MISSING', 'f', 0)])).toBe(
      'Export aborted: 1 warning (strict mode)\nFONT_MISSING',
    );
  });
});

describe('US-006 AC-2 the report read back as Markdown (SCAR-009, SCAR-010)', () => {
  const md = new MarkdownIt({html: false}).enable('table');
  const MESSAGES = [
    'plain',
    'a|b',
    'a\\|b',
    '\\',
    'ends with \\',
    '|',
    '||',
    '[[Nowhere]]',
    'x [[y|z]] w',
    'a]]b',
    '[x](y)',
    'path [a](b.png)',
    'C:\\a\\b|c',
    'two\nlines',
    'a  b',
    '"quoted" [[x]]',
  ];

  /** The cells of the detail rows, from the parsed table. */
  function detailRows(text: string) {
    const tokens = md.parse(text, {});
    const rows: {cells: string[]; links: number}[] = [];
    let row: {cells: string[]; links: number} | null = null;
    let table = 0;
    tokens.forEach((token) => {
      if (token.type === 'table_open') table += 1;
      if (token.type === 'tr_open') row = {cells: [], links: 0};
      if (token.type === 'inline' && row !== null) {
        const parts = token.children ?? [];
        row.links += parts.filter((p) => p.type === 'link_open').length;
        row.cells.push(
          parts
            .filter((p) => p.type === 'text' || p.type === 'code_inline')
            .map((p) => p.content)
            .join(''),
        );
      }
      if (token.type === 'tr_close' && row !== null) {
        if (table === 2) rows.push(row);
        row = null;
      }
    });
    return rows;
  }

  it('US-006 AC-2: every message reads back as one cell with the same text and no link', () => {
    for (const message of MESSAGES) {
      const text = buildReport([w('X_Y', message, 12)]);
      const rows = detailRows(text);
      const body = rows.slice(1);
      expect(body, JSON.stringify(message)).toHaveLength(1);
      expect(body[0]?.cells, JSON.stringify(message)).toEqual([
        'X_Y',
        message.replace(/\r?\n/g, ' '),
        '12',
      ]);
      expect(body[0]?.links, JSON.stringify(message)).toBe(0);
    }
  });

  it('US-006 AC-2b: the vault note has one link per row, to the goto address, and nothing else', () => {
    const text = buildReport(
      MESSAGES.map((message, i) => w('X_Y', message, i + 1)),
      {linkFile: SOURCE},
    );
    const rows = detailRows(text).slice(1);
    expect(rows).toHaveLength(MESSAGES.length);
    expect(rows.every((row) => row.links === 1 && row.cells.length === 3)).toBe(
      true,
    );
    const hrefs = [...text.matchAll(/\]\((obsidian:[^)]*)\)/g)].map(
      (m) => m[1],
    );
    expect(hrefs).toHaveLength(MESSAGES.length);
  });

  it('US-006 AC-8: the summary reads back as a table of code and count', () => {
    const tokens = md.parse(
      buildReport([w('A_B', 'x', 1), w('A_B', 'y', 2), w('C_D', 'z', 3)]),
      {},
    );
    const cells = tokens
      .filter((t) => t.type === 'inline')
      .map((t) => t.content);
    expect(cells.slice(0, 6)).toEqual([
      'Export warnings',
      'code',
      'count',
      'A_B',
      '2',
      'C_D',
    ]);
  });
});

describe('US-006 AC-2 the report of real converter messages', () => {
  it('US-006 AC-2: reads back every message of a run with every kind of warning', () => {
    const md = new MarkdownIt().enable('table');
    const out = blocks(
      [
        'See [[Nowhere]] and [x](#nope).',
        '',
        '![](assets/no|pipe.png) ![](a.bmp) ![](https://x.org/a.png)',
        '',
        '[^u]: unused',
        '',
        'text^[open',
      ].join('\n'),
      {assets: fakeAssets({})},
    );
    expect(out.warnings.length).toBeGreaterThan(4);
    const text = buildReport(out.warnings, {linkFile: SOURCE});
    const tokens = md.parse(text, {});
    const links = tokens
      .flatMap((t) => t.children ?? [])
      .filter((t) => t.type === 'link_open');
    expect(links.length).toBe(out.warnings.length);
    expect(tokens.filter((t) => t.type === 'tr_open').length).toBe(
      out.warnings.length +
        1 +
        1 +
        new Set(out.warnings.map((x) => x.code)).size,
    );
  });
});
