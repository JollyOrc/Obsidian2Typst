// US-013 AC-9 and AC-6: escaped text compiles and reads back unchanged
// (integration, bundled compiler, offline). Source of truth:
// docs/user-stories/US-013-typst-safe-output.md. A failure is a compile error
// or a different text, so there is no silent difference.
import {describe, expect, it} from 'vitest';
import {
  escapeMarkup,
  rawBlock,
  rawInline,
  callSeparator,
  typstString,
  wrapEmphasis,
} from '../../src/core/emit';
import {plainText} from '../support/typst-node';

const start = {atBlockStart: true};
const inline = {atBlockStart: false};

/** What Typst reads from `text`: a newline in a paragraph reads as a space. */
const read = (text: string) => text.replaceAll('\n', ' ');

const PRINTABLE = Array.from({length: 94}, (_, i) =>
  String.fromCharCode(0x21 + i),
);

describe('US-013 round trip against the compiler', () => {
  it('US-013 AC-9: every printable ASCII character c reads back unchanged as "c", "x c y", at line start and after a space at line start', async () => {
    const failures: string[] = [];
    for (const c of PRINTABLE) {
      const cases: [string, boolean][] = [
        [c, true],
        [`x ${c} y`, false],
        [`${c} y`, true],
        [` ${c}`, true],
        [`${c}\n${c} y`, true],
      ];
      for (const [text, atBlockStart] of cases) {
        const markup = escapeMarkup(text, {atBlockStart});
        let actual: string;
        try {
          actual = await plainText(markup);
        } catch (e) {
          failures.push(
            `${JSON.stringify(text)} -> ${JSON.stringify(markup)}: ${String(e).slice(0, 80)}`,
          );
          continue;
        }
        if (actual !== read(text)) {
          failures.push(
            `${JSON.stringify(text)} -> ${JSON.stringify(markup)} reads ${JSON.stringify(actual)}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  }, 120_000);

  it('US-013 AC-9: the AC-1 to AC-3 examples read back as their input text', async () => {
    const examples = [
      'Price: $5 for item #3 @ home, see <here> and [there] ~ ok',
      'snake_case, 2*3, a\\b, `x`',
      '{a} (b): 5% & a^b | "q" \'r\' café ☃ 😀',
      'see http://x.org/a_b and a/b and /* c */',
      '= 5 apples',
      '== x',
      '- x',
      '+ x',
      '/ x',
      '12. one',
      '  = x',
      'a\n= b\n- c',
      '=5 ==x = - + 12. 1.5 x 1) x a = b',
    ];
    for (const text of examples) {
      const actual = await plainText(escapeMarkup(text, start));
      expect(actual.trim(), JSON.stringify(text)).toBe(read(text).trim());
    }
  }, 60_000);

  it('US-013 AC-9: hostile strings read back unchanged: \\n, \\\\, // at line end, "=", "- ", "1. ", 5000 special characters', async () => {
    const hostile = [
      '\\n',
      '\\\\',
      'a //\nb',
      'a //',
      '=',
      '- ',
      '1. ',
      '$#@<>[]~*_`\\/'.repeat(385),
    ];
    for (const text of hostile) {
      const actual = await plainText(escapeMarkup(text, start));
      expect(actual.trim(), JSON.stringify(text.slice(0, 30))).toBe(
        read(text).trim(),
      );
    }
  }, 60_000);

  it('US-013 AC-9: -- reads back as an en dash, --- as an em dash and ... as an ellipsis', async () => {
    expect(await plainText(escapeMarkup('a -- b --- c ... d', start))).toBe(
      'a – b — c … d',
    );
  });

  it('US-013 AC-9: rawInline and rawBlock output reads back as the original code, including c++ and backtick runs', async () => {
    const inlineCodes = ['a b', 'a`b', ' a ', 'a``b', '```', 'a $ # * _ // b'];
    for (const code of inlineCodes) {
      expect(await plainText(rawInline(code)), JSON.stringify(code)).toBe(code);
    }
    const blocks: [string, string][] = [
      ['let a = `x`;', 'js'],
      ['a ```b``` c', ''],
      ['x `````y', ''],
      ['int x;\nint y;', 'c++'],
      ['a\nb', 'c#'],
      ['x $ # * _ // y', 'objective-c'],
      ['abc`', ''],
    ];
    for (const [code, lang] of blocks) {
      expect(
        await plainText(rawBlock(code, lang)),
        JSON.stringify([code, lang]),
      ).toBe(code);
    }
  }, 60_000);

  it('US-013 AC-6: each call-site shape (highlight, underline, footnote, caption, link label, quote, list item, table cell) reads back as plain text with no heading or list element', async () => {
    const body = escapeMarkup('= x', start);
    const shapes: [string, string][] = [
      [`#highlight[${body}]`, '<highlight>= x</>'],
      [`#underline[${body}]`, '<underline>= x</>'],
      [`a#footnote[${body}]`, 'a<footnote>= x</>'],
      [`#link("https://a.org")[${body}]`, '<link "https://a.org">= x</link>'],
      [`#quote(block: true)[${body}]`, '<quote>= x</>'],
      [`- ${body}`, '<item>= x</>'],
      [`#table(columns: 1, [${body}])`, '<cell>= x</>'],
      [
        `#figure(rect(), caption: [${body}], numbering: none)`,
        '<figure><rect></>',
      ],
    ];
    for (const [markup, expected] of shapes) {
      expect(await plainText(markup), markup).toBe(expected);
    }
    // The caption text itself, read through the caption field:
    expect(
      await plainText(
        `#figure(rect(), caption: [${body}], numbering: none).caption.body`,
      ),
    ).toBe('= x');
  }, 60_000);

  it('US-013 AC-6: text inside *…* and _…_ and after a heading marker reads back as plain text', async () => {
    expect(await plainText(`*${escapeMarkup('= x', inline)}*`)).toBe(
      '<strong>= x</>',
    );
    expect(await plainText(`_${escapeMarkup('- x', inline)}_`)).toBe(
      '<emph>- x</>',
    );
    expect(await plainText(`= ${escapeMarkup('1. x', inline)}`)).toBe(
      '<heading>1. x</>',
    );
  });

  it('US-013 AC-7: typstString output evaluates back to the original value in the compiler', async () => {
    const values = [
      'a"b.png',
      'C:\\x\\y.png',
      'Cover Draft.png',
      'line1\nline2\tx',
      '\u0001\r\u007f',
      'é☃😀\u00a0',
      '#a5d6a7',
      '"\\"\\\\"',
    ];
    for (const value of values) {
      expect(
        await plainText(`#${typstString(value)}`),
        JSON.stringify(value),
      ).toBe(value);
    }
  });
});

describe('US-013 AC-12 emphasis against the compiler', () => {
  /** Builds `before` + emphasis + `after` the way the emitter will. */
  const build = (
    kind: 'strong' | 'emph',
    inner: string,
    before: string,
    after: string,
    endsWithAddress = false,
  ) =>
    before +
    wrapEmphasis(kind, inner, {
      prev: before.slice(-2),
      next: after.slice(0, 2),
      endsWithAddress,
    }) +
    after;

  const MARKS = [
    ['strong', 'strong'],
    ['emph', 'emph'],
  ] as const;

  it('US-013 AC-12: every neighbour pair compiles and reads back as the intended emphasis', async () => {
    const neighbours = [
      ['', ''],
      [' ', ' '],
      ['(', ')'],
      ['', ','],
      ['"', '"'],
      ['a', 'c'],
      ['a', ''],
      ['', 'c'],
      ['5', '5'],
      ['—', '—'],
      ['“', '”'],
      ['日', '語'],
      ['é', ' '],
      ['😀', '😀'],
    ] as const;
    for (const [kind, element] of MARKS) {
      for (const [before, after] of neighbours) {
        const markup = build(kind, 'b', before, after);
        const actual = await plainText(markup);
        expect(actual, JSON.stringify(markup)).toBe(
          `${before}<${element}>b</>${after}`,
        );
      }
    }
  });

  it('US-013 AC-12: the delimiter form fails or loses the emphasis exactly where the rule uses the function form (guards the rule)', async () => {
    // One-sided word neighbour: a compile error, so the rule must not use it.
    await expect(plainText('*b*c')).rejects.toThrow(/unclosed delimiter/);
    await expect(plainText('a_b_')).rejects.toThrow(/unclosed delimiter/);
    // Two-sided word neighbour: literal text, the emphasis is silently lost.
    expect(await plainText('a*b*c')).toBe('a*b*c');
    expect(await plainText('a_b_c')).toBe('a_b_c');
    // The function form is right in all of them.
    expect(await plainText('a#strong[b]c')).toBe('a<strong>b</>c');
    expect(await plainText('#emph[b]c')).toBe('<emph>b</>c');
  });

  it('US-013 AC-12: emphasis ending in an address compiles because the function form is used', async () => {
    await expect(plainText('*see https://x.org*')).rejects.toThrow(
      /unclosed delimiter/,
    );
    const inner = `see ${escapeMarkup('https://x.org', inline)}`;
    const markup = build('strong', inner, '', '', true);
    expect(markup).toBe('#strong[see https:\\/\\/x.org]');
    expect(await plainText(markup)).toBe('<strong>see https://x.org</>');
    const link = build('emph', '#link("https://x.org")', ' ', ' ', true);
    expect(await plainText(link)).toBe(
      ' <emph><link "https://x.org">https://x.org</link></> ',
    );
  });

  it('US-013 AC-12: nested emphasis with escaped text reads back as nested elements', async () => {
    const inner = wrapEmphasis('emph', escapeMarkup('a_b', inline), {
      prev: '',
      next: '',
      endsWithAddress: false,
    });
    const outer = build('strong', `x ${inner} y`, ' ', ' ');
    expect(outer).toBe(' *x _a\\_b_ y* ');
    expect(await plainText(outer)).toBe(' <strong>x <emph>a_b</> y</> ');
    const glued = build('strong', inner, 'k', 'm');
    expect(await plainText(glued)).toBe('k<strong><emph>a_b</></>m');
  });

  it('US-013 AC-12: emphasis at line start and line end inside a paragraph and a list item', async () => {
    const a = build('strong', 'x', '', ' text');
    const b = build('emph', 'y', 'text ', '');
    expect(await plainText(`${a}\n${b}`)).toBe(
      '<strong>x</> text text <emph>y</>',
    );
    expect(await plainText(`- ${build('strong', 'x', '', 'y')}`)).toBe(
      '<item><strong>x</>y</>',
    );
  });

  it('US-013 AC-12: a Unicode set of neighbours never fails to compile', async () => {
    const chars = [
      '日',
      '本',
      'é',
      'ß',
      'Ж',
      'ا',
      '5',
      '٣',
      '—',
      '…',
      '“',
      '😀',
      '\u0301',
      '・',
      'ー',
    ];
    for (const before of chars) {
      for (const after of chars) {
        for (const [kind] of MARKS) {
          const markup = build(kind, 'b', before, after);
          await plainText(markup); // throws on a compile error
        }
      }
    }
  });
});

describe('US-013 AC-12b strong next to a slash against the compiler', () => {
  it('US-013 AC-12b: the delimiter form fails exactly where the rule uses the function form (guards the rule)', async () => {
    await expect(plainText('a/*b*')).rejects.toThrow(/unclosed delimiter/);
    await expect(plainText('*b*/c')).rejects.toThrow(/unclosed delimiter/);
    // emph is not affected, which is why the rule is for strong only
    expect(await plainText('a/_b_')).toBe('a/<emph>b</>');
    expect(await plainText('_b_/c')).toBe('<emph>b</>/c');
    // two strong marks side by side are two strong elements, no rule needed
    expect(await plainText('*a**b*')).toBe('<strong>a</><strong>b</>');
  });

  it('US-013 AC-12b: strong with a slash neighbour or a slash at the edge of its content compiles and reads back', async () => {
    const cases: [string, string, string, string][] = [
      ['a/', 'b', ' ', 'a/<strong>b</> '],
      [' ', 'b', '/c', ' <strong>b</>/c'],
      [' ', '/x', ' ', ' <strong>/x</> '],
      [' ', 'x/', ' ', ' <strong>x/</> '],
      ['/', 'b', '/', '/<strong>b</>/'],
    ];
    for (const [before, inner, after, expected] of cases) {
      const markup =
        before +
        wrapEmphasis('strong', inner, {
          prev: before,
          next: after,
          endsWithAddress: false,
        }) +
        after;
      expect(await plainText(markup), JSON.stringify(markup)).toBe(expected);
    }
  });
});

describe('US-013 AC-13 text after an embedded call against the compiler', () => {
  /** [markup of the call, what Typst reads from it alone] */
  const CALLS: [string, string][] = [
    ['#strike[a]', '<strike>a</>'],
    ['#highlight[a]', '<highlight>a</>'],
    ['#underline[a]', '<underline>a</>'],
    ['#strong[a]', '<strong>a</>'],
    ['#emph[a]', '<emph>a</>'],
    ['#raw("a")', 'a'],
    ['#link("https://x.org")[a]', '<link "https://x.org">a</link>'],
    ['#footnote[a]', '<footnote>a</>'],
    ['#line(length: 100%)', '<line>'],
    ['#linebreak()', '\n'],
  ];
  const FOLLOWERS = ['.b', '(x)', ';', '[x]', ', x', '/', ' x', '; y', '.5'];

  it('US-013 AC-13: without the separator the four binding followers fail or lose the text (guards the rule)', async () => {
    await expect(plainText('#strike[a].b')).rejects.toThrow(
      /does not have field/,
    );
    await expect(plainText('#strike[a](x)')).rejects.toThrow(
      /unknown variable/,
    );
    await expect(plainText('#strike[a][x]')).rejects.toThrow(
      /unexpected argument/,
    );
    // a semicolon right after a call is consumed and disappears from the text
    expect(await plainText('#strike[a];b')).toBe('<strike>a</>b');
  });

  it('US-013 AC-13: every call form followed by every follower compiles and reads back the follower unchanged', async () => {
    for (const [call, callRead] of CALLS) {
      for (const follower of FOLLOWERS) {
        const markup = call + callSeparator(follower) + follower;
        expect(await plainText(markup), JSON.stringify(markup)).toBe(
          callRead + follower,
        );
      }
    }
  });

  it('US-013 AC-13: a follower that is escaped text (as the emitter passes it) reads back too', async () => {
    for (const [call, callRead] of CALLS) {
      for (const text of ['[x]', '(x)', '.b', ';x']) {
        const follower = escapeMarkup(text, inline);
        const markup = call + callSeparator(follower) + follower;
        expect(await plainText(markup), JSON.stringify(markup)).toBe(
          callRead + text,
        );
      }
    }
  });
});
