// US-003 images against the real compiler (integration, offline). Property
// (SCAR-009, SCAR-010): every kind of image in every container compiles, with
// the right number of images, the right captions and sizes, whatever surrounds
// it; a missing, remote or invalid image compiles as a placeholder; the whole
// real file, with its real assets found by the resolver, compiles.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {createAssetResolver} from '../../src/core/assets';
import {FIT_IMAGE_HELPER} from '../../src/core/emit';
import {blocks} from '../support/blocks';
import {
  SAMPLE_DIR,
  VAULT,
  listFiles,
  readManifest,
  readSample,
  withCalloutHarness,
} from '../support/sample';
import {fakeAssets, findAll, jpeg, png, svg} from '../support/images';
import {decodeTypstString, diagnose, type Files} from '../support/typst-node';

const FILES = {
  'assets/a.png': png(100, 50),
  'assets/b.png': png(40, 40),
  'assets/s.svg': svg(),
};
const PAGE = '#set page(width: 300pt, height: 400pt, margin: 20pt)';

/** Compiles `typ` and returns what `expression` (over images `is`, figures `fs`) gives. */
async function ask(typ: string, expression: string, files: Files = FILES) {
  const source = `${PAGE}\n${FIT_IMAGE_HELPER}\n${SHOW}\n${typ}\n#context { let is = query(image); let fs = query(figure); assert.eq(${expression}, "@@") }\n`;
  const diagnostics = await diagnose(source, files);
  const first = diagnostics.find((d) => d.severity === 'error');
  const match =
    /^equality assertion failed: value "(.*)" was not equal to "@@"$/s.exec(
      first?.message ?? '',
    );
  if (match === null) {
    throw new Error(`${first?.message ?? 'no error'}\n--- typ ---\n${typ}`);
  }
  return decodeTypstString(match[1] as string);
}
/** Makes each placeholder rect findable: its body is stored under <ph>. */
const SHOW = '#show rect: it => [#metadata(repr(it.body))<ph>#it]';
const COUNTS =
  'str(is.len()) + "/" + str(fs.len()) + "/" + fs.map(f => repr(f.caption.body)).join("")';

describe('US-003 images in every container (compiler)', () => {
  // [markdown of one image, expected number of captions text, sized?]
  const FORMS: [string, string][] = [
    ['![](a.png)', ''],
    ['![Cap](a.png)', '[Cap]'],
    ['![Cap|300](a.png)', '[Cap]'],
    ['![|300](a.png)', ''],
    ['![[a.png|300x200]]', ''],
    ['![[a.png|Cap]]', '[Cap]'],
    ['![[s.svg|A|120]]', '[A]'],
  ];
  const CONTEXTS: [string, (image: string) => string][] = [
    ['alone', (i) => i],
    ['text around', (i) => `before ${i} after`],
    ['own lines', (i) => `before\n${i}\nafter`],
    ['marker text after', (i) => `${i} = x`],
    ['list item', (i) => `- item\n  ${i}`],
    ['numbered item', (i) => `1. item ${i}`],
    ['nested item', (i) => `- a\n  - b ${i}`],
    ['quote', (i) => `> q ${i}`],
    ['table cell', (i) => `| h |\n|---|\n| c ${i.replaceAll('|', '\\|')} |`],
    ['emphasis', (i) => `*a ${i} b*`],
    ['strong', (i) => `**a ${i} b**`],
    ['strike', (i) => `~~a ${i} b~~`],
    ['highlight', (i) => `==a ${i} b==`],
    ['link', (i) => `[${i}](https://x.org)`],
    ['footnote', (i) => `x^[note ${i}]`],
    ['heading', (i) => `## Head ${i}`],
  ];

  it('US-003 AC-1: every image form in every container compiles with one image and the right caption', async () => {
    for (const [form, caption] of FORMS) {
      for (const [name, wrap] of CONTEXTS) {
        const md = wrap(form);
        const {typ, warnings} = blocks(md, {assets: findAll()});
        const expected = `1/${caption === '' ? 0 : 1}/${caption}`;
        expect(
          await ask(typ, COUNTS),
          `${JSON.stringify(md)} (${name}) -> ${JSON.stringify(typ)}`,
        ).toBe(expected);
        expect(
          warnings.map((x) => x.code).filter((c) => c !== 'IMAGE_IN_HEADING'),
          `${name} ${form}`,
        ).toEqual([]);
      }
    }
  });

  it('US-003 AC-1c: several images and the text between them compile in order', async () => {
    const md = 'a ![](a.png) b ![One](b.png) c\n![[s.svg]]\nd';
    const {typ} = blocks(md, {assets: findAll()});
    expect(await ask(typ, COUNTS)).toBe('3/1/[One]');
  });

  it('US-003 AC-1d: a link that wraps an image keeps its destination', async () => {
    const {typ} = blocks('[![](a.png)](https://x.org)', {assets: findAll()});
    expect(await ask(typ, 'repr(query(link).first().dest)')).toBe(
      '"https://x.org"',
    );
  });

  it('US-003 AC-2: sizes reach the compiled image in points', async () => {
    const {typ} = blocks('![[a.png|300]]\n\n![[b.png|200x100]]', {
      assets: findAll(),
    });
    expect(
      await ask(
        typ,
        'is.map(i => repr(i.width) + "," + repr(i.height)).join("|")',
      ),
    ).toBe('0% + 225pt,auto|0% + 150pt,0% + 75pt');
  });

  it('US-003 AC-7: a path with a quote and a backslash is a valid Typst string', async () => {
    const odd = {
      'assets/a"b.png': png(10, 10),
      'assets/c\\d.png': png(10, 10),
    };
    const assets = fakeAssets({
      'x.png': 'assets/a"b.png',
      'y.png': 'assets/c\\d.png',
    });
    const {typ} = blocks('![](x.png)\n\n![](y.png)', {assets});
    expect(await ask(typ, 'str(is.len())', odd)).toBe('2');
  });
});

describe('US-003 AC-3 / AC-5 placeholders (compiler)', () => {
  const cases: [string, string][] = [
    ['missing', '![](assets/no.png)'],
    ['unsupported', '![](assets/x.bmp)'],
    ['remote', '![](https://x.org/a.png?x=1&y=#z)'],
    ['data', '![](data:image/png;base64,AAAA)'],
    ['special characters', '![](a#b$c]d[e~f*g_h`i.png)'],
    ['embed', '![[song.mp3]]'],
  ];

  it('US-003 AC-5: every placeholder compiles and shows the text Missing image:', async () => {
    for (const [name, md] of cases) {
      const {typ} = blocks(md, {assets: fakeAssets({})});
      expect(typ, name).toContain('#rect(width: 100%, height: 4cm');
      const shown = await ask(
        typ,
        'str(query(<ph>).len()) + "|" + repr(query(<ph>).first().value.contains("Missing image"))',
      );
      expect(shown, name).toBe('1|true');
    }
  });

  it('US-003 AC-5: a placeholder inside a list item, a quote and a table cell compiles', async () => {
    for (const wrap of [
      (i: string) => `- item ${i}`,
      (i: string) => `> q ${i}`,
      (i: string) => `| h |\n|---|\n| c ${i} |`,
    ]) {
      const {typ} = blocks(wrap('![](assets/no.png)'), {
        assets: fakeAssets({}),
      });
      expect(await ask(typ, 'str(query(<ph>).len())')).toBe('1');
    }
  });
});

/** A small valid image of the kind the name says. */
function standIn(name: string): Uint8Array {
  if (/\.jpe?g$/i.test(name)) return jpeg();
  return /\.svg$/i.test(name) ? svg() : png(30, 20);
}

describe('US-003 the sample note', () => {
  const root = VAULT;
  const md = readSample('Book.md');
  const {images, features} = readManifest();
  const files = new Map<string, Uint8Array>();
  for (const f of listFiles(SAMPLE_DIR).filter((p) =>
    p.startsWith('assets/'),
  )) {
    files.set(
      `${root}/${f}`,
      readFileSync(join(SAMPLE_DIR, f)).subarray(0, 16),
    );
  }
  const resolver = createAssetResolver({
    notePath: `${root}/Book.md`,
    files,
  });
  const result = blocks(md, {assets: resolver});
  // The markdown images and the image embeds (AC-2b) each place one image.
  const placed = images.total + (features['embed:image'] ?? 0);

  it('US-003 AC-1: finds every image of the sample note, with no asset warning', () => {
    const codes = result.warnings
      .map((x) => x.code)
      .filter((c) => c.startsWith('ASSET_') || c === 'IMAGE_IN_HEADING');
    expect(codes).toEqual([]);
    expect(images.total).toBeGreaterThanOrEqual(64);
    expect(result.typ.match(/fit-image\(/g)).toHaveLength(placed);
  });

  it('US-003 AC-1b: gives a caption to the images with alt text and none to the others', () => {
    expect(images.withCaption).toBeGreaterThan(0);
    expect(images.withoutCaption).toBeGreaterThan(0);
    expect(result.typ.match(/#figure\(/g)).toHaveLength(images.withCaption);
  });

  it('US-003 AC-4: lists every image file once to copy, all inside the note folder', () => {
    const uses = resolver.uses();
    // The note uses some files twice; each is copied once.
    expect(placed).toBeGreaterThan(images.files.length);
    expect(uses).toHaveLength(images.files.length);
    expect(new Set(uses.map((u) => u.from)).size).toBe(images.files.length);
    expect(uses.every((u) => !u.to.includes('_external'))).toBe(true);
    expect(uses.every((u) => u.from === `${root}/${u.to}`)).toBe(true);
  });

  // SCAR-030: compiles the whole sample document; 1399 ms with all 2480 tests
  // running at once (2026-10-29), so a limit with room for a loaded machine.
  it('US-003 AC-2b: the whole document compiles with stand-in images of the same names', async () => {
    const standIns = Object.fromEntries(
      resolver.uses().map((u) => [u.to, standIn(u.to)]),
    );
    const source = `${FIT_IMAGE_HELPER}\n${withCalloutHarness(result.typ)}\n`;
    const errors = (await diagnose(source, standIns)).filter(
      (d) => d.severity === 'error',
    );
    expect(errors.map((e) => e.message)).toEqual([]);
  }, 120_000);
});
