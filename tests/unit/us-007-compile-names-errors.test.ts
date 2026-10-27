// US-007 — the pure parts of in-plugin compilation: the names of the exported
// files (AC-1b) and the text of a compile error (AC-4). Source of truth:
// docs/user-stories/US-007-in-plugin-typst-compilation.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {exportNames, formatCompileError} from '../../src/core/compile';

describe('US-007 AC-1: the names of the exported files', () => {
  it('US-007 AC-1: a note Rules is exported as Rules.typ and Rules.pdf next to template.typ', () => {
    expect(exportNames('Rules')).toEqual({
      base: 'Rules',
      typ: 'Rules.typ',
      pdf: 'Rules.pdf',
      template: 'template.typ',
    });
  });

  it('US-007 AC-1: dots, blanks and non-ASCII letters of the note name are kept', () => {
    expect(exportNames('my.note v2').typ).toBe('my.note v2.typ');
    expect(exportNames('Größe').pdf).toBe('Größe.pdf');
    expect(exportNames('template.typ').typ).toBe('template.typ.typ');
  });
});

describe('US-007 AC-1b: a note called template never replaces the template copy', () => {
  const table: [string, string][] = [
    ['Rules', 'Rules'],
    ['template', 'template-note'],
    ['Template', 'template-note'],
    ['TEMPLATE', 'template-note'],
    ['tEmPlAtE', 'template-note'],
    ['template-note', 'template-note'],
    ['Template-Note', 'Template-Note'],
    ['templates', 'templates'],
    ['my template', 'my template'],
    ['template ', 'template '],
  ];
  for (const [note, base] of table) {
    it(`US-007 AC-1b: the note ${JSON.stringify(note)} is exported as ${base}.typ and ${base}.pdf`, () => {
      const names = exportNames(note);
      expect(names.base).toBe(base);
      expect(names.typ).toBe(`${base}.typ`);
      expect(names.pdf).toBe(`${base}.pdf`);
      expect(names.template).toBe('template.typ');
    });
  }

  it('US-007 AC-1b: invariant, the three names are pairwise different ignoring case for every spelling of template and for natural names that look generated', () => {
    const spellings: string[] = [];
    // Every upper/lower-case spelling of "template".
    for (let mask = 0; mask < 1 << 8; mask++) {
      spellings.push(
        [...'template']
          .map((ch, i) => (mask & (1 << i) ? ch.toUpperCase() : ch))
          .join(''),
      );
    }
    spellings.push(
      'template-note',
      'Template-note',
      'template-note-note',
      'template.typ',
      'template.pdf',
      'a',
      'Rules',
      '',
    );
    for (const note of spellings) {
      const {typ, pdf, template} = exportNames(note);
      const keys = [typ, pdf, template].map((name) => name.toLowerCase());
      expect(new Set(keys).size, note).toBe(3);
    }
  });

  it('US-007 AC-1b: the template copy is called template.typ for every note name', () => {
    for (const note of ['Rules', 'template', 'Template', 'template-note']) {
      expect(exportNames(note).template).toBe('template.typ');
    }
  });
});

describe('US-007 AC-4: the text of a compile error', () => {
  it('US-007 AC-4: /e.typ:1:9: error: expected expression becomes Typst error at e.typ:1:9: expected expression', () => {
    expect(formatCompileError('/e.typ:1:9: error: expected expression')).toBe(
      'Typst error at e.typ:1:9: expected expression',
    );
  });

  it('US-007 AC-4: the example of the story, unknown variable foo at test.typ:41:8', () => {
    expect(
      formatCompileError('/test.typ:41:8: error: unknown variable: foo'),
    ).toBe('Typst error at test.typ:41:8: unknown variable: foo');
  });

  it('US-007 AC-4: an error in another file shows that file, also below a folder', () => {
    expect(formatCompileError('/template.typ:3:1: error: oops')).toBe(
      'Typst error at template.typ:3:1: oops',
    );
    expect(formatCompileError('/assets/part.typ:2:4: error: oops')).toBe(
      'Typst error at assets/part.typ:2:4: oops',
    );
  });

  it('US-007 AC-4: only the leading slash of the path is removed', () => {
    expect(formatCompileError('a.typ:5:6: error: x')).toBe(
      'Typst error at a.typ:5:6: x',
    );
    expect(formatCompileError('//a.typ:5:6: error: x')).toBe(
      'Typst error at /a.typ:5:6: x',
    );
  });

  it('US-007 AC-4: a message with colons, quotes and brackets is kept whole', () => {
    expect(
      formatCompileError('/a.typ:1:2: error: expected: ")", found: [x]'),
    ).toBe('Typst error at a.typ:1:2: expected: ")", found: [x]');
  });

  it('US-007 AC-4: a file name with colons and digits is read from the last two numbers', () => {
    expect(formatCompileError('/Note 12:30.typ:7:3: error: bad')).toBe(
      'Typst error at Note 12:30.typ:7:3: bad',
    );
  });

  it('US-007 AC-4: with several lines the first error is shown, warnings and hints are skipped', () => {
    const raw = [
      '/a.typ:1:1: warning: unused',
      '/a.typ:4:2: error: first problem',
      '  help: try this',
      '/a.typ:9:9: error: second problem',
    ].join('\n');
    expect(formatCompileError(raw)).toBe(
      'Typst error at a.typ:4:2: first problem',
    );
  });

  it('US-007 AC-4: Windows line ends and surrounding blanks do not matter', () => {
    expect(
      formatCompileError('  \r\n/a.typ:4:2: error: first problem\r\n  '),
    ).toBe('Typst error at a.typ:4:2: first problem');
  });

  it('US-007 AC-4: a message of another form is shown as Typst error: text, first line only', () => {
    expect(formatCompileError('something broke')).toBe(
      'Typst error: something broke',
    );
    expect(formatCompileError('line one\nline two')).toBe(
      'Typst error: line one',
    );
    expect(formatCompileError('/a.typ:1:1: warning: only a warning')).toBe(
      'Typst error: /a.typ:1:1: warning: only a warning',
    );
  });

  it('US-007 AC-4: an empty message is shown as Typst error: unknown error', () => {
    expect(formatCompileError('')).toBe('Typst error: unknown error');
    expect(formatCompileError('  \n ')).toBe('Typst error: unknown error');
  });

  it('US-007 AC-4: line and column must be whole numbers, otherwise the generic form is used', () => {
    expect(formatCompileError('/a.typ:x:2: error: bad')).toBe(
      'Typst error: /a.typ:x:2: error: bad',
    );
    expect(formatCompileError('/a.typ:1:: error: bad')).toBe(
      'Typst error: /a.typ:1:: error: bad',
    );
  });
});

describe('US-007 AC-11: core/compile stays pure', () => {
  it('US-007 AC-11: core/compile imports no Obsidian, Node or I/O module', () => {
    const text = readFileSync('src/core/compile/index.ts', 'utf8');
    const imports = [...text.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)];
    for (const [, module] of imports) {
      expect(module, String(module)).toMatch(/^\.\.?\//);
    }
    expect(text).not.toMatch(/\brequire\(|\bprocess\.|\bBuffer\b|\bfetch\(/);
  });
});
