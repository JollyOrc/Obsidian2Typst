// US-013 — Typst-safe output: escapeMarkup, typstString, rawInline/rawBlock
// (unit, pure core). Source of truth: docs/user-stories/US-013-typst-safe-output.md
// and docs/technical/typst-escaping-findings.md (measured with the compiler).
// Exact string comparison. The rules are proven against the compiler in
// tests/integration/us-013-escape-roundtrip.test.ts.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {
  CALL_TRANSFORMS,
  EMPHASIS_TRANSFORMS,
  MARKUP_TRANSFORMS,
  RAW_TRANSFORMS,
  STRING_TRANSFORMS,
  callSeparator,
  escapeMarkup,
  rawBlock,
  rawInline,
  typstString,
  wrapEmphasis,
} from '../../src/core/emit';

const start = {atBlockStart: true};
const inline = {atBlockStart: false};

/** Ids listed in the register row of `functionName` in the story README. */
function registerIds(functionName: string): string[] {
  const readme = readFileSync('docs/user-stories/README.md', 'utf8');
  const row = readme
    .split('\n')
    .find((l) => l.startsWith(`| \`${functionName}\``));
  if (row === undefined) throw new Error(`no register row for ${functionName}`);
  return [...row.matchAll(/`([a-z-]+)`/g)].map((m) => m[1] as string);
}

describe('US-013 escapeMarkup', () => {
  it('US-013 AC-1: escapes $ # @ < > [ ] ~ in "Price: $5 for item #3 @ home, see <here> and [there] ~ ok"', () => {
    expect(
      escapeMarkup(
        'Price: $5 for item #3 @ home, see <here> and [there] ~ ok',
        start,
      ),
    ).toBe(
      'Price: \\$5 for item \\#3 \\@ home, see \\<here\\> and \\[there\\] \\~ ok',
    );
  });

  it('US-013 AC-1: escapes backslash, asterisk, underscore (also inside words) and backtick: "snake_case, 2*3, a\\b, `x`"', () => {
    expect(escapeMarkup('snake_case, 2*3, a\\b, `x`', start)).toBe(
      'snake\\_case, 2\\*3, a\\\\b, \\`x\\`',
    );
  });

  it('US-013 AC-1: leaves { } ( ) : % & ^ | quotes and non-ASCII (café ☃ 😀) unchanged', () => {
    const text = '{a} (b): 5% & a^b | "q" \'r\' café ☃ 😀';
    expect(escapeMarkup(text, start)).toBe(text);
  });

  it('US-013 AC-2: turns // into \\/\\/ and keeps a single /: "see http://x.org/a_b and a/b and /* c */"', () => {
    expect(
      escapeMarkup('see http://x.org/a_b and a/b and /* c */', start),
    ).toBe('see http:\\/\\/x.org/a\\_b and a/b and /\\* c \\*/');
  });

  it('US-013 AC-3: escapes = and == followed by a blank at the start of the text', () => {
    expect(escapeMarkup('= 5 apples', start)).toBe('\\= 5 apples');
    expect(escapeMarkup('== x', start)).toBe('\\== x');
    expect(escapeMarkup('=\tx', start)).toBe('\\=\tx');
  });

  it('US-013 AC-3: escapes a leading "- ", "+ ", "/ " and "12. " (as 12\\. )', () => {
    expect(escapeMarkup('- x', start)).toBe('\\- x');
    expect(escapeMarkup('+ x', start)).toBe('\\+ x');
    expect(escapeMarkup('/ x', start)).toBe('\\/ x');
    expect(escapeMarkup('12. one', start)).toBe('12\\. one');
  });

  it('US-013 AC-3: keeps leading spaces and escapes after them: "  = x"', () => {
    expect(escapeMarkup('  = x', start)).toBe('  \\= x');
    expect(escapeMarkup('\t- x', start)).toBe('\t\\- x');
  });

  it('US-013 AC-3: escapes the marker after every newline inside the text: "a\\n= b\\n- c"', () => {
    expect(escapeMarkup('a\n= b\n- c', start)).toBe('a\n\\= b\n\\- c');
    expect(escapeMarkup('a\n1. b', inline)).toBe('a\n1\\. b');
  });

  it('US-013 AC-3: escapes a marker that ends its line: = - + / 12. alone, and "-\n- y"', () => {
    expect(escapeMarkup('=', start)).toBe('\\=');
    expect(escapeMarkup('-', start)).toBe('\\-');
    expect(escapeMarkup('+', start)).toBe('\\+');
    expect(escapeMarkup('/', start)).toBe('\\/');
    expect(escapeMarkup('12.', start)).toBe('12\\.');
    expect(escapeMarkup('-\n- y', start)).toBe('\\-\n\\- y');
  });

  it('US-013 AC-3: does not escape =5, ==x, "1.5 x", "1) x", "a = b"', () => {
    for (const text of ['=5', '==x', '1.5 x', '1) x', 'a = b']) {
      expect(escapeMarkup(text, start), text).toBe(text);
    }
  });

  it('US-013 AC-4: with atBlockStart false the first line stays "= x" but the line after a newline is escaped', () => {
    expect(escapeMarkup('= x\n= y', inline)).toBe('= x\n\\= y');
  });

  it('US-013 AC-4: with atBlockStart true both lines are escaped: "\\= x\\n\\= y"', () => {
    expect(escapeMarkup('= x\n= y', start)).toBe('\\= x\n\\= y');
  });

  it('US-013 AC-5: keeps -- --- ... straight quotes and NBSP unchanged and turns -? into \\-?', () => {
    expect(
      escapeMarkup('wait -- what --- really... "x" a-?b\u00a0c', start),
    ).toBe('wait -- what --- really... "x" a\\-?b\u00a0c');
  });

  it('US-013 AC-6: first text of #highlight[…], #underline[…], a footnote, a caption, a link label and a quote is escaped at block start', () => {
    const body = escapeMarkup('= x', start);
    expect(`#highlight[${body}]`).toBe('#highlight[\\= x]');
    expect(`#underline[${body}]`).toBe('#underline[\\= x]');
    expect(`#footnote[${body}]`).toBe('#footnote[\\= x]');
    expect(`caption: [${body}]`).toBe('caption: [\\= x]');
    expect(`#link("https://a.org")[${body}]`).toBe(
      '#link("https://a.org")[\\= x]',
    );
    expect(`#quote(block: true)[${body}]`).toBe('#quote(block: true)[\\= x]');
  });

  it('US-013 AC-6: first text of a list item and a table cell is escaped at block start', () => {
    expect(`- ${escapeMarkup('= x', start)}`).toBe('- \\= x');
    expect(
      `[${escapeMarkup('- a', start)}], [${escapeMarkup('+ b', start)}]`,
    ).toBe('[\\- a], [\\+ b]');
  });

  it('US-013 AC-6: text inside *…* or _…_ and text after a heading marker is not escaped as a line start', () => {
    expect(`*${escapeMarkup('= x', inline)}*`).toBe('*= x*');
    expect(`_${escapeMarkup('- x', inline)}_`).toBe('_- x_');
    expect(`= ${escapeMarkup('1. x', inline)}`).toBe('= 1. x');
  });

  it('US-013 AC-10: returns the same output for the same input (determinism)', () => {
    const text = 'a $ b\n= c // d';
    expect(escapeMarkup(text, start)).toBe(escapeMarkup(text, start));
  });

  it('US-013 AC-10: lists every transform id of MARKUP_TRANSFORMS in the shared-utility register of docs/user-stories/README.md', () => {
    const ids = MARKUP_TRANSFORMS.map((t) => t.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(registerIds('escapeMarkup')).toEqual(expect.arrayContaining(ids));
  });
});

describe('US-013 scope', () => {
  it('US-013 AC-11: escapeMarkup leaves | unchanged (Markdown table escaping belongs to the report writer, US-006)', () => {
    expect(escapeMarkup('a | b', start)).toBe('a | b');
  });
});

describe('US-013 typstString', () => {
  it('US-013 AC-7: quotes a plain value: Cover Draft.png', () => {
    expect(typstString('Cover Draft.png')).toBe('"Cover Draft.png"');
  });

  it('US-013 AC-7: escapes " as \\" : a"b.png', () => {
    expect(typstString('a"b.png')).toBe('"a\\"b.png"');
  });

  it('US-013 AC-7: escapes backslash as \\\\ : C:\\x\\y.png', () => {
    expect(typstString('C:\\x\\y.png')).toBe('"C:\\\\x\\\\y.png"');
  });

  it('US-013 AC-7: escapes newline as \\n and tab as \\t', () => {
    expect(typstString('line1\nline2\tx')).toBe('"line1\\nline2\\tx"');
  });

  it('US-013 AC-7: escapes other control characters as \\u{hex}', () => {
    expect(typstString('\u0001\r\u007f')).toBe('"\\u{1}\\u{d}\\u{7f}"');
    expect(typstString('é☃😀\u00a0')).toBe('"é☃😀\u00a0"');
  });

  it('US-013 AC-10: lists every transform id of STRING_TRANSFORMS in the shared-utility register', () => {
    const ids = STRING_TRANSFORMS.map((t) => t.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(registerIds('typstString')).toEqual(expect.arrayContaining(ids));
  });
});

describe('US-013 raw code', () => {
  it('US-013 AC-8: rawInline writes content without a backtick as `a b`', () => {
    expect(rawInline('a b')).toBe('`a b`');
    expect(rawInline(' a ')).toBe('` a `');
  });

  it('US-013 AC-8: rawInline writes content with a backtick as #raw("a`b")', () => {
    expect(rawInline('a`b')).toBe('#raw("a`b")');
    expect(rawInline('')).toBe('#raw("")');
  });

  it('US-013 AC-8: rawInline writes content with a newline as #raw("…") with an escaped newline', () => {
    expect(rawInline('a\nb')).toBe('#raw("a\\nb")');
  });

  it('US-013 AC-8: rawBlock keeps content and language tag: ```js with `x` inside', () => {
    expect(rawBlock('let a = `x`;', 'js')).toBe('```js\nlet a = `x`;\n```');
  });

  it('US-013 AC-8: rawBlock uses a four-backtick fence for content containing ```', () => {
    expect(rawBlock('a ```b``` c', '')).toBe('````\na ```b``` c\n````');
  });

  it('US-013 AC-8: rawBlock uses a longer fence than the longest backtick run (5 backticks inside gives 6)', () => {
    expect(rawBlock('x `````y', '')).toBe('``````\nx `````y\n``````');
  });

  it('US-013 AC-8: rawBlock writes a tag such as c++ or c# in the #raw(block: true, lang: …) form', () => {
    expect(rawBlock('int x;', 'c++')).toBe(
      '#raw(block: true, lang: "c++", "int x;")',
    );
    expect(rawBlock('a\nb', 'c#')).toBe(
      '#raw(block: true, lang: "c#", "a\\nb")',
    );
    expect(rawBlock('x', 'objective-c')).toBe('```objective-c\nx\n```');
  });

  it('US-013 AC-8: rawBlock accepts an empty language tag', () => {
    expect(rawBlock('abc', '')).toBe('```\nabc\n```');
  });

  it('US-013 AC-10: lists every transform id of RAW_TRANSFORMS in the shared-utility register', () => {
    const ids = RAW_TRANSFORMS.map((t) => t.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(registerIds('rawInline')).toEqual(expect.arrayContaining(ids));
  });
});

describe('US-013 AC-12 emphasis wrappers', () => {
  const free = {prev: ' ', next: ' ', endsWithAddress: false};

  it('US-013 AC-12: returns the delimiter form when no letter or digit touches the marks', () => {
    expect(wrapEmphasis('strong', 'b', free)).toBe('*b*');
    expect(wrapEmphasis('emph', 'b', free)).toBe('_b_');
    // punctuation, boundaries, em dash, curly quotes and an emoji are fine
    for (const [prev, next] of [
      ['(', ')'],
      ['', ''],
      ['', ','],
      ['.', ''],
      ['—', '—'],
      ['“', '”'],
      ['😀', '\n'],
    ] as const) {
      const ctx = {prev, next, endsWithAddress: false};
      expect(wrapEmphasis('strong', 'b', ctx), `${prev}|${next}`).toBe('*b*');
      expect(wrapEmphasis('emph', 'b', ctx), `${prev}|${next}`).toBe('_b_');
    }
  });

  it('US-013 AC-12: returns #strong/#emph next to a letter or digit on either side', () => {
    const word = (prev: string, next: string) => ({
      prev,
      next,
      endsWithAddress: false,
    });
    expect(wrapEmphasis('strong', 'b', word('a', 'c'))).toBe('#strong[b]');
    expect(wrapEmphasis('emph', 'b', word('a', 'c'))).toBe('#emph[b]');
    expect(wrapEmphasis('strong', 'b', word('', 's'))).toBe('#strong[b]');
    expect(wrapEmphasis('emph', 'b', word('', 's'))).toBe('#emph[b]');
    expect(wrapEmphasis('emph', 'b', word('x', ''))).toBe('#emph[b]');
    expect(wrapEmphasis('strong', 'b', word('5', ' '))).toBe('#strong[b]');
    expect(wrapEmphasis('strong', 'b', word(' ', '5'))).toBe('#strong[b]');
    // non-ASCII letters and combining marks count as letters
    expect(wrapEmphasis('strong', 'b', word('é', ' '))).toBe('#strong[b]');
    expect(wrapEmphasis('emph', 'b', word(' ', 'ß'))).toBe('#emph[b]');
    expect(wrapEmphasis('emph', 'b', word('日', ' '))).toBe('#emph[b]');
    expect(wrapEmphasis('emph', 'b', word('\u0301', ' '))).toBe('#emph[b]');
  });

  it('US-013 AC-12: uses the last character of prev and the first of next when longer strings are given', () => {
    const ctx = (prev: string, next: string) => ({
      prev,
      next,
      endsWithAddress: false,
    });
    expect(wrapEmphasis('strong', 'b', ctx('abc ', ' abc'))).toBe('*b*');
    expect(wrapEmphasis('strong', 'b', ctx(' abc', ' '))).toBe('#strong[b]');
    expect(wrapEmphasis('strong', 'b', ctx(' ', 'a b'))).toBe('#strong[b]');
    // a character outside the BMP is one character, not two surrogates
    expect(wrapEmphasis('strong', 'b', ctx('😀', '😀'))).toBe('*b*');
  });

  it('US-013 AC-12: returns the function form when the content ends in an address, whatever the neighbours are', () => {
    const url = {prev: ' ', next: ' ', endsWithAddress: true};
    expect(wrapEmphasis('strong', 'see https:\\/\\/x.org', url)).toBe(
      '#strong[see https:\\/\\/x.org]',
    );
    expect(wrapEmphasis('emph', '#link("https://x.org")', url)).toBe(
      '#emph[#link("https://x.org")]',
    );
    expect(wrapEmphasis('emph', 'x', {...url, prev: '', next: ''})).toBe(
      '#emph[x]',
    );
  });

  it('US-013 AC-12: never changes the inner text (it is already escaped Typst)', () => {
    expect(wrapEmphasis('strong', '\\*a\\_ \\$', free)).toBe('*\\*a\\_ \\$*');
    expect(wrapEmphasis('emph', '\\*a\\_ \\$', {...free, prev: 'x'})).toBe(
      '#emph[\\*a\\_ \\$]',
    );
    expect(wrapEmphasis('strong', '', free)).toBe('**');
  });

  it('US-013 AC-12: nests by composing calls, deciding per mark', () => {
    const inner = wrapEmphasis('emph', 'a', {
      prev: '',
      next: '',
      endsWithAddress: false,
    });
    expect(inner).toBe('_a_');
    expect(wrapEmphasis('strong', inner, free)).toBe('*_a_*');
    expect(wrapEmphasis('strong', inner, {...free, prev: 'x'})).toBe(
      '#strong[_a_]',
    );
  });

  it('US-013 AC-12: is pure and deterministic', () => {
    const ctx = {prev: 'a', next: 'c', endsWithAddress: false};
    expect(wrapEmphasis('strong', 'b', ctx)).toBe(
      wrapEmphasis('strong', 'b', ctx),
    );
    expect(ctx).toEqual({prev: 'a', next: 'c', endsWithAddress: false});
  });

  it('US-013 AC-10: lists every transform id of EMPHASIS_TRANSFORMS in the shared-utility register', () => {
    const ids = EMPHASIS_TRANSFORMS.map((t) => t.id);
    expect(ids).toEqual(['emphasis-delimiter', 'emphasis-function']);
    expect(registerIds('wrapEmphasis')).toEqual(expect.arrayContaining(ids));
  });
});

describe('US-013 AC-12b strong next to a slash', () => {
  const free = {prev: ' ', next: ' ', endsWithAddress: false};

  it('US-013 AC-12b: uses #strong when prev ends with a slash, next starts with one, or inner starts or ends with one', () => {
    expect(wrapEmphasis('strong', 'b', {...free, prev: 'a/'})).toBe(
      '#strong[b]',
    );
    expect(wrapEmphasis('strong', 'b', {...free, next: '/c'})).toBe(
      '#strong[b]',
    );
    expect(wrapEmphasis('strong', '/x', free)).toBe('#strong[/x]');
    expect(wrapEmphasis('strong', 'x/', free)).toBe('#strong[x/]');
    // an escaped double slash ends in a slash and also takes the function form
    expect(wrapEmphasis('strong', 'a\\/\\/', free)).toBe('#strong[a\\/\\/]');
  });

  it('US-013 AC-12b: leaves emph and a slash in the middle of the content unchanged', () => {
    expect(wrapEmphasis('emph', 'b', {...free, prev: 'a/'})).toBe('_b_');
    expect(wrapEmphasis('emph', '/x/', free)).toBe('_/x/_');
    expect(wrapEmphasis('strong', 'a/b', free)).toBe('*a/b*');
    // a slash two characters away does not count: only the last of prev matters
    expect(wrapEmphasis('strong', 'b', {...free, prev: '/a '})).toBe('*b*');
  });
});

describe('US-013 AC-13 callSeparator', () => {
  it('US-013 AC-13: returns ; when the next text starts with . ( [ or ;', () => {
    for (const next of ['.b', '(x)', '[x]', '; b', '.', '.5', '. b']) {
      expect(callSeparator(next), next).toBe(';');
    }
  });

  it('US-013 AC-13: returns the empty string for every other first character', () => {
    for (const next of [
      '',
      ' b',
      ', b',
      'b',
      '5',
      '*x*',
      '_x_',
      '\\[x',
      '#x',
      '\n',
      '\t',
      '日',
      '😀',
      ')',
      ']',
      ':',
      '/',
    ]) {
      expect(callSeparator(next), JSON.stringify(next)).toBe('');
    }
  });

  it('US-013 AC-13: only looks at the first character, as a character not a code unit', () => {
    expect(callSeparator(' .b')).toBe('');
    expect(callSeparator('😀.')).toBe('');
  });

  it('US-013 AC-13: is pure and deterministic', () => {
    expect(callSeparator('.b')).toBe(callSeparator('.b'));
  });

  it('US-013 AC-10: lists every transform id of CALL_TRANSFORMS in the shared-utility register', () => {
    const ids = CALL_TRANSFORMS.map((t) => t.id);
    expect(ids).toEqual(['call-separator']);
    expect(registerIds('callSeparator')).toEqual(expect.arrayContaining(ids));
  });
});
