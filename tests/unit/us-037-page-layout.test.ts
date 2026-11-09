// US-037 AC-1, AC-3, AC-9, AC-10 — the incremental update that makes a PDF
// open as spreads (`/PageLayout /TwoPageRight`), as pure code on the bytes:
// the exact bytes of the story's example, the rules behind them (the join
// after `%%EOF`, the catalog revision, the xref entry, the trailer with
// `/Prev`), the same bytes from two fresh module loads, the forms that are
// refused with their reason and warning, and a catalog that already has a
// `/PageLayout`. Expected values come from the story (`tests/support/
// spreads.ts`), not from the code (SCAR-003).
// Source of truth: docs/user-stories/US-037-facing-pages-open-as-spreads.md.
import {describe, expect, it, vi} from 'vitest';
import {
  pageLayoutFailedWarning,
  withTwoPageRight,
  type SpreadsFailure,
} from '../../src/core/pdf/page-layout';
import {readPdfCatalog, walkXref} from '../support/pdf-structure';
import {
  AC1_CATALOG,
  AC1_TYPST,
  AC1_UPDATE,
  bytes,
  text,
  typstPdf,
} from '../support/spreads';

describe('US-037 AC-1 the bytes appended', () => {
  it('US-037 AC-1: the example — 324 bytes become 575: Typst’s bytes unchanged, then the update', () => {
    expect(AC1_TYPST.length).toBe(324);
    expect(AC1_UPDATE.length).toBe(251);
    const result = withTwoPageRight(bytes(AC1_TYPST));
    expect(result.status).toBe('updated');
    expect(result.pdf.length).toBe(575);
    expect(text(result.pdf)).toBe(AC1_TYPST + AC1_UPDATE);
  });

  it('US-037 AC-1: the input array is not changed', () => {
    const input = bytes(AC1_TYPST);
    const copy = input.slice();
    withTwoPageRight(input);
    expect(input).toEqual(copy);
  });

  it('US-037 AC-1: the offsets are those of `2 0 obj` (326) and `xref` (457); the structure walks', () => {
    const out = text(withTwoPageRight(bytes(AC1_TYPST)).pdf);
    expect(out.startsWith('2 0 obj', 326)).toBe(true);
    expect(out.startsWith('xref', 457)).toBe(true);
    const walk = walkXref(bytes(out));
    expect(walk.problems).toEqual([]);
    expect(walk.sections.map((s) => s.at)).toEqual([457, 178]);
    expect(walk.checked).toBe(3);
  });

  it('US-037 AC-1 (SCAR-010): Typst ends without a line end, so the update starts with `\\n\\n`; a line end after %%EOF is kept and the pair still follows', () => {
    const plain = typstPdf(AC1_CATALOG);
    expect(plain.endsWith('%%EOF')).toBe(true);
    expect(
      text(withTwoPageRight(bytes(plain)).pdf).slice(
        plain.length,
        plain.length + 10,
      ),
    ).toBe('\n\n2 0 obj\n<');
    const withEol = typstPdf(AC1_CATALOG, undefined, '\n');
    const out = text(withTwoPageRight(bytes(withEol)).pdf);
    expect(out.startsWith(withEol)).toBe(true);
    expect(out.slice(withEol.length, withEol.length + 9)).toBe('\n\n2 0 obj');
    expect(walkXref(bytes(out)).problems).toEqual([]);
  });

  it('US-037 AC-1, AC-2: the revision is Typst’s catalog with `/PageLayout /TwoPageRight` first; every key kept', () => {
    const catalog =
      '<<\n  /Type /Catalog\n  /Pages 1 0 R\n  /Lang (en)\n  /MarkInfo <<\n    /Marked true\n  >>\n' +
      '  /ViewerPreferences <<\n    /Direction /L2R\n  >>\n>>';
    const before = readPdfCatalog(bytes(typstPdf(catalog)));
    const after = readPdfCatalog(
      withTwoPageRight(bytes(typstPdf(catalog))).pdf,
    );
    expect(after.object).toBe(before.object);
    expect(after.keys).toEqual(['PageLayout', ...before.keys]);
    expect(after.dict).toBe(
      catalog.replace('<<', '<<\n  /PageLayout /TwoPageRight'),
    );
  });

  it('US-037 AC-1, AC-2: the trailer is Typst’s with `/Prev` added before `>>` (/Size, /Root, /Info, /ID kept)', () => {
    const pdf = typstPdf(AC1_CATALOG, [
      '/Size 3',
      '/Root 2 0 R',
      '/Info 1 0 R',
      '/ID [(p8JJ+Q==) (p8JJ+Q==)]',
    ]);
    const prev = /startxref\n(\d+)\n%%EOF$/.exec(pdf)?.[1];
    const out = text(withTwoPageRight(bytes(pdf)).pdf);
    expect(out.slice(out.lastIndexOf('trailer'))).toBe(
      `trailer\n<<\n  /Size 3\n  /Root 2 0 R\n  /Info 1 0 R\n  /ID [(p8JJ+Q==) (p8JJ+Q==)]\n  /Prev ${prev}\n>>\nstartxref\n${out.lastIndexOf('xref\n2 1')}\n%%EOF`,
    );
  });

  it('US-037 AC-2: the catalog’s generation is kept in the object header and the xref entry', () => {
    const pdf = typstPdf(AC1_CATALOG)
      .replace('2 0 obj', '2 3 obj')
      .replace('0000000075 00000 n', '0000000075 00003 n')
      .replace('/Root 2 0 R', '/Root 2 3 R');
    const out = text(withTwoPageRight(bytes(pdf)).pdf);
    expect(out).toContain('\n\n2 3 obj\n<<\n  /PageLayout /TwoPageRight');
    expect(out).toMatch(/xref\n2 1\n\d{10} 00003 n\r\n/);
    expect(walkXref(bytes(out)).problems).toEqual([]);
  });
});

describe('US-037 AC-3 deterministic', () => {
  it('US-037 AC-3: the same bytes from two fresh loads of the module', async () => {
    const input = bytes(AC1_TYPST);
    vi.resetModules();
    const first = (
      await import('../../src/core/pdf/page-layout')
    ).withTwoPageRight(input);
    vi.resetModules();
    const second = (
      await import('../../src/core/pdf/page-layout')
    ).withTwoPageRight(input);
    expect(text(second.pdf)).toBe(text(first.pdf));
  });
});

describe('US-037 AC-9 other PDF forms', () => {
  const cases: [string, string, SpreadsFailure][] = [
    [
      'no startxref at the end',
      AC1_TYPST.replace('startxref\n178\n%%EOF', ''),
      'no startxref',
    ],
    [
      'startxref pointing at an xref stream',
      AC1_TYPST.replace('startxref\n178', 'startxref\n75'),
      'no xref table',
    ],
    ['no trailer keyword', AC1_TYPST.replace('trailer\n', ''), 'no trailer'],
    [
      'a trailer without /Root',
      AC1_TYPST.replace('  /Root 2 0 R\n', ''),
      'no trailer',
    ],
    [
      'a trailer without /Size',
      AC1_TYPST.replace('  /Size 3\n', ''),
      'no trailer',
    ],
    [
      'an encrypted file',
      AC1_TYPST.replace('  /Size 3\n', '  /Size 3\n  /Encrypt 1 0 R\n'),
      'encrypted',
    ],
    [
      'a file already updated',
      AC1_TYPST + AC1_UPDATE.replace('/PageLayout /TwoPageRight\n  ', ''),
      'already updated',
    ],
    [
      'a /Root that names no object',
      AC1_TYPST.replace('/Root 2 0 R', '/Root 9 0 R'),
      'no catalog',
    ],
    [
      'a catalog that is not a dictionary',
      AC1_TYPST.replace(AC1_CATALOG, '[1 2 3]'),
      'no catalog',
    ],
  ];
  for (const [name, input, reason] of cases) {
    it(`US-037 AC-9: ${name} → "${reason}", the bytes unchanged`, () => {
      const data = bytes(input);
      const result = withTwoPageRight(data);
      expect(result).toEqual({status: 'failed', reason, pdf: data});
      expect(result.pdf).toBe(data);
    });
  }

  it('US-037 AC-9: the warning — code, message with the reason, line 0', () => {
    expect(pageLayoutFailedWarning('no xref table')).toEqual({
      code: 'PDF_PAGE_LAYOUT_FAILED',
      message:
        'The PDF could not be set to open as spreads (no xref table); it is written as compiled',
      line: 0,
    });
  });

  it('US-037 AC-9: the function itself reports nothing (it answers; the export reports, SCAR-038)', () => {
    const result = withTwoPageRight(bytes('%PDF-1.7\n'));
    expect(Object.keys(result).sort()).toEqual(['pdf', 'reason', 'status']);
  });
});

describe('US-037 AC-10 already set', () => {
  for (const value of ['TwoPageRight', 'SinglePage', 'OneColumn']) {
    it(`US-037 AC-10: a catalog with /PageLayout /${value} is kept, nothing appended`, () => {
      const data = bytes(
        typstPdf(AC1_CATALOG.replace('<<', `<<\n  /PageLayout /${value}`)),
      );
      const result = withTwoPageRight(data);
      expect(result).toEqual({status: 'kept', pdf: data});
      expect(result.pdf).toBe(data);
    });
  }

  it('US-037 AC-10: a /PageLayout inside a nested dictionary does not count', () => {
    const nested = AC1_CATALOG.replace(
      '/Direction /L2R',
      '/Direction /L2R\n    /PageLayout /SinglePage',
    );
    expect(withTwoPageRight(bytes(typstPdf(nested))).status).toBe('updated');
  });
});
