// US-003 — images (unit, pure core, injected asset resolver). Source of truth:
// docs/user-stories/US-003-images-and-assets.md. Exact string comparison, real
// parser (US-014), real emitter, fake resolver. The output is proven against the
// compiler in tests/integration/us-003-*.test.ts.
import {describe, expect, it} from 'vitest';
import {FIT_IMAGE_HELPER} from '../../src/core/emit';
import {blocks} from '../support/blocks';
import {labels} from '../support/headings';
import {fakeAssets, findAll} from '../support/images';

const w = (code: string, message: string, line: number) => ({
  code,
  message,
  line,
});
const none: never[] = [];
const fig = (path: string, caption: string, image = 'fit-image') =>
  `#figure(${image}("${path}"), caption: [${caption}], numbering: none)`;
const PLACEHOLDER = (text: string) =>
  `#rect(width: 100%, height: 4cm, stroke: 1pt + red)[Missing image: ${text}]`;
const run = (md: string, assets = findAll()) => blocks(md, {assets});

describe('US-003 AC-1 standard images', () => {
  it('US-003 AC-1: converts ![A crypt](assets/crypt.png) to #figure(fit-image(...), caption: [A crypt], numbering: none)', () => {
    expect(run('![A crypt](assets/crypt.png)')).toEqual({
      typ: fig('assets/crypt.png', 'A crypt'),
      warnings: none,
    });
  });

  it('US-003 AC-1: converts an image without alt text to #fit-image(...) without caption', () => {
    expect(run('![](assets/crypt.png)')).toEqual({
      typ: '#fit-image("assets/crypt.png")',
      warnings: none,
    });
  });

  it('US-003 AC-1: escapes special characters in the caption', () => {
    expect(typ2('![Cost $5 #1 [x]](a.png)')).toBe(
      fig('assets/a.png', 'Cost \\$5 \\#1 \\[x\\]'),
    );
  });

  it('US-003 AC-1: starts the caption as the start of a block (a leading marker is escaped)', () => {
    expect(typ2('![- a](a.png)')).toBe(fig('assets/a.png', '\\- a'));
  });

  it('US-003 AC-1: treats a non-size pipe part in ![[crypt.png|A crypt]] as alt text, same output as the standard form', () => {
    expect(run('![[crypt.png|A crypt]]')).toEqual(
      run('![A crypt](assets/crypt.png)'),
    );
  });

  it('US-003 AC-1: ignores the title of an image', () => {
    expect(typ2('![A](a.png "Title")')).toBe(fig('assets/a.png', 'A'));
  });

  it('US-003 AC-1: asks the resolver for a standard image with source image and an embed with source embed', () => {
    const assets = findAll();
    run('![](assets/a.png)\n\n![[b.png]]', assets);
    expect(assets.requests).toEqual([
      {source: 'image', target: 'assets/a.png', line: 1},
      {source: 'embed', target: 'b.png', line: 3},
    ]);
  });
});

function typ2(md: string): string {
  return run(md).typ;
}

describe('US-003 AC-1b pipe in the alt text', () => {
  it('US-003 AC-1b: uses the part before the first pipe as the caption (the title written twice)', () => {
    expect(
      typ2('![Limb Regeneration|Limb Regeneration ](assets/limb.png)'),
    ).toBe(fig('assets/limb.png', 'Limb Regeneration'));
  });

  it('US-003 AC-1b: reads a numeric part after the pipe as the size', () => {
    expect(typ2('![A crypt|300](assets/crypt.png)')).toBe(
      '#figure(image("assets/crypt.png", width: 225pt), caption: [A crypt], numbering: none)',
    );
  });

  it('US-003 AC-1b: places an image with an empty caption and a size without a caption', () => {
    expect(typ2('![|300](assets/crypt.png)')).toBe(
      '#image("assets/crypt.png", width: 225pt)',
    );
  });

  it('US-003 AC-1b: ignores other parts after the pipe and takes the first size', () => {
    expect(typ2('![A|abc|200x100|300](a.png)')).toBe(
      '#figure(image("assets/a.png", width: 150pt, height: 75pt), caption: [A], numbering: none)',
    );
  });

  it('US-003 AC-1b: does not treat a decimal or a zero as a size', () => {
    expect(typ2('![A|300.5](a.png)')).toBe(fig('assets/a.png', 'A'));
    expect(typ2('![A|0](a.png)')).toBe(fig('assets/a.png', 'A'));
    expect(typ2('![A|300x0](a.png)')).toBe(fig('assets/a.png', 'A'));
  });
});

describe('US-003 AC-1c images in a paragraph with other content', () => {
  const FIT = '#fit-image("assets/a.png")';

  it('US-003 AC-1c: splits a paragraph at each image: text, figure, text, in order', () => {
    expect(run('See ![A crypt](a.png) below.')).toEqual({
      typ: `See\n\n${fig('assets/a.png', 'A crypt')}\n\nbelow.`,
      warnings: none,
    });
  });

  it('US-003 AC-1c: turns a paragraph that contains only images into only figures', () => {
    expect(typ2('![](a.png)\n![A](b.png)')).toBe(
      `${FIT}\n\n${fig('assets/b.png', 'A')}`,
    );
  });

  it('US-003 AC-1c: drops the breaks next to an image (images on their own lines)', () => {
    expect(typ2('Text\n![](a.png)\nMore')).toBe(`Text\n\n${FIT}\n\nMore`);
  });

  it('US-003 AC-1c: starts the text after an image as a block start', () => {
    expect(typ2('a ![](a.png) = x')).toBe(`a\n\n${FIT}\n\n\\= x`);
    expect(typ2('a ![](a.png) - x')).toBe(`a\n\n${FIT}\n\n\\- x`);
  });

  it('US-003 AC-1c: keeps two images next to each other as two figures', () => {
    expect(typ2('![](a.png)![](a.png)')).toBe(`${FIT}\n\n${FIT}`);
  });

  it('US-003 AC-1c: splits inside a list item and keeps the figure in the item', () => {
    expect(typ2('- item\n  ![Map](assets/map.png)')).toBe(
      `- item\n\n  ${fig('assets/map.png', 'Map')}`,
    );
  });

  it('US-003 AC-1c: splits inside a table cell', () => {
    expect(typ2('| a |\n|---|\n| x ![](a.png) y |')).toBe(
      `#table(\n  columns: 1,\n  align: (left,),\n  table.header([a]),\n  [x\n\n${FIT}\n\ny],\n)`,
    );
  });

  it('US-003 AC-1c: uses the function form of a mark that contains an image', () => {
    expect(typ2('*a ![](a.png) b*')).toBe(`#emph[a\n\n${FIT}\n\nb]`);
    expect(typ2('**a ![](a.png)**')).toBe(`#strong[a\n\n${FIT}]`);
  });
});

describe('US-003 AC-1d image in a heading, link, footnote', () => {
  it('US-003 AC-1d: places the figure after the heading and reports IMAGE_IN_HEADING', () => {
    expect(run('## Map ![](m.png)')).toEqual({
      typ: '== Map <h-map>\n\n#fit-image("assets/m.png")',
      warnings: [
        w('IMAGE_IN_HEADING', 'Image in a heading placed after the heading', 1),
      ],
    });
  });

  it('US-003 AC-1d: keeps the label of a heading with an image the same as without it', () => {
    expect(labels('## Map ![](m.png)')).toEqual(labels('## Map'));
  });

  it('US-003 AC-1d: places several images of a heading in order, each with a warning', () => {
    const out = run('## A ![](a.png) B ![x](b.png)');
    expect(out.typ).toBe(
      `== A B <h-a-b>\n\n#fit-image("assets/a.png")\n\n${fig('assets/b.png', 'x')}`,
    );
    expect(out.warnings.map((x) => x.code)).toEqual([
      'IMAGE_IN_HEADING',
      'IMAGE_IN_HEADING',
    ]);
  });

  it('US-003 AC-1d: keeps the image of a heading that has no other text and reports the empty heading', () => {
    const out = run('# ![](m.png)');
    expect(out.typ).toBe('#fit-image("assets/m.png")');
    expect(out.warnings.map((x) => x.code).sort()).toEqual([
      'HEADING_EMPTY',
      'IMAGE_IN_HEADING',
    ]);
  });

  it('US-003 AC-1d: finds an image inside emphasis in a heading', () => {
    expect(run('## A *![](a.png)* B').typ).toBe(
      '== A B <h-a-b>\n\n#fit-image("assets/a.png")',
    );
  });

  it('US-003 AC-1d: converts a link whose text is an image to #link(...)[#fit-image(...)] without a footnote', () => {
    expect(run('[![](a.png)](https://x.org)')).toEqual({
      typ: '#link("https://x.org")[#fit-image("assets/a.png")]',
      warnings: none,
    });
    expect(typ2('[![Cap](a.png)](https://x.org)')).toBe(
      `#link("https://x.org")[${fig('assets/a.png', 'Cap')}]`,
    );
  });

  it('US-003 AC-1d: keeps an image in footnote text in the note', () => {
    expect(typ2('x^[![](a.png)]')).toBe(
      'x#footnote[#fit-image("assets/a.png")]',
    );
  });
});

describe('US-003 AC-2 embeds with size', () => {
  it('US-003 AC-2: converts ![[crypt.png|300]] to width: 225pt', () => {
    expect(typ2('![[crypt.png|300]]')).toBe(
      '#image("assets/crypt.png", width: 225pt)',
    );
  });

  it('US-003 AC-2: converts ![[crypt.png|300x200]] to width: 225pt, height: 150pt', () => {
    expect(typ2('![[crypt.png|300x200]]')).toBe(
      '#image("assets/crypt.png", width: 225pt, height: 150pt)',
    );
  });

  it('US-003 AC-2: writes pixels times 0.75 without trailing zeros', () => {
    expect(typ2('![[a.png|301]]')).toBe(
      '#image("assets/a.png", width: 225.75pt)',
    );
    expect(typ2('![[a.png|1x2]]')).toBe(
      '#image("assets/a.png", width: 0.75pt, height: 1.5pt)',
    );
    expect(typ2('![[a.png|400]]')).toBe('#image("assets/a.png", width: 300pt)');
  });

  it('US-003 AC-2c: takes alt text and size from ![[a.png|A crypt|300]] in any order', () => {
    expect(typ2('![[a.png|A crypt|300]]')).toBe(
      '#figure(image("assets/a.png", width: 225pt), caption: [A crypt], numbering: none)',
    );
    expect(typ2('![[a.png|300|A crypt]]')).toBe(typ2('![[a.png|A crypt|300]]'));
  });

  it('US-003 AC-2c: takes the first of two alt texts as the caption', () => {
    expect(typ2('![[a.png|One|Two]]')).toBe(fig('assets/a.png', 'One'));
  });

  it('US-003 AC-1b: trims blanks around the caption', () => {
    expect(typ2('![ Cap |300](a.png)')).toBe(
      '#figure(image("assets/a.png", width: 225pt), caption: [Cap], numbering: none)',
    );
  });

  it('US-003 AC-1d: treats an image embed alone in a heading as an empty heading, and a note embed as text', () => {
    const out = run('# ![[a.png]]');
    expect(out.typ).toBe('#fit-image("assets/a.png")');
    expect(out.warnings.map((x) => x.code).sort()).toEqual([
      'HEADING_EMPTY',
      'IMAGE_IN_HEADING',
    ]);
    expect(run('# ![[Some Note]]').typ).toContain('= Some Note');
  });

  it('US-003 AC-2c: ignores a zero size and keeps a decimal as alt text', () => {
    expect(typ2('![[a.png|0]]')).toBe('#fit-image("assets/a.png")');
    expect(typ2('![[a.png|300.5]]')).toBe(fig('assets/a.png', '300.5'));
  });

  it('US-003 AC-2c: leaves a note embed to US-004 even when a resolver is given', () => {
    expect(run('![[Some Note]]')).toEqual({
      typ: 'Some Note',
      warnings: [
        w(
          'EMBED_NOTE_UNEXPANDED',
          'Note embed "![[Some Note]]" is not expanded',
          1,
        ),
      ],
    });
  });
});

describe('US-003 AC-2b the fit-image helper', () => {
  it('US-003 AC-2b: exports the helper text of the story', () => {
    expect(FIT_IMAGE_HELPER).toBe(
      [
        '#let fit-image(path) = layout(size => {',
        '  let m = measure(image(path))',
        '  let w = calc.min(m.width, size.width)',
        '  let h = m.height * (w / m.width)',
        '  image(path, width: w * calc.min(1, size.height / h))',
        '})',
      ].join('\n'),
    );
  });

  it('US-003 AC-2b: does not use the helper for an image with an explicit size', () => {
    expect(typ2('![[a.png|300]]')).not.toContain('fit-image');
    expect(typ2('![](a.png)')).toContain('fit-image');
  });
});

describe('US-003 AC-3 encoded and remote paths', () => {
  it("US-003 AC-3: decodes %20 in paths before lookup ('Rulebook%20images' becomes 'Rulebook images')", () => {
    const assets = findAll();
    run('![](Rulebook/Rulebook%20images/Cover%20Draft%201000.png)', assets);
    expect(assets.requests[0]?.target).toBe(
      'Rulebook/Rulebook images/Cover Draft 1000.png',
    );
  });

  it('US-003 AC-3: keeps a percent sequence that is not valid UTF-8 as written', () => {
    const assets = findAll();
    run('![](a%zz.png)\n\n![](b%.png)\n\n![](c%E0%A4.png)', assets);
    expect(assets.requests.map((r) => r.target)).toEqual([
      'a%zz.png',
      'b%.png',
      'c%E0%A4.png',
    ]);
  });

  it('US-003 AC-3: does not decode the name of an embed', () => {
    const assets = findAll();
    run('![[a%20b.png]]', assets);
    expect(assets.requests[0]?.target).toBe('a%20b.png');
  });

  it('US-003 AC-3: does not download http(s) images: emits the placeholder and reports ASSET_REMOTE', () => {
    const assets = findAll();
    expect(run('![](https://x.org/a.png)', assets)).toEqual({
      typ: PLACEHOLDER('https:\\/\\/x.org/a.png'),
      warnings: [
        w(
          'ASSET_REMOTE',
          'Remote image is not downloaded: https://x.org/a.png',
          1,
        ),
      ],
    });
    expect(assets.requests).toEqual([]);
  });

  it('US-003 AC-3: treats data: and ftp: addresses as remote, and a drive letter as a path', () => {
    expect(run('![](data:image/png;base64,AAAA)').warnings[0]?.code).toBe(
      'ASSET_REMOTE',
    );
    expect(run('![](ftp://x/a.png)').warnings[0]?.code).toBe('ASSET_REMOTE');
    const assets = findAll();
    run('![](C:/x/a.png)', assets);
    expect(assets.requests[0]?.target).toBe('C:/x/a.png');
  });
});

describe('US-003 AC-5 missing, unsupported, invalid', () => {
  it('US-003 AC-5: emits the red placeholder rect and ASSET_MISSING for a file that does not exist', () => {
    expect(blocks('![](assets/crypt.png)', {assets: fakeAssets({})})).toEqual({
      typ: PLACEHOLDER('assets/crypt.png'),
      warnings: [
        w('ASSET_MISSING', 'Image file not found: assets/crypt.png', 1),
      ],
    });
  });

  it('US-003 AC-5: emits the placeholder and ASSET_TYPE_UNSUPPORTED for a .bmp file, without asking the resolver', () => {
    const assets = findAll();
    expect(run('![](assets/x.bmp)', assets)).toEqual({
      typ: PLACEHOLDER('assets/x.bmp'),
      warnings: [
        w(
          'ASSET_TYPE_UNSUPPORTED',
          'Image type .bmp is not supported: assets/x.bmp',
          1,
        ),
      ],
    });
    expect(assets.requests).toEqual([]);
  });

  it('US-003 AC-5: supports png, jpg, jpeg, gif, webp and svg in any letter case and rejects others', () => {
    for (const name of [
      'a.png',
      'a.JPG',
      'a.jpeg',
      'a.gif',
      'a.WebP',
      'a.svg',
    ]) {
      expect(run(`![](${name})`).warnings, name).toEqual(none);
    }
    for (const name of ['a.pdf', 'a.tiff', 'a', 'a.png.txt']) {
      expect(run(`![](${name})`).warnings[0]?.code, name).toBe(
        'ASSET_TYPE_UNSUPPORTED',
      );
    }
    expect(run('![](a)').warnings[0]?.message).toBe(
      'Image type is not supported: a',
    );
  });

  it('US-003 AC-5: reports an unsupported embed such as a sound file', () => {
    expect(run('![[song.mp3]]')).toEqual({
      typ: PLACEHOLDER('song.mp3'),
      warnings: [
        w(
          'ASSET_TYPE_UNSUPPORTED',
          'Image type .mp3 is not supported: song.mp3',
          1,
        ),
      ],
    });
  });

  it('US-003 AC-5: escapes the path in the placeholder as markup', () => {
    expect(blocks('![](a].png)', {assets: fakeAssets({})}).typ).toBe(
      PLACEHOLDER('a\\].png'),
    );
    expect(blocks('![](a#b$c.png)', {assets: fakeAssets({})}).typ).toBe(
      PLACEHOLDER('a\\#b\\$c.png'),
    );
  });

  it('US-003 AC-5b: emits the placeholder and ASSET_INVALID for a file whose content does not match', () => {
    expect(
      blocks('![](assets/x.png)', {
        assets: fakeAssets({'assets/x.png': {status: 'invalid'}}),
      }),
    ).toEqual({
      typ: PLACEHOLDER('assets/x.png'),
      warnings: [
        w(
          'ASSET_INVALID',
          'Image file is not a valid .png image: assets/x.png',
          1,
        ),
      ],
    });
  });

  it('US-003 AC-5: reports the line of each image', () => {
    const out = blocks('a\n\n![](x.png)\n\nb\n\n![](y.png)', {
      assets: fakeAssets({}),
    });
    expect(out.warnings.map((x) => x.line)).toEqual([3, 7]);
  });

  it('US-003 AC-2c: warns ASSET_AMBIGUOUS and uses the first file', () => {
    expect(
      blocks('![[crypt.png]]', {
        assets: fakeAssets({
          'crypt.png': {
            status: 'ambiguous',
            path: 'assets/crypt.png',
            count: 2,
          },
        }),
      }),
    ).toEqual({
      typ: '#fit-image("assets/crypt.png")',
      warnings: [
        w(
          'ASSET_AMBIGUOUS',
          '"crypt.png" matches 2 files; the first is used',
          1,
        ),
      ],
    });
  });
});

describe('US-003 AC-6 images in lists and cells, AC-7 path escaping', () => {
  it('US-003 AC-6: keeps a captioned image of a list item inside that item', () => {
    expect(typ2('- item\n\n  ![Map](assets/map.png)')).toBe(
      `- item\n\n  ${fig('assets/map.png', 'Map')}`,
    );
  });

  it('US-003 AC-6: keeps an image of a table cell inside that cell', () => {
    expect(typ2('| a |\n|---|\n| ![](a.png) |')).toBe(
      '#table(\n  columns: 1,\n  align: (left,),\n  table.header([a]),\n  [#fit-image("assets/a.png")],\n)',
    );
  });

  it('US-003 AC-6: keeps an image in a quote', () => {
    expect(typ2('> ![A](a.png)')).toBe(
      `#quote(block: true)[\n  ${fig('assets/a.png', 'A')}\n]`,
    );
  });

  it('US-003 AC-7: escapes " and \\ in a path for a Typst string', () => {
    const assets = fakeAssets({
      'x.png': 'a"b.png',
      'y.png': 'a\\b.png',
    });
    expect(
      blocks('![](x.png)', {assets: fakeAssets({'x.png': 'a"b.png'})}).typ,
    ).toBe('#fit-image("a\\"b.png")');
    expect(blocks('![](y.png)', {assets}).typ).toBe('#fit-image("a\\\\b.png")');
  });
});

describe('US-003 without a resolver', () => {
  it('US-003 AC-8: keeps the alt text and reports NODE_UNSUPPORTED when no resolver is given', () => {
    expect(blocks('![A crypt](a.png)')).toEqual({
      typ: 'A crypt',
      warnings: [
        w('NODE_UNSUPPORTED', 'No emitter for image; its text is kept', 1),
      ],
    });
  });
});
