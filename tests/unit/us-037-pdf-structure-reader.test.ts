// US-037 (SCAR-028) — the test readers of a PDF's file structure
// (`tests/support/pdf-structure.ts`) are checked per syntax rule on known
// inputs before any test relies on them: the xref walk (sections, subsections,
// free entries, `/Prev`, a line end after `%%EOF`, wrong offsets, loops) and
// the catalog in force (the newest trailer's `/Root`, its last definition,
// the top-level keys with nested dictionaries skipped).
// Source of truth: docs/user-stories/US-037-facing-pages-open-as-spreads.md.
import {describe, expect, it} from 'vitest';
import {readPdfCatalog, walkXref} from '../support/pdf-structure';
import {AC1_TYPST, AC1_UPDATE, bytes, typstPdf} from '../support/spreads';

describe('US-037 walkXref', () => {
  it('one section: every in-use entry checked, free entries not', () => {
    const walk = walkXref(bytes(AC1_TYPST));
    expect(walk.problems).toEqual([]);
    expect(walk.checked).toBe(2);
    expect(walk.sections.map((s) => s.at)).toEqual([178]);
    expect(walk.sections[0]?.entries).toEqual([
      {num: 1, gen: 0, offset: 16},
      {num: 2, gen: 0, offset: 75},
    ]);
  });

  it('two sections through /Prev, newest first, a subsection not starting at 0', () => {
    const walk = walkXref(bytes(AC1_TYPST + AC1_UPDATE));
    expect(walk.problems).toEqual([]);
    expect(walk.sections.map((s) => s.at)).toEqual([457, 178]);
    expect(walk.sections[0]?.entries).toEqual([{num: 2, gen: 0, offset: 326}]);
    expect(walk.sections[0]?.trailer).toContain('/Prev 178');
    expect(walk.checked).toBe(3);
  });

  it('several subsections in one section are numbered from their headers', () => {
    const base = AC1_TYPST.replace(
      'xref\n0 3\n0000000000 65535 f\r\n0000000016 00000 n\r\n0000000075 00000 n\r\n',
      'xref\n0 2\n0000000000 65535 f\r\n0000000016 00000 n\r\n2 1\n0000000075 00000 n\r\n',
    );
    const walk = walkXref(bytes(base));
    expect(walk.problems).toEqual([]);
    expect(walk.sections[0]?.entries.map((e) => e.num)).toEqual([1, 2]);
  });

  it('a line end after %%EOF is accepted', () => {
    const walk = walkXref(
      bytes(typstPdf('<<\n  /Type /Catalog\n>>', undefined, '\n')),
    );
    expect(walk.problems).toEqual([]);
    expect(walk.checked).toBe(2);
  });

  it('an entry that does not point at its object is a problem', () => {
    const wrong = AC1_TYPST.replace('0000000075 00000 n', '0000000076 00000 n');
    expect(walkXref(bytes(wrong)).problems).toEqual(['object 2 0 not at 76']);
  });

  it('a startxref that does not point at "xref" is a problem', () => {
    const wrong = AC1_TYPST.replace('startxref\n178', 'startxref\n177');
    expect(walkXref(bytes(wrong)).problems).toEqual([
      'offset 177 is not "xref"',
    ]);
  });

  it('a /Prev loop stops the walk with a problem', () => {
    const looped = AC1_TYPST + AC1_UPDATE.replace('/Prev 178', '/Prev 457');
    expect(walkXref(bytes(looped)).problems).toEqual(['loop at 457']);
  });

  it('no startxref at the end is a problem', () => {
    expect(walkXref(bytes('%PDF-1.7\n')).problems).toEqual(['no startxref']);
  });
});

describe('US-037 readPdfCatalog', () => {
  it('Typst’s file: the catalog object 2, its keys, no /PageLayout', () => {
    const catalog = readPdfCatalog(bytes(AC1_TYPST));
    expect(catalog.object).toBe(2);
    expect(catalog.keys).toEqual(['Type', 'Pages', 'ViewerPreferences']);
    expect(catalog.pageLayout).toBeNull();
  });

  it('after an update: the newest revision, although the older one comes first in the file', () => {
    const catalog = readPdfCatalog(bytes(AC1_TYPST + AC1_UPDATE));
    expect(catalog.keys).toEqual([
      'PageLayout',
      'Type',
      'Pages',
      'ViewerPreferences',
    ]);
    expect(catalog.pageLayout).toBe('TwoPageRight');
  });

  it('the newest trailer’s /Root, also when it names another object', () => {
    const base = AC1_TYPST;
    const at = base.length + 1;
    const moved =
      `\n3 0 obj\n<<\n  /Type /Catalog\n  /Pages 1 0 R\n  /PageLayout /SinglePage\n>>\nendobj\n` +
      `xref\n3 1\n${String(at).padStart(10, '0')} 00000 n\r\n`;
    const x = base.length + moved.indexOf('xref');
    const pdf = `${base}${moved}trailer\n<<\n  /Size 4\n  /Root 3 0 R\n  /Prev 178\n>>\nstartxref\n${x}\n%%EOF`;
    expect(walkXref(bytes(pdf)).problems).toEqual([]);
    const catalog = readPdfCatalog(bytes(pdf));
    expect(catalog.object).toBe(3);
    expect(catalog.pageLayout).toBe('SinglePage');
  });

  it('top-level keys of a catalog as Typst writes it (nested dictionaries, a string, references, an array)', () => {
    // The catalog of a compiled book (spike 2026-11-09), shortened names.
    const catalog =
      '<<\n  /Type /Catalog\n  /Pages 1 0 R\n  /Metadata 146 0 R\n  /PageLabels 22 0 R\n' +
      '  /Lang (en)\n  /StructTreeRoot 23 0 R\n  /MarkInfo <<\n    /Marked true\n    /Suspects false\n  >>\n' +
      '  /ViewerPreferences <<\n    /Direction /L2R\n  >>\n  /Outlines 2 0 R\n' +
      '  /Names <<\n    /Dests <<\n      /Names [(h-a) 106 0 R (h-b) 109 0 R]\n    >>\n  >>\n>>';
    expect(readPdfCatalog(bytes(typstPdf(catalog))).keys).toEqual([
      'Type',
      'Pages',
      'Metadata',
      'PageLabels',
      'Lang',
      'StructTreeRoot',
      'MarkInfo',
      'ViewerPreferences',
      'Outlines',
      'Names',
    ]);
  });
});
