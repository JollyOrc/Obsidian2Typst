// US-004 — links, wikilinks, anchors (unit, pure core). Source of truth:
// docs/user-stories/US-004-links-and-references.md. Exact string comparison,
// real parser (US-014), real emitter. The output is proven against the compiler
// in tests/integration/us-004-links-roundtrip.test.ts.
import {describe, expect, it} from 'vitest';
import {EmitContext, emitBlocks, emitInline} from '../../src/core/emit';
import {
  classifyHref,
  indexHeadings,
  visibleText,
  isNoteEmbed,
  parse,
  resolveHeading,
  unescapeAddress,
  wikilinkTarget,
  type HeadingIndex,
} from '../../src/core/parse';
import {blocks, typ} from '../support/blocks';
import {index} from '../support/headings';
import {readManifest, readSample} from '../support/sample';
import {all} from '../support/tree';

const w = (code: string, message: string, line: number) => ({
  code,
  message,
  line,
});
const unresolved = (what: string, line = 1) =>
  w('LINK_UNRESOLVED', `No heading matches "${what}"`, line);
const ambiguous = (what: string, n: number, line: number) =>
  w(
    'LINK_AMBIGUOUS',
    `"${what}" matches ${n} headings; the first is used`,
    line,
  );
const none: never[] = [];

/** `md` after the headings of `heads`, without the headings' own Typst. */
function after(heads: string, md: string) {
  const result = blocks(`${heads}\n\n${md}`);
  const lines = heads.split('\n').length + 1;
  const parts = result.typ.split('\n\n');
  const own = heads.split(/\n\n/).length;
  return {typ: parts.slice(own).join('\n\n'), warnings: result.warnings, lines};
}
const U = (url: string) => `"${url}"`;
const fn = (url: string) => `#footnote[#link(${U(url)})]`;

describe('US-004 AC-1 external links with a footnote', () => {
  it('US-004 AC-1: converts [Site](https://example.org/a?b=1) to #link(...)[Site]#footnote[#link(...)]', () => {
    expect(blocks('[Site](https://example.org/a?b=1)')).toEqual({
      typ: `#link(${U('https://example.org/a?b=1')})[Site]${fn('https://example.org/a?b=1')}`,
      warnings: none,
    });
  });

  it('US-004 AC-1: separates a call from a following . ( [ or ; by a semicolon', () => {
    const f = fn('https://example.org');
    const base = `#link(${U('https://example.org')})[Site]${f}`;
    expect(typ('[Site](https://example.org).')).toBe(`${base};.`);
    expect(typ('[Site](https://example.org)(a)')).toBe(`${base};(a)`);
    expect(typ('[Site](https://example.org);')).toBe(`${base};;`);
    expect(typ('[Site](https://example.org),')).toBe(`${base},`);
    expect(typ('[Site](https://example.org) x')).toBe(`${base} x`);
  });

  it('US-004 AC-1: escapes quotes and backslashes of the address as a Typst string', () => {
    expect(typ('[x](https://a.org/a"b)')).toContain(
      '#link("https://a.org/a\\"b")[x]',
    );
  });
});

describe('US-004 AC-1b no footnote when the text is the address', () => {
  it('US-004 AC-1b: emits no footnote for <https://example.org> and for a bare URL', () => {
    expect(typ('<https://example.org>')).toBe('#link("https://example.org")');
    expect(typ('https://example.org')).toBe('#link("https://example.org")');
  });

  it('US-004 AC-1b: emits no footnote when the text equals the address after removing mailto: (colophon e-mail link)', () => {
    expect(typ('<a@b.de>')).toBe('#link("mailto:a@b.de")');
    expect(typ('[a@b.de](mailto:a@b.de)')).toBe('#link("mailto:a@b.de")');
    expect(
      typ(
        '[<u><span>raiders@orkpiraten.de</span></u>](mailto:raiders@orkpiraten.de)',
      ),
    ).toBe(
      '#link("mailto:raiders@orkpiraten.de")[#underline[raiders\\@orkpiraten.de]]',
    );
  });

  it('US-004 AC-1b: emits a footnote with the address without mailto: when the text differs', () => {
    expect(typ('[Write us](mailto:a@b.de)')).toBe(
      `#link("mailto:a@b.de")[Write us]${fn('mailto:a@b.de')}`,
    );
  });

  it('US-004 AC-1b: ends a bare address before trailing punctuation and unbalanced ) or ]', () => {
    expect(typ('see https://example.org/a_b.')).toBe(
      'see #link("https://example.org/a_b");.',
    );
    expect(typ('(https://example.org)')).toBe('(#link("https://example.org"))');
    expect(typ('[https://example.org/X-Card]')).toBe(
      '\\[#link("https://example.org/X-Card")\\]',
    );
  });
});

describe('US-004 AC-1c switch', () => {
  it('US-004 AC-1c: omits the footnotes when externalLinkFootnotes is false and keeps the links clickable', () => {
    const off = {externalLinkFootnotes: false};
    expect(blocks('[Site](https://example.org)', off)).toEqual({
      typ: '#link("https://example.org")[Site]',
      warnings: none,
    });
    expect(blocks('[x](tel:+4930)', off).typ).toBe('#link("tel:+4930")[x]');
  });

  it('US-004 AC-1c: has the footnotes on by default', () => {
    expect(blocks('[x](https://a.org)').typ).toContain('#footnote[');
    expect(
      blocks('[x](https://a.org)', {externalLinkFootnotes: true}).typ,
    ).toContain('#footnote[');
  });
});

describe('US-004 AC-1d backslash escapes in bare addresses', () => {
  it('US-004 AC-1d: removes a backslash before punctuation in a bare address (Ancient\\_tooling)', () => {
    expect(typ('https://en.wikipedia.org/wiki/Ancient\\_tooling')).toBe(
      '#link("https://en.wikipedia.org/wiki/Ancient_tooling")',
    );
  });

  it('US-004 AC-1d: unescapes only ASCII punctuation and keeps other backslashes', () => {
    expect(unescapeAddress('a\\_b\\.c\\\\d\\x')).toBe('a_b.c\\d\\x');
  });

  it('US-004 AC-1d: leaves addresses inside [x](...) and <...> untouched', () => {
    const node = all(parse('[x](https://a.org/b\\_c)').root).find(
      (n) => n.kind === 'link',
    );
    const href = node?.kind === 'link' ? node.href : '';
    expect(typ('[x](https://a.org/b\\_c)')).toBe(
      `#link(${U(href)})[x]${fn(href)}`,
    );
  });
});

describe('US-004 AC-1e when the link has no body', () => {
  it('US-004 AC-1e: writes a link whose plain text is its address without body', () => {
    expect(typ('[https://example.org](https://example.org)')).toBe(
      '#link("https://example.org")',
    );
  });

  it('US-004 AC-1e: keeps the body when the text is formatted', () => {
    expect(typ('[**https://example.org**](https://example.org)')).toBe(
      '#link("https://example.org")[*https:\\/\\/example.org*]',
    );
  });

  it('US-004 AC-1e: gives an autolink no footnote even when its text shows the prefix', () => {
    expect(typ('<mailto:a@b.de>')).toBe(
      '#link("mailto:a@b.de")[mailto:a\\@b.de]',
    );
  });

  it('US-004 AC-1e: writes an empty text as a link without body and without footnote', () => {
    expect(blocks('[](https://example.org)')).toEqual({
      typ: '#link("https://example.org")',
      warnings: none,
    });
  });
});

describe('US-004 AC-1f every scheme is external', () => {
  it('US-004 AC-1f: treats tel: and other schemes like https:', () => {
    expect(typ('[Call us](tel:+4930123)')).toBe(
      `#link("tel:+4930123")[Call us]${fn('tel:+4930123')}`,
    );
    expect(typ('[x](obsidian://open?vault=a)')).toBe(
      `#link("obsidian://open?vault=a")[x]${fn('obsidian://open?vault=a')}`,
    );
  });

  it('US-004 AC-1f: a single letter is no scheme: c:/x.pdf is a local file', () => {
    expect(classifyHref('c:/x.pdf')).toEqual({kind: 'file', path: 'c:/x.pdf'});
    expect(classifyHref('ab:x')).toEqual({kind: 'external'});
  });
});

describe('US-004 AC-2 wikilinks', () => {
  const H = '# Tessera';
  it('US-004 AC-2: resolves [[Tessera]] to #link(<h-tessera>)[Tessera]', () => {
    expect(after(H, '[[Tessera]]')).toMatchObject({
      typ: '#link(<h-tessera>)[Tessera]',
      warnings: none,
    });
  });

  it('US-004 AC-2: resolves [[Tessera|fighting]] to #link(<h-tessera>)[fighting]', () => {
    expect(after(H, '[[Tessera|fighting]]').typ).toBe(
      '#link(<h-tessera>)[fighting]',
    );
  });

  it('US-004 AC-2: resolves [[#Tessera]] and [[Rules#Tessera]] to the heading Tessera', () => {
    expect(after(H, '[[#Tessera]]').typ).toBe('#link(<h-tessera>)[Tessera]');
    expect(after(H, '[[Rules#Tessera]]').typ).toBe(
      '#link(<h-tessera>)[Tessera]',
    );
    expect(after(H, '[[A#B#Tessera]]').typ).toBe('#link(<h-tessera>)[Tessera]');
  });

  it('US-004 AC-2: matches heading text case-insensitively; first match wins; several matches report LINK_AMBIGUOUS', () => {
    expect(after(H, '[[tessera]]').typ).toBe('#link(<h-tessera>)[tessera]');
    const result = blocks('# Intro\n\n# Intro\n\n[[Intro]]');
    expect(result.typ.endsWith('#link(<h-intro>)[Intro]')).toBe(true);
    expect(result.warnings).toEqual([ambiguous('[[Intro]]', 2, 5)]);
  });

  it('US-004 AC-2: finds a heading that comes later in the document', () => {
    expect(blocks('[[Later]]\n\n# Later').typ).toBe(
      '#link(<h-later>)[Later]\n\n= Later <h-later>',
    );
  });

  it('US-004 AC-2: reads the target of a wikilink after the last #; a block reference has none', () => {
    const target = (md: string) => {
      const n = all(parse(md).root).find((x) => x.kind === 'wikilink');
      return n?.kind === 'wikilink' ? wikilinkTarget(n) : undefined;
    };
    expect(target('[[Tessera]]')).toBe('Tessera');
    expect(target('[[Rules#Tessera]]')).toBe('Tessera');
    expect(target('[[A#B#C]]')).toBe('C');
    expect(target('[[#Tessera]]')).toBe('Tessera');
    expect(target('[[Note#^abc]]')).toBeNull();
  });
});

describe('US-004 AC-3 Markdown links to files', () => {
  it('US-004 AC-3: resolves [x](../../Texts/01%20Reader%20Section/1.3.2%20Prism.md#Prism%20Variants) by anchor text', () => {
    expect(
      after(
        '# Prism Variants',
        '[x](../../Texts/01%20Reader%20Section/1.3.2%20Prism.md#Prism%20Variants)',
      ),
    ).toMatchObject({typ: '#link(<h-prism-variants>)[x]', warnings: none});
  });

  it('US-004 AC-3: resolves a link to a .md file without anchor to the heading named like the file', () => {
    expect(after('# Prism', '[x](Prism.md)').typ).toBe('#link(<h-prism>)[x]');
    expect(after('# Prism', '[x](Texts/1.3.2%20Prism.md)').typ).toBe(
      '#link(<h-prism>)[x]',
    );
  });

  it('US-004 AC-3: keeps an invalid percent sequence as written', () => {
    expect(classifyHref('Texts/100%.md')).toEqual({
      kind: 'note',
      target: '100%',
    });
  });
});

describe('US-004 AC-4 unresolved targets', () => {
  it('US-004 AC-4: emits plain escaped text and LINK_UNRESOLVED for [[Nowhere]]', () => {
    expect(blocks('[[Nowhere]]')).toEqual({
      typ: 'Nowhere',
      warnings: [unresolved('[[Nowhere]]')],
    });
  });

  it('US-004 AC-4: keeps the formatting of the link text', () => {
    expect(blocks('[**Tessera**](#nowhere)')).toEqual({
      typ: '*Tessera*',
      warnings: [unresolved('#nowhere')],
    });
  });

  it('US-004 AC-4: treats a block reference as unresolved and writes its text', () => {
    expect(blocks('[[Note#^abc]]')).toEqual({
      typ: '^abc',
      warnings: [unresolved('[[Note#^abc]]')],
    });
  });

  it('US-004 AC-4: shows the heading text when a resolved link has no text of its own', () => {
    expect(after('# A', '[](#a)').typ).toBe('#link(<h-a>)[A]');
  });

  it('US-004 AC-4: reports a link without target and keeps its text', () => {
    expect(blocks('[x]()')).toEqual({
      typ: 'x',
      warnings: [w('LINK_UNRESOLVED', 'Link without target', 1)],
    });
  });

  it('US-004 AC-4: names the wikilink as written (alias and anchor)', () => {
    expect(blocks('[[Nowhere#Part|a]]').warnings).toEqual([
      unresolved('[[Nowhere#Part|a]]'),
    ]);
  });
});

describe('US-004 AC-5 composed', () => {
  it("US-004 AC-5: uses plain text for the label of '## See [[Tessera]]' (h-see-tessera) and keeps the link in the heading text", () => {
    expect(blocks('# Tessera\n\n## See [[Tessera]]')).toEqual({
      typ: '= Tessera <h-tessera>\n\n== See #link(<h-tessera>)[Tessera] <h-see-tessera>',
      warnings: none,
    });
    expect(index('# Tessera\n\n## See [[Tessera]]').list[1]?.label).toBe(
      'h-see-tessera',
    );
  });

  it('US-004 AC-5: keeps a link inside a list item and a quote', () => {
    expect(blocks('# A\n\n- [[A]]\n\n> [x](#a)').typ).toBe(
      '= A <h-a>\n\n- #link(<h-a>)[A]\n\n#quote(block: true)[\n  #link(<h-a>)[x]\n]',
    );
  });

  it('US-004 AC-5: keeps a link inside a table cell', () => {
    expect(blocks('# A\n\n| x |\n|---|\n| [[A]] |\n| [y](#a) |').typ).toContain(
      '  [#link(<h-a>)[A]],\n  [#link(<h-a>)[y]],\n)',
    );
  });
});

describe('US-004 AC-6 composed: heading and footnote text', () => {
  it('US-004 AC-6: emits no footnote for an external link inside a heading and reports LINK_URL_NOT_SPELLED', () => {
    expect(blocks('## Visit [Site](https://example.org)')).toEqual({
      typ: '== Visit #link("https://example.org")[Site] <h-visit-site>',
      warnings: [
        w(
          'LINK_URL_NOT_SPELLED',
          'Address of "https://example.org" is not spelled out in a heading',
          1,
        ),
      ],
    });
  });

  it('US-004 AC-6: warns only where a footnote would have been written', () => {
    expect(
      blocks('## Visit [Site](https://example.org)', {
        externalLinkFootnotes: false,
      }).warnings,
    ).toEqual(none);
    expect(blocks('## <https://example.org>').warnings).toEqual(none);
  });

  it('US-004 AC-6: writes the address in parentheses, without a footnote, for an external link inside footnote text', () => {
    const headings: HeadingIndex = indexHeadings([]);
    const ctx = new EmitContext();
    const nodes = parse('See [Site](https://example.org).').root[0];
    const out = emitInline(
      nodes && 'children' in nodes ? (nodes.children as never) : [],
      ctx,
      {where: 'footnote', links: {headings, externalLinkFootnotes: true}},
    );
    expect(out).toBe(
      'See #link("https://example.org")[Site] (#link("https://example.org")).',
    );
    expect(ctx.finish()).toEqual(none);
  });

  it('US-004 AC-6: adds nothing inside footnote text when the switch is off or the text is the address', () => {
    const run = (md: string, on: boolean) => {
      const ctx = new EmitContext();
      const p = parse(md).root[0];
      return emitInline(
        p && 'children' in p ? (p.children as never) : [],
        ctx,
        {
          where: 'footnote',
          links: {headings: indexHeadings([]), externalLinkFootnotes: on},
        },
      );
    };
    expect(run('[Site](https://example.org)', false)).toBe(
      '#link("https://example.org")[Site]',
    );
    expect(run('<https://example.org>', true)).toBe(
      '#link("https://example.org")',
    );
  });
});

describe('US-004 AC-7 embeds of notes', () => {
  it('US-004 AC-7: does not expand ![[Other Note]]: emits the text and reports EMBED_NOTE_UNEXPANDED', () => {
    expect(blocks('![[Other Note]]')).toEqual({
      typ: 'Other Note',
      warnings: [
        w(
          'EMBED_NOTE_UNEXPANDED',
          'Note embed "![[Other Note]]" is not expanded',
          1,
        ),
      ],
    });
    expect(blocks('![[Other#Part|x]]').typ).toBe('Other\\#Part');
  });

  it('US-004 AC-7: tells a note from an asset by its name', () => {
    for (const note of ['Other Note', 'Version 1.2', 'a.md', 'A.MD']) {
      expect(isNoteEmbed(note), note).toBe(true);
    }
    for (const asset of ['pic.png', 'a b.pdf', 'x.svg', 'map.JPEG']) {
      expect(isNoteEmbed(asset), asset).toBe(false);
    }
  });

  it('US-004 AC-7: leaves an asset embed to US-003 (text kept, NODE_UNSUPPORTED)', () => {
    expect(blocks('![[pic.png]]').warnings).toEqual([
      w('NODE_UNSUPPORTED', 'No emitter for embed; its text is kept', 1),
    ]);
  });
});

describe('US-004 AC-8 anchors', () => {
  const HEADS = '## Prism Variants\n\n## Prism';
  it('US-004 AC-8: resolves #Prism%20Variants by decoded heading text', () => {
    expect(after(HEADS, '[x](#Prism%20Variants)')).toMatchObject({
      typ: '#link(<h-prism-variants>)[x]',
      warnings: none,
    });
  });

  it('US-004 AC-8: resolves #prism-variants by slug', () => {
    expect(after(HEADS, '[x](#prism-variants)').typ).toBe(
      '#link(<h-prism-variants>)[x]',
    );
  });

  it('US-004 AC-8: resolves #prism by stripping the leading number of 1.3.2 Prism', () => {
    expect(after(HEADS, '[x](#1.3.2-prism)').typ).toBe('#link(<h-prism>)[x]');
    expect(after(HEADS, '[x](#4-prism)').typ).toBe('#link(<h-prism>)[x]');
  });

  it('US-004 AC-8: uses the first match and reports LINK_AMBIGUOUS with the candidate count', () => {
    const result = blocks('## A\n\n## A\n\n## A\n\n[x](#a)');
    expect(result.typ.endsWith('#link(<h-a>)[x]')).toBe(true);
    expect(result.warnings).toEqual([ambiguous('#a', 3, 7)]);
  });

  it('US-004 AC-8: emits plain text and LINK_UNRESOLVED for an unknown anchor', () => {
    expect(after(HEADS, '[x](#nowhere)')).toMatchObject({
      typ: 'x',
      warnings: [unresolved('#nowhere', 5)],
    });
  });

  it('US-004 AC-8: prefers text over slug over number-stripped, and does not strip a number when an earlier rule matches', () => {
    const idx = index('## 2024 Plan\n\n## Plan');
    expect(resolveHeading('2024 plan', idx)?.rule).toBe(1);
    expect(resolveHeading('2024-plan', idx)?.rule).toBe(2);
    expect(resolveHeading('3-plan', idx)?.rule).toBe(3);
    expect(resolveHeading('3-plan', idx)?.matches.map((m) => m.label)).toEqual([
      'h-plan',
    ]);
    expect(resolveHeading('nowhere', idx)).toBeNull();
  });

  it('US-004 AC-8: classifies every kind of address', () => {
    expect(classifyHref('')).toEqual({kind: 'empty'});
    expect(classifyHref('#A%20b')).toEqual({kind: 'anchor', target: 'A b'});
    expect(classifyHref('#100%')).toEqual({kind: 'anchor', target: '100%'});
    expect(classifyHref('https://x.org')).toEqual({kind: 'external'});
    expect(classifyHref('mailto:a@b.de')).toEqual({kind: 'external'});
    expect(classifyHref('a/B%20c.md#D%20e')).toEqual({
      kind: 'note',
      target: 'D e',
    });
    expect(classifyHref('a/B%20c.MD')).toEqual({kind: 'note', target: 'B c'});
    expect(classifyHref('assets/a%20b.pdf')).toEqual({
      kind: 'file',
      path: 'assets/a b.pdf',
    });
  });

  it('US-004 AC-8: sample note regression: the anchors by rule, ambiguous and unresolved as the manifest counts them', () => {
    const {anchors: want} = readManifest();
    const tree = parse(readSample('Book.md'));
    const idx = indexHeadings(tree.root);
    const anchors = all(tree.root).flatMap((n) =>
      n.kind === 'link' && n.href.startsWith('#') ? [n.href] : [],
    );
    expect(anchors).toHaveLength(
      want.byText + want.bySlug + want.byNumberStripped + want.unresolved,
    );
    const count = {1: 0, 2: 0, 3: 0, none: 0, ambiguous: 0};
    const missing = new Set<string>();
    for (const href of anchors) {
      const c = classifyHref(href);
      const r = c.kind === 'anchor' ? resolveHeading(c.target, idx) : null;
      if (r === null) {
        count.none += 1;
        missing.add(href);
      } else {
        count[r.rule] += 1;
        if (r.matches.length > 1) count.ambiguous += 1;
      }
    }
    expect(count).toEqual({
      1: want.byText,
      2: want.bySlug,
      3: want.byNumberStripped,
      none: want.unresolved,
      ambiguous: want.ambiguous,
    });
    // Every unresolved target holds a word that no heading has (read from
    // the parsed headings, not from the resolver).
    const headingWords = new Set(
      all(tree.root).flatMap((n) =>
        n.kind === 'heading'
          ? visibleText(n.children).toLowerCase().split(/\s+/)
          : [],
      ),
    );
    expect(missing.size).toBeGreaterThan(0);
    for (const href of missing) {
      const words = href
        .slice(1)
        .toLowerCase()
        .split(/[-.\d]+/)
        .filter(Boolean);
      expect(
        words.some((w) => !headingWords.has(w)),
        href,
      ).toBe(true);
    }
  });

  it('US-004 AC-8: sample note: the emitter reports the unresolved and ambiguous links of the manifest', () => {
    const {anchors: want} = readManifest();
    const {warnings} = blocks(readSample('Book.md'));
    const count = (code: string) =>
      warnings.filter((x) => x.code === code).length;
    // Unresolved: the anchors plus the wikilinks [[Other]] and [[Missing]].
    expect(count('LINK_UNRESOLVED')).toBe(want.unresolved + 2);
    expect(count('LINK_AMBIGUOUS')).toBe(want.ambiguous);
    expect(count('LINK_URL_NOT_SPELLED')).toBe(0);
  });
});

describe('US-004 AC-9 links to local files', () => {
  it('US-004 AC-9: emits text plus a footnote with the decoded path for a link to a local file', () => {
    expect(
      blocks(
        '[Download and print out the character sheet here](assets/roa_charactersheet_hex_skillmap.pdf)',
      ),
    ).toEqual({
      typ: 'Download and print out the character sheet here#footnote[assets/roa\\_charactersheet\\_hex\\_skillmap.pdf]',
      warnings: none,
    });
    expect(typ('[x](a%20b.pdf)')).toBe('x#footnote[a b.pdf]');
  });

  it('US-004 AC-9: emits only the text when externalLinkFootnotes is false', () => {
    expect(blocks('[x](assets/a.pdf)', {externalLinkFootnotes: false})).toEqual(
      {typ: 'x', warnings: none},
    );
  });

  it('US-004 AC-9: emits no footnote inside a heading and writes the path in parentheses inside footnote text', () => {
    expect(blocks('## See [x](a.pdf)')).toEqual({
      typ: '== See x <h-see-x>',
      warnings: none,
    });
    const ctx = new EmitContext();
    const p = parse('[x](assets/a_b.pdf)').root[0];
    expect(
      emitInline(p && 'children' in p ? (p.children as never) : [], ctx, {
        where: 'footnote',
        links: {headings: indexHeadings([]), externalLinkFootnotes: true},
      }),
    ).toBe('x (assets/a\\_b.pdf)');
  });

  it('US-004 AC-9: keeps the formatting of the text of a local file link', () => {
    expect(typ('[**x**](a.pdf)')).toBe('*x*#footnote[a.pdf]');
  });
});

describe('US-004 purity', () => {
  it('US-004 AC-2: gives the same output for the same input and does not change the tree', () => {
    const md = '# A\n\n[[A]] [x](#a) [y](https://a.org) [z](f.pdf)';
    const tree = parse(md).root;
    const before = JSON.stringify(tree);
    const run = () => {
      const ctx = new EmitContext();
      return [emitBlocks(tree, ctx), JSON.stringify(ctx.finish())].join('|');
    };
    expect(run()).toBe(run());
    expect(JSON.stringify(tree)).toBe(before);
  });
});
