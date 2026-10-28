// US-016 AC-1 to AC-6, AC-10, AC-11, AC-17 — callouts in the conversion: which
// blockquotes are callouts (every position, SCAR-009), the Typst of a callout,
// its title, its body, the composed cases (SCAR-002), the unknown type, the
// preamble rule and the fixture that has no callouts. The Typst is compiled in
// tests/integration/us-016-callouts-pdf.test.ts. Source of truth:
// docs/user-stories/US-016-callout-styles.md.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {type ConvertSettings} from '../../src/core/convert';
import {PREAMBLE_RULES} from '../../src/core/convert/preamble';
import {escapeMarkup} from '../../src/core/emit';
import {CALLOUT_HELPER} from '../../src/core/emit/callout';
import {
  parseCalloutHeader,
  type CalloutsSettings,
} from '../../src/core/markers';
import {PLUGIN_NAMES, templateWarnings} from '../../src/core/template';
import {SETTINGS, run} from '../support/convert';
import {readSample} from '../support/sample';

/** Converts `source` with the preset field `callouts` (default: none set). */
const convertWith = (source: string, callouts: CalloutsSettings = {}) => {
  const settings: ConvertSettings = {...SETTINGS, callouts};
  return run(source, {settings});
};

/** The body of the `.typ`: everything after the first blank line. */
async function body(source: string, callouts?: CalloutsSettings) {
  const {typ} = await convertWith(source, callouts);
  const lines = typ.split('\n');
  return lines
    .slice(lines.indexOf('') + 1)
    .join('\n')
    .trimEnd();
}

describe('US-016 AC-1 the header of a callout (every position, SCAR-009)', () => {
  it('US-016 AC-1: reads type (lower case), the type as typed, the fold sign and the title', () => {
    expect(parseCalloutHeader('[!example] Rolling dice')).toEqual({
      type: 'example',
      typed: 'example',
      fold: '',
      title: 'Rolling dice',
    });
    expect(parseCalloutHeader('[!NOTE]')).toEqual({
      type: 'note',
      typed: 'NOTE',
      fold: '',
      title: '',
    });
    expect(parseCalloutHeader('[!tip]- Hidden by default')).toEqual({
      type: 'tip',
      typed: 'tip',
      fold: '-',
      title: 'Hidden by default',
    });
    expect(parseCalloutHeader('[!tip]+')).toEqual({
      type: 'tip',
      typed: 'tip',
      fold: '+',
      title: '',
    });
  });

  it('US-016 AC-1: trims the title and accepts several blanks before it; a title of blanks is no title', () => {
    expect(parseCalloutHeader('[!note]   Two  words  ')?.title).toBe(
      'Two  words',
    );
    expect(parseCalloutHeader('[!note]   ')?.title).toBe('');
    expect(parseCalloutHeader('[!note]\tTab')?.title).toBe('Tab');
  });

  it('US-016 AC-1: is not a header without a blank before the title, with markup before [!, an empty type or a blank in the type', () => {
    for (const line of [
      '[!note]Title',
      '**[!note]** T',
      '[!] T',
      '[!my type] T',
      'text [!note]',
      ' x[!note]',
      '[note] T',
      '[!note',
      '',
    ]) {
      expect(parseCalloutHeader(line), JSON.stringify(line)).toBeNull();
    }
  });

  it('US-016 AC-1: a type may hold any character but ] and blanks (unknown ones are AC-10)', () => {
    expect(parseCalloutHeader('[!my-box_2] T')?.type).toBe('my-box_2');
    expect(parseCalloutHeader('[!Über] T')).toMatchObject({
      type: 'über',
      typed: 'Über',
    });
  });

  it('US-016 AC-1: the header is the first line of the first paragraph of the quote; the next lines start the body', async () => {
    expect(await body('> [!example] Rolling dice\n> Roll 6d6.')).toBe(
      '#callout("example", title: [Rolling dice])[\n  Roll 6d6.\n]',
    );
    expect(await body('>[!NOTE]\n> text')).toBe(
      '#callout("note", title: [Note])[\n  text\n]',
    );
    expect(await body('> \n> [!note] T')).toBe(
      '#callout("note", title: [T])[\n]',
    );
  });

  it('US-016 AC-1: keeps the literal text, escaped as today, where there is no callout', async () => {
    expect(await body('> [!note]Title')).toBe(
      '#quote(block: true)[\n  \\[!note\\]Title\n]',
    );
    expect(await body('> text\n> [!note]')).toBe(
      '#quote(block: true)[\n  text\n  \\[!note\\]\n]',
    );
    expect(await body('[!note] T')).toBe('\\[!note\\] T');
    expect(await body('> [!] T')).toBe('#quote(block: true)[\n  \\[!\\] T\n]');
    expect(await body('> [!my type] T')).toBe(
      '#quote(block: true)[\n  \\[!my type\\] T\n]',
    );
  });

  it('US-016 AC-1: a header after a first paragraph of the quote is text, not a callout', async () => {
    expect(await body('> first\n>\n> [!note] T')).toBe(
      '#quote(block: true)[\n  first\n\n  \\[!note\\] T\n]',
    );
  });
});

describe('US-016 AC-2 the Typst of a callout', () => {
  it('US-016 AC-2: one call of callout with the style name, the title and the body indented by 2', async () => {
    expect(
      await body(
        '> [!example] Rolling dice\n> Rolling 6d6 and getting *two* sixes.',
      ),
    ).toBe(
      [
        '#callout("example", title: [Rolling dice])[',
        '  Rolling 6d6 and getting _two_ sixes.',
        ']',
      ].join('\n'),
    );
  });

  it('US-016 AC-2: a callout with only the header has an empty body', async () => {
    expect(await body('> [!note]')).toBe('#callout("note", title: [Note])[\n]');
  });

  it('US-016 AC-2: is separated from its neighbours by one blank line, and nothing follows ] on its line', async () => {
    expect(await body('Before.\n\n> [!note] N\n> x\n\nAfter.')).toBe(
      'Before.\n\n#callout("note", title: [N])[\n  x\n]\n\nAfter.',
    );
    expect(await body('> [!note] A\n\n> [!tip] B')).toBe(
      '#callout("note", title: [A])[\n]\n\n#callout("tip", title: [B])[\n]',
    );
  });
});

describe('US-016 AC-3 the title', () => {
  it('US-016 AC-3: the header title is inline Markdown through emitInline', async () => {
    expect(await body('> [!tip] Use **bold** and `code`')).toBe(
      '#callout("tip", title: [Use *bold* and `code`])[\n]',
    );
  });

  it('US-016 AC-3: the header title starts as a block: list, heading and special characters are escaped (new call site, SCAR-001)', async () => {
    for (const title of ['- not a list', '# 5 and $3', '+ x', '/ term: x']) {
      const expected = escapeMarkup(title, {atBlockStart: true});
      expect(expected).not.toBe(title);
      expect(await body(`> [!note] ${title}`), title).toBe(
        `#callout("note", title: [${expected}])[\n]`,
      );
    }
    expect(await body('> [!note] # 5 and $3')).toBe(
      '#callout("note", title: [\\# 5 and \\$3])[\n]',
    );
  });

  it('US-016 AC-3: a wikilink and a footnote in the title work as in a paragraph', async () => {
    const link = await body('# Tessera\n\n> [!note] see [[Tessera]]');
    expect(link).toContain('#callout("note", title: [see #link(<h-tessera>)');
    const note = await body('> [!note] x[^1]\n\n[^1]: The note.');
    expect(note).toMatch(/#callout\("note", title: \[x#footnote\[The note\.\]/);
  });

  it('US-016 AC-3: without a header title the style title.text is used, else the type with a capital first letter', async () => {
    expect(await body('> [!quote]')).toBe(
      '#callout("quote", title: [Quote])[\n]',
    );
    expect(await body('> [!EXAMPLE]')).toBe(
      '#callout("example", title: [Example])[\n]',
    );
    expect(
      await body('> [!example]', {example: {title: {text: 'Beispiel'}}}),
    ).toBe('#callout("example", title: [Beispiel])[\n]');
    expect(
      await body('> [!example] Own', {example: {title: {text: 'Beispiel'}}}),
    ).toBe('#callout("example", title: [Own])[\n]');
  });

  it('US-016 AC-3: a default title goes through escapeMarkup (my_box, a*b)', async () => {
    const {typ} = await convertWith('> [!my_box]\n\n> [!a*b]', {
      my_box: {},
    });
    expect(typ).toContain('title: [My\\_box]');
    expect(typ).toContain('title: [A\\*b]');
  });

  it('US-016 AC-3: title.text "" gives title: none', async () => {
    expect(await body('> [!note]\n> x', {note: {title: {text: ''}}})).toBe(
      '#callout("note", title: none)[\n  x\n]',
    );
  });
});

describe('US-016 AC-4 the fold sign', () => {
  it('US-016 AC-4: + and - are ignored, the body is printed, no warning', async () => {
    for (const sign of ['+', '-']) {
      const result = await convertWith(`> [!tip]${sign} T\n> body`);
      expect(result.typ).toContain('#callout("tip", title: [T])[\n  body\n]');
      expect(result.warnings).toEqual([]);
    }
  });
});

describe('US-016 AC-5 the body', () => {
  it('US-016 AC-5: lists and tables inside a callout are emitted as at top level, separated by one blank line', async () => {
    const result = await body(
      '> [!example] Pools\n> - Mind\n> - Body\n>\n> | a | b |\n> |---|---|\n> | 1 | 2 |',
    );
    expect(
      result.startsWith(
        '#callout("example", title: [Pools])[\n  - Mind\n  - Body\n\n  #table(',
      ),
    ).toBe(true);
    expect(result.endsWith('\n]')).toBe(true);
  });

  it('US-016 AC-5: code, task list, image and a second paragraph keep their form', async () => {
    const result = await body(
      [
        '> [!note] N',
        '> first',
        '>',
        '> ```js',
        '> let a = 1;',
        '> ```',
        '>',
        '> - [ ] task',
        '>',
        '> ![Map](assets/map.png)',
        '>',
        '> last',
      ].join('\n'),
    );
    expect(result).toContain('  first\n\n  ```js\n  let a = 1;\n  ```');
    expect(result).toContain(
      '  #figure(fit-image("assets/map.png"), caption: [Map], numbering: none)',
    );
    expect(result).toContain('\n\n  last\n]');
  });
});

describe('US-016 AC-6 composed cases (SCAR-002)', () => {
  it('US-016 AC-6: a callout in a callout is one call per level, indented 2 per level', async () => {
    expect(
      await body('> [!example] Outer\n> a\n>\n> > [!note] Inner\n> > b'),
    ).toBe(
      [
        '#callout("example", title: [Outer])[',
        '  a',
        '',
        '  #callout("note", title: [Inner])[',
        '    b',
        '  ]',
        ']',
      ].join('\n'),
    );
  });

  it('US-016 AC-6: a callout in a list item is indented with the item', async () => {
    expect(await body('- item\n\n  > [!note] N\n  > q')).toBe(
      '- item\n\n  #callout("note", title: [N])[\n    q\n  ]',
    );
  });

  it('US-016 AC-6: a callout in a plain quote, and a plain quote in a callout', async () => {
    expect(await body('> quoted\n>\n> > [!tip] T\n> > x')).toBe(
      [
        '#quote(block: true)[',
        '  quoted',
        '',
        '  #callout("tip", title: [T])[',
        '    x',
        '  ]',
        ']',
      ].join('\n'),
    );
    expect(await body('> [!note] N\n> > plain quote inside')).toBe(
      [
        '#callout("note", title: [N])[',
        '  #quote(block: true)[',
        '    plain quote inside',
        '  ]',
        ']',
      ].join('\n'),
    );
  });

  it('US-016 AC-6: three levels: callout in callout in a list item', async () => {
    expect(
      await body('- item\n\n  > [!example] A\n  > > [!note] B\n  > > c'),
    ).toBe(
      [
        '- item',
        '',
        '  #callout("example", title: [A])[',
        '    #callout("note", title: [B])[',
        '      c',
        '    ]',
        '  ]',
      ].join('\n'),
    );
  });

  it('US-016 AC-6: a heading inside a callout keeps its level and label, and a link from outside reaches it', async () => {
    const result = await body(
      '> [!example] E\n> ## Two pools\n> text\n\nSee [the pools](#two-pools).',
    );
    expect(result).toContain(
      '#callout("example", title: [E])[\n  == Two pools <h-two-pools>\n\n  text\n]',
    );
    expect(result).toContain('#link(<h-two-pools>)[the pools]');
  });

  it('US-016 AC-6: a footnote inside a callout is numbered with the others (one footnote call per reference)', async () => {
    const {typ} = await convertWith(
      'Before[^a].\n\n> [!note] N\n> Inside[^b].\n\nAfter[^c].\n\n[^a]: A.\n[^b]: B.\n[^c]: C.',
    );
    const calls = [...typ.matchAll(/#footnote\[([ABC])\.\]/g)].map((m) => m[1]);
    expect(calls).toEqual(['A', 'B', 'C']);
  });
});

describe('US-016 AC-10 unknown type', () => {
  it('US-016 AC-10: uses default, titled from the header or the type, with one warning per callout at the header line', async () => {
    const result = await convertWith(
      'Intro.\n\n> [!banana] Ripe\n> x\n\n> [!Banana]',
    );
    expect(result.typ).toContain('#callout("default", title: [Ripe])[\n  x\n]');
    expect(result.typ).toContain('#callout("default", title: [Banana])[\n]');
    expect(result.warnings).toEqual([
      {
        code: 'CALLOUT_TYPE_UNKNOWN',
        message: 'No style for callout type "banana"; the default box is used',
        line: 3,
      },
      {
        code: 'CALLOUT_TYPE_UNKNOWN',
        message: 'No style for callout type "Banana"; the default box is used',
        line: 6,
      },
    ]);
  });

  it('US-016 AC-10: a nested unknown callout reports the line of its own header', async () => {
    const result = await convertWith('> [!note] N\n> > [!kiwi] K\n> > x');
    expect(result.warnings.map((w) => [w.code, w.line])).toEqual([
      ['CALLOUT_TYPE_UNKNOWN', 2],
    ]);
  });

  it('US-016 AC-10: a type the preset defines is not unknown', async () => {
    const result = await convertWith('> [!banana] R', {banana: {}});
    expect(result.typ).toContain('#callout("banana", title: [R])[');
    expect(result.warnings).toEqual([]);
  });

  it('US-016 AC-10: the codes are listed as active for US-016 in docs/technical/warning-codes.md', () => {
    const text = readFileSync('docs/technical/warning-codes.md', 'utf8');
    for (const code of [
      'CALLOUT_TYPE_UNKNOWN',
      'CALLOUT_ICON_MISSING',
      'TEMPLATE_NAME_TAKEN',
    ]) {
      const row = text.split('\n').find((l) => l.includes(`\`${code}\``));
      expect(row, code).toMatch(/\| US-016 AC-1[013] \|.*\| active \|$/);
    }
  });
});

describe('US-016 AC-11 the preamble rule callouts', () => {
  it('US-016 AC-11: is registered as callouts with order 85', () => {
    const rule = PREAMBLE_RULES.find((r) => r.id === 'callouts');
    expect(rule?.order).toBe(85);
  });

  it('US-016 AC-11: writes the styles the body uses and the helper, exactly as the worked example', async () => {
    const {typ} = await convertWith('> [!example] E\n> x');
    expect(typ).toContain(
      [
        '#let callout-styles = (',
        '  "example": (fill: rgb("#f2eefd"), stroke: 0.75pt + rgb("#7852ee"), inset: 8pt, title-color: rgb("#7852ee"), font: none, size: none, icon: none),',
        ')',
        CALLOUT_HELPER,
      ].join('\n'),
    );
  });

  it('US-016 AC-11: the helper is the text of the story', () => {
    expect(CALLOUT_HELPER).toBe(
      [
        '#let callout(style, title: none, body) = {',
        '  let s = callout-styles.at(style)',
        '  let txt = (:)',
        '  if s.font != none { txt.insert("font", s.font) }',
        '  if s.size != none { txt.insert("size", s.size) }',
        '  block(width: 100%, breakable: true, fill: s.fill, stroke: s.stroke, inset: s.inset, {',
        '    set text(..txt)',
        '    if title != none {',
        '      block(sticky: true, below: 0.6em, text(fill: s.title-color, weight: "bold", {',
        '        if s.icon != none { box(image(s.icon, height: 1em), baseline: 0.15em); h(0.4em) }',
        '        title',
        '      }))',
        '    }',
        '    body',
        '  })',
        '}',
      ].join('\n'),
    );
  });

  it('US-016 AC-11: lists each used style once, sorted by name; an alias writes its target; unknown types write default', async () => {
    const {typ} = await convertWith(
      '> [!tip] a\n\n> [!faq] b\n\n> [!banana] c\n\n> [!tip] d',
    );
    const keys = [...typ.matchAll(/^ {2}"([a-z0-9_-]+)": \(/gm)].map(
      (m) => m[1],
    );
    expect(keys).toEqual(['default', 'question', 'tip']);
  });

  it('US-016 AC-11: comes after fit-image and before the cover, and is absent without a callout', async () => {
    const withAll = await convertWith('> [!note] N\n\n![Map](assets/map.png)');
    const typ = withAll.typ;
    expect(typ.indexOf('#let fit-image')).toBeGreaterThan(0);
    expect(typ.indexOf('#let callout-styles')).toBeGreaterThan(
      typ.indexOf('#let fit-image'),
    );
    const none = await convertWith('> plain quote\n\nText.');
    expect(none.typ).not.toContain('callout');
  });

  it('US-016 AC-11: numbers without trailing zeros, colours in lower case, fill none and border width 0', async () => {
    const {typ} = await convertWith('> [!example] E', {
      example: {
        fill: 'none',
        border: {color: '#8B5A2B', width: 0},
        inset: 4.5,
        title: {color: '#8B5A2B'},
        font: {size: 9.5},
      },
    });
    expect(typ).toContain(
      '  "example": (fill: none, stroke: none, inset: 4.5pt, title-color: rgb("#8b5a2b"), font: none, size: 9.5pt, icon: none),',
    );
  });

  it('US-016 AC-11: the same note and settings give byte-identical Typst (rule 7)', async () => {
    const source = '> [!tip] a\n\n> [!example] b\n\n> [!banana] c';
    const first = await convertWith(source, {example: {inset: 3}});
    const second = await convertWith(source, {example: {inset: 3}});
    expect(second.typ).toBe(first.typ);
  });
});

describe('US-016 AC-11 names the plugin defines (template)', () => {
  it('US-016 AC-11, US-017 AC-6, US-019 AC-3, US-018 AC-3: PLUGIN_NAMES are fit-image, callout, callout-styles, glossary-term, page-ref, running-text and running-title', () => {
    expect([...PLUGIN_NAMES].sort()).toEqual([
      'callout',
      'callout-styles',
      'fit-image',
      'glossary-term',
      'page-ref',
      'running-text',
      'running-title',
    ]);
  });

  it('US-016 AC-11: a template defining one of them gets TEMPLATE_NAME_TAKEN per definition with its line, in line order', () => {
    const warnings = templateWarnings(
      '#let accent = 1\n#let callout(a) = a\n#let fit-image(p) = p\n#let callout-styles = ()\n',
    );
    expect(warnings).toEqual([
      {
        code: 'TEMPLATE_NAME_TAKEN',
        message:
          'Template line 2 defines "callout", which the plugin also defines; the plugin\'s definition is used',
        line: 0,
      },
      {
        code: 'TEMPLATE_NAME_TAKEN',
        message:
          'Template line 3 defines "fit-image", which the plugin also defines; the plugin\'s definition is used',
        line: 0,
      },
      {
        code: 'TEMPLATE_NAME_TAKEN',
        message:
          'Template line 4 defines "callout-styles", which the plugin also defines; the plugin\'s definition is used',
        line: 0,
      },
    ]);
  });

  it('US-016 AC-11: a template with a built-in name still gets TEMPLATE_SHADOWS_BUILTIN, and both kinds keep line order', () => {
    const codes = templateWarnings(
      '#let quote(b) = b\n#let callout(a) = a\n',
    ).map((w) => w.code);
    expect(codes).toEqual(['TEMPLATE_SHADOWS_BUILTIN', 'TEMPLATE_NAME_TAKEN']);
  });

  it('US-016 AC-11: every #let of the preamble defines a name of PLUGIN_NAMES (text check, SCAR-017)', async () => {
    const {typ} = await convertWith('> [!note] N\n\n![Map](assets/map.png)');
    const preamble = typ.slice(0, typ.indexOf('\n\n'));
    const names = [...preamble.matchAll(/^#let ([A-Za-z_][\w-]*)/gm)].map(
      (m) => m[1],
    );
    expect(names.sort()).toEqual(['callout', 'callout-styles', 'fit-image']);
    for (const name of names) expect(PLUGIN_NAMES).toContain(name);
  });
});

describe('US-016 AC-17 a note without callouts', {timeout: 60_000}, () => {
  const HEADER = /^ *(?:> *)+\[![^\]\s]+\][+-]?(?:\s|$)/m;

  it('US-016 AC-17: the sample note Other.md has no callout header, and its Typst has no callout rule or call', async () => {
    const source = readSample('Other.md');
    expect(source).not.toMatch(HEADER);
    const {typ} = await convertWith(source);
    expect(typ).not.toContain('callout');
  });

  it('US-016 AC-17: the same check sees the callouts of Book.md (the other note has callouts)', async () => {
    const source = readSample('Book.md');
    expect(source).toMatch(HEADER);
    const {typ} = await convertWith(source);
    expect(typ).toContain('#callout(');
  });
});

/** Every .ts file below `dir`. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? sources(path)
      : path.endsWith('.ts')
        ? [path]
        : [];
  });
}

describe('US-016 one place writes callouts (SCAR-017)', () => {
  it('US-016 AC-2, AC-11: only src/core/emit/callout.ts writes the text #callout( or #let callout-styles', () => {
    const writers = sources('src').filter((file) => {
      const text = readFileSync(file, 'utf8');
      return text.includes('#callout(') || text.includes('#let callout-styles');
    });
    expect(writers).toEqual([join('src', 'core', 'emit', 'callout.ts')]);
  });

  it('US-016 AC-1: only src/core/markers recognises the header (no second [! pattern in src)', () => {
    const matchers = sources('src').filter((file) =>
      /\\\[!/.test(readFileSync(file, 'utf8')),
    );
    expect(matchers).toEqual([join('src', 'core', 'markers', 'callout.ts')]);
  });
});
