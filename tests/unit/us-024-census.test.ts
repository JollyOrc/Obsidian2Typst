// US-024 AC-2, AC-2b, AC-3 — the generated note covers the real file's census
// and the features the real file lacks; the manifest agrees with the note.
// Source of truth: docs/user-stories/US-024-synthetic-public-fixture.md.
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parse, visibleText} from '../../src/core/parse';
import {FakeIndex, SETTINGS, run} from '../support/convert';
import {REAL} from '../support/real-census';
import {
  SAMPLE_DIR,
  VAULT,
  census,
  listFiles,
  readManifest,
  readSample,
  type Counts,
} from '../support/sample';

const BOOK = (): string => readSample('Book.md');
const FILES = (): string[] => listFiles(SAMPLE_DIR).map((f) => `${VAULT}/${f}`);

/** US-024 AC-2: every key of `want` with at least its count in `have`. */
function shortfalls(want: Counts, have: Counts): string[] {
  return Object.entries(want)
    .filter(([key, n]) => (have[key] ?? 0) < n)
    .map(([key, n]) => `${key}: ${have[key] ?? 0} < ${n}`);
}

/** Converts Book.md as the vault's note, with `rule-box` styled (AC-2b). */
const convertBook = (callouts = true) =>
  run(
    BOOK(),
    {
      noteName: 'Book',
      notePath: `${VAULT}/Book.md`,
      assets: new FakeIndex(FILES()),
      settings: {
        ...SETTINGS,
        callouts: callouts ? {'rule-box': {fill: '#eeeeee'}} : {},
      },
    },
    FILES(),
  );

const codes = (warnings: readonly {code: string}[]): Counts => {
  const out: Counts = {};
  for (const w of warnings) out[w.code] = (out[w.code] ?? 0) + 1;
  return out;
};

describe(
  'US-024 AC-2 the census of the real file is covered',
  {timeout: 60_000},
  () => {
    it('US-024 AC-2: at least as many lines and bytes', () => {
      const c = census(BOOK());
      expect(c.lines).toBeGreaterThanOrEqual(REAL.lines);
      expect(c.bytes).toBeGreaterThanOrEqual(REAL.bytes);
    });

    it('US-024 AC-2: every node kind and heading depth at least as often', () => {
      const c = census(BOOK());
      expect(shortfalls(REAL.kinds, c.kinds)).toEqual([]);
      expect(shortfalls(REAL.depths, c.depths)).toEqual([]);
    });

    it('US-024 AC-2: lists, tables, aligns, html tags, links and image types', () => {
      const c = census(BOOK());
      expect(c.lists.bullet).toBeGreaterThanOrEqual(REAL.lists.bullet);
      expect(c.lists.ordered).toBeGreaterThanOrEqual(REAL.lists.ordered);
      expect(c.lists.maxNest).toBeGreaterThanOrEqual(REAL.lists.maxNest);
      expect(c.tables).toBeGreaterThanOrEqual(REAL.tables);
      expect(c.maxCols).toBeGreaterThanOrEqual(REAL.maxCols);
      expect(shortfalls(REAL.aligns, c.aligns)).toEqual([]);
      expect(shortfalls(REAL.html, c.html)).toEqual([]);
      expect(shortfalls(REAL.hrefs, c.hrefs)).toEqual([]);
      expect(shortfalls(REAL.images, c.images)).toEqual([]);
    });

    it('US-024 AC-2: every block pair (44) and inline pair (8) at least as often', () => {
      const c = census(BOOK());
      expect(Object.keys(REAL.blockPairs)).toHaveLength(44);
      expect(Object.keys(REAL.inlinePairs)).toHaveLength(8);
      expect(shortfalls(REAL.blockPairs, c.blockPairs)).toEqual([]);
      expect(shortfalls(REAL.inlinePairs, c.inlinePairs)).toEqual([]);
    });

    it('US-024 AC-2: every first and last character class of a text run, and the 11 non-ASCII characters', () => {
      const c = census(BOOK());
      const once = (counts: Counts): Counts =>
        Object.fromEntries(Object.keys(counts).map((k) => [k, 1]));
      expect(shortfalls(once(REAL.textStart), c.textStart)).toEqual([]);
      expect(shortfalls(once(REAL.textEnd), c.textEnd)).toEqual([]);
      expect(Object.keys(REAL.nonAscii)).toHaveLength(11);
      expect(shortfalls(once(REAL.nonAscii), c.nonAscii)).toEqual([]);
    });

    it('US-024 AC-2: a cover image as the first line and one Glossary section with at least 10 terms', () => {
      const lines = BOOK().split('\n');
      expect(lines[0]).toMatch(/^!\[\]\(assets\/[^)]+\.png\)$/);
      const at = lines.findIndex((l) => /^# Glossary\s*$/.test(l));
      expect(at).toBeGreaterThan(0);
      expect(lines.filter((l) => /^#+ Glossary\s*$/i.test(l))).toHaveLength(1);
      const end = lines.findIndex((l, i) => i > at && /^# /.test(l));
      const terms = lines
        .slice(at + 1, end === -1 ? undefined : end)
        .filter((l) => /^## \S/.test(l));
      expect(terms.length).toBeGreaterThanOrEqual(10);
    });

    it('US-024 AC-2: one .pdf file in assets/ that no note uses', () => {
      const pdfs = listFiles(SAMPLE_DIR).filter(
        (f) => f.startsWith('assets/') && f.endsWith('.pdf'),
      );
      expect(pdfs).toHaveLength(1);
      const name = (pdfs[0] as string).replace(/^assets\//, '');
      expect(BOOK()).not.toContain(name);
      expect(readSample('Other.md')).not.toContain(name);
    });

    it('US-024 AC-2: the warnings of the real file each at least once', async () => {
      const found = codes((await convertBook()).warnings);
      for (const code of [
        'LINK_AMBIGUOUS',
        'LINK_UNRESOLVED',
        'COMMENT_DROPPED',
      ]) {
        expect(found[code] ?? 0, code).toBeGreaterThanOrEqual(1);
      }
    });
  },
);

describe('US-024 AC-2b features the real file lacks', {timeout: 60_000}, () => {
  const BUILT_IN = [
    'note',
    'abstract',
    'info',
    'todo',
    'tip',
    'success',
    'question',
    'warning',
    'failure',
    'danger',
    'bug',
    'example',
    'quote',
  ];
  const lines = (): string[] => BOOK().split('\n');
  /** The type of the callout whose block holds line `i` at depth 1. */
  const outerType = (all: string[], i: number): string | undefined => {
    for (let j = i; j >= 0; j--) {
      const line = all[j] as string;
      if (!line.startsWith('>')) return undefined;
      const m = /^> \[!([^\]]+)\]/.exec(line);
      if (m !== null) return m[1];
    }
    return undefined;
  };

  it('US-024 AC-2b: each of the 13 built-in callout types once, with a title', () => {
    for (const type of BUILT_IN) {
      const re = new RegExp(`^> \\[!${type}\\][+-]? \\S`);
      expect(
        lines().filter((l) => re.test(l)).length,
        type,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('US-024 AC-2b: `rule-box` nested inside a `note` callout, and `mystery` once', () => {
    const all = lines();
    const nested = all
      .map((l, i) => ({l, i}))
      .filter(({l}) => /^> > \[!rule-box\]/.test(l));
    expect(nested.length).toBeGreaterThanOrEqual(1);
    expect(nested.map(({i}) => outerType(all, i))).toContain('note');
    expect(all.filter((l) => /^> \[!mystery\]/.test(l))).toHaveLength(1);
  });

  it('US-024 AC-2b: CALLOUT_TYPE_UNKNOWN only for `mystery` when `rule-box` is styled', async () => {
    const styled = (await convertBook(true)).warnings.filter(
      (w) => w.code === 'CALLOUT_TYPE_UNKNOWN',
    );
    expect(styled.map((w) => w.message)).toEqual([
      'No style for callout type "mystery"; the default box is used',
    ]);
    // The other side was in effect (SCAR-023): unstyled, `rule-box` is unknown too.
    const plain = (await convertBook(false)).warnings.filter(
      (w) => w.code === 'CALLOUT_TYPE_UNKNOWN',
    );
    expect(plain.length).toBeGreaterThan(styled.length);
  });

  it('US-024 AC-2b: inside a callout a task list, a table, an image embed, a nested callout and a wikilink in bold', () => {
    const all = lines();
    for (const [what, re] of [
      ['task list', /^> - \[[ x]\] \S/],
      ['table', /^> \|.*\|/],
      ['image embed', /^> !\[\[assets\/[^\]]+\.(png|jpe?g)\]\]/],
      ['nested callout', /^> > \[![^\]]+\]/],
      ['wikilink in bold', /^>.*\*\*\[\[[^\]]+\]\]\*\*/],
    ] as const) {
      expect(
        all.some((l) => re.test(l)),
        what,
      ).toBe(true);
    }
  });

  it('US-024 AC-2b: wikilinks in every listed form', () => {
    const book = BOOK();
    const at = book.indexOf('\n# Glossary');
    const glossary = book.slice(at);
    for (const [what, re] of [
      ['same note', /\[\[#[^\]|]+\]\]/],
      ['note name and alias', /\[\[Book#[^\]|]+\|[^\]]+\]\]/],
      ['in bold', /\*\*\[\[[^\]]+\]\]\*\*/],
      ['in an inline footnote', /\^\[[^\]]*\[\[[^\]]+\]\][^\]]*\]/],
      ['other note', /(?<!!)\[\[Other\]\]/],
      ['missing note', /\[\[Missing\]\]/],
    ] as const) {
      expect(re.test(book), what).toBe(true);
    }
    expect(at).toBeGreaterThan(0);
    expect(
      /\n(?!#)[^\n]*\[\[#[^\]]+\]\]/.test(glossary),
      'in a glossary explanation',
    ).toBe(true);
  });

  it('US-024 AC-2b: an image embed and a note embed with EMBED_NOTE_UNEXPANDED', async () => {
    expect(BOOK()).toMatch(/!\[\[assets\/[^\]]+\.png\]\]/);
    expect(BOOK()).toMatch(/!\[\[Other\]\]/);
    expect(
      codes((await convertBook()).warnings)['EMBED_NOTE_UNEXPANDED'],
    ).toBeGreaterThanOrEqual(1);
  });

  it('US-024 AC-2b: task lists open and done, nested, in a callout and in a glossary term with a tip callout', () => {
    const book = BOOK();
    expect(book).toMatch(/^- \[ \] \S/m);
    expect(book).toMatch(/^- \[x\] \S/m);
    expect(book).toMatch(/^ {2,}- \[[ x]\] \S/m);
    const glossary = book.slice(book.indexOf('\n# Glossary'));
    expect(glossary).toMatch(/^> \[!tip\]/m);
    expect(glossary).toMatch(/^>? ?- \[[ x]\] \S/m);
  });

  it('US-024 AC-2b: Book.md converts with only the expected warning codes', async () => {
    const found = Object.keys(codes((await convertBook()).warnings)).sort();
    expect(found).toEqual(
      [
        'CALLOUT_TYPE_UNKNOWN',
        'COMMENT_DROPPED',
        'EMBED_NOTE_UNEXPANDED',
        'LINK_AMBIGUOUS',
        'LINK_UNRESOLVED',
      ].sort(),
    );
  });
});

describe(
  'US-024 AC-3 the manifest agrees with the note',
  {timeout: 60_000},
  () => {
    it('US-024 AC-3: the counts the generator wrote equal the census of Book.md', () => {
      // The generator counts while writing; the census parses the note. Two
      // independent sources; text-run and pair counts depend on how the parser
      // splits text, so they are checked against the real file only (AC-2).
      const m = readManifest().census;
      const c = census(BOOK());
      expect({
        lines: m.lines,
        bytes: m.bytes,
        depths: m.depths,
        lists: m.lists,
        tables: m.tables,
        maxCols: m.maxCols,
        aligns: m.aligns,
        html: m.html,
        hrefs: m.hrefs,
        images: m.images,
        nonAscii: m.nonAscii,
      }).toEqual({
        lines: c.lines,
        bytes: c.bytes,
        depths: c.depths,
        lists: c.lists,
        tables: c.tables,
        maxCols: c.maxCols,
        aligns: c.aligns,
        html: c.html,
        hrefs: c.hrefs,
        images: c.images,
        nonAscii: c.nonAscii,
      });
      const blockKinds = (k: Counts): Counts =>
        Object.fromEntries(
          Object.entries(k).filter(
            ([kind]) => !['text', 'softbreak'].includes(kind),
          ),
        );
      expect(blockKinds(m.kinds)).toEqual(blockKinds(c.kinds));
    });

    it('US-024 AC-3: heading texts per level and glossary terms equal the parsed note', () => {
      const manifest = readManifest();
      const byLevel: Record<string, string[]> = {};
      const root = parse(BOOK()).root;
      for (const node of root) {
        if (node.kind !== 'heading') continue;
        (byLevel[String(node.depth)] ??= []).push(visibleText(node.children));
      }
      expect(manifest.headings).toEqual(byLevel);
      const lines = BOOK().split('\n');
      const at = lines.findIndex((l) => l === `# ${manifest.glossary.heading}`);
      expect(at).toBeGreaterThan(0);
      const end = lines.findIndex((l, i) => i > at && /^# /.test(l));
      expect(manifest.glossary.terms).toEqual(
        lines
          .slice(at + 1, end === -1 ? undefined : end)
          .filter((l) => /^## /.test(l))
          .map((l) => l.slice(3).trim()),
      );
    });

    it('US-024 AC-3: five known sentences, each the first sentence after its heading', () => {
      const {sentences} = readManifest();
      expect(sentences).toHaveLength(5);
      const book = BOOK();
      for (const {heading, text} of sentences) {
        const re = new RegExp(
          `^#+ ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n\\n${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          'm',
        );
        expect(re.test(book), heading).toBe(true);
      }
    });

    it('US-024 AC-3: image counts and files agree with the note and the vault', () => {
      const {images} = readManifest();
      const c = census(BOOK());
      expect(images.total).toBe(c.kinds['image'] ?? 0);
      expect(images.withCaption + images.withoutCaption).toBe(images.total);
      expect(images.withCaption).toBe(
        (BOOK().match(/!\[[^\]]+\]\(/g) ?? []).length,
      );
      expect(images.total).toBeGreaterThanOrEqual(64);
      expect(images.withCaption).toBeGreaterThanOrEqual(17);
      expect(images.withoutCaption).toBeGreaterThanOrEqual(47);
      for (const file of images.files) {
        expect(existsSync(join(SAMPLE_DIR, file)), file).toBe(true);
      }
      expect(new Set(images.files).size).toBe(images.files.length);
    });
  },
);

describe(
  'US-024 AC-2c the facts existing tests assert',
  {timeout: 60_000},
  () => {
    /** Book.md converted with page numbers on at `level` (US-018 AC-9). */
    const numbered = async (level: number): Promise<number> => {
      const {typ} = await run(
        BOOK(),
        {
          noteName: 'Book',
          notePath: `${VAULT}/Book.md`,
          assets: new FakeIndex(FILES()),
          settings: {
            ...SETTINGS,
            callouts: {'rule-box': {fill: '#eeeeee'}},
            linkPageNumbers: true,
            linkPageLevel: level,
            linkPageWord: 'p.',
            pageFurniture: {
              folios: true,
              runningHeader: false,
              runningHeaderLevel: 2,
            },
          },
        },
        FILES(),
      );
      return [...typ.matchAll(/#page-ref\(<[^>]+>\)/g)].length;
    };

    it('US-024 AC-2c: links by resolution rule at least 52 / 51 / 36, 14 ambiguous, 10 unresolved; they add up to the anchor links', () => {
      const {anchors} = readManifest();
      expect(anchors.byText).toBeGreaterThanOrEqual(52);
      expect(anchors.bySlug).toBeGreaterThanOrEqual(51);
      expect(anchors.byNumberStripped).toBeGreaterThanOrEqual(36);
      expect(anchors.ambiguous).toBeGreaterThanOrEqual(14);
      expect(anchors.unresolved).toBeGreaterThanOrEqual(10);
      expect(
        anchors.byText +
          anchors.bySlug +
          anchors.byNumberStripped +
          anchors.unresolved,
      ).toBe(census(BOOK()).hrefs['link:inline:anchor']);
      // As in US-004 AC-8 (52 + 51 + 36 + 10 = 149): an ambiguous link is also
      // counted under the rule that found its candidates (changed while coding
      // TICKET-069; the G2 version added it a second time).
      expect(anchors.ambiguous).toBeLessThanOrEqual(
        anchors.byText + anchors.bySlug + anchors.byNumberStripped,
      );
    });

    it('US-024 AC-2c: LINK_AMBIGUOUS once per ambiguous anchor link', async () => {
      const {anchors} = readManifest();
      const found = codes((await convertBook()).warnings);
      expect(found['LINK_AMBIGUOUS']).toBe(anchors.ambiguous);
      // Unresolved: the anchors plus the wikilinks [[Other]] and [[Missing]].
      expect(found['LINK_UNRESOLVED']).toBe(anchors.unresolved + 2);
    });

    it('US-024 AC-2c: at least 47 repeated titles with 158 extra uses, as the parsed headings show', () => {
      const {repeatedTitles} = readManifest();
      const seen = new Map<string, number>();
      for (const node of parse(BOOK()).root) {
        if (node.kind !== 'heading') continue;
        const title = visibleText(node.children);
        seen.set(title, (seen.get(title) ?? 0) + 1);
      }
      const repeated = [...seen.values()].filter((n) => n > 1);
      expect(repeatedTitles).toEqual({
        titles: repeated.length,
        extra: repeated.reduce((sum, n) => sum + n - 1, 0),
      });
      expect(repeatedTitles.titles).toBeGreaterThanOrEqual(47);
      expect(repeatedTitles.extra).toBeGreaterThanOrEqual(158);
    });

    for (const [level, real] of [
      [1, 22],
      [2, 33],
      [3, 59],
      [6, 139],
    ] as const) {
      it(`US-024 AC-2c: at linkPageLevel ${level} at least ${real} numbered links, as many as the manifest says`, async () => {
        const want = readManifest().numberedLinks[String(level)];
        expect(want).toBeGreaterThanOrEqual(real);
        expect(await numbered(level)).toBe(want);
      });
    }

    it('US-024 AC-2c: at least 40 terms; one term linked from at least 3 places', async () => {
      const {glossary, linkedTerm} = readManifest();
      expect(glossary.terms.length).toBeGreaterThanOrEqual(40);
      expect(glossary.terms).toContain(linkedTerm.term);
      expect(linkedTerm.links).toBeGreaterThanOrEqual(3);
      const {typ} = await convertBook();
      const escaped = linkedTerm.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const label = new RegExp(`#glossary-term\\[${escaped}\\] <([^>]+)>`).exec(
        typ,
      )?.[1];
      expect(label).toBeDefined();
      expect(typ.split(`#link(<${label}>)`).length - 1).toBe(linkedTerm.links);
    });

    it('US-024 AC-2c: at least 41 comments, reported once with the line of the first', async () => {
      const {comments} = readManifest();
      expect(comments.count).toBeGreaterThanOrEqual(41);
      expect(comments.count).toBe(census(BOOK()).kinds['comment']);
      const first =
        BOOK()
          .split('\n')
          .findIndex((l) => l.includes('<!--')) + 1;
      expect(comments.firstLine).toBe(first);
      const dropped = (await convertBook()).warnings.filter(
        (w) => w.code === 'COMMENT_DROPPED',
      );
      expect(dropped).toEqual([
        {
          code: 'COMMENT_DROPPED',
          message: `${comments.count} HTML comments dropped`,
          line: first,
        },
      ]);
    });

    it('US-024 AC-2c: at least 8 H1 titles', () => {
      expect(readManifest().headings['1']?.length).toBeGreaterThanOrEqual(8);
    });

    it('US-024 AC-2c: TABLE_ROW_LONG once per long row the manifest lists', async () => {
      const found = codes((await convertBook()).warnings);
      expect(found['TABLE_ROW_LONG'] ?? 0).toBe(readManifest().longRows);
    });
  },
);
