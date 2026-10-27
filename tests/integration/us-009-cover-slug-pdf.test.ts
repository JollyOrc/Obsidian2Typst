// US-009 AC-11 — the cover with a slug in a PDF made with the real compiler:
// the page is trim + bleed + slug, the cover box is trim + bleed and sits 5 mm
// from the left and top edge, and the body pages keep their margins (SCAR-015:
// measured in the PDF). Source of truth: docs/user-stories/US-009-page-setup.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {convert} from '../../src/core/convert';
import {DEFAULT_COVER} from '../../src/core/cover';
import {
  BUILTIN_PAGE_PRESETS,
  resolvePageSetup,
} from '../../src/core/layout/page-setup';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {png} from '../support/images';
import {mm, readPdfPages} from '../support/pdf';

const wasm = new Uint8Array(
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
    ),
  ),
);
const fonts = ['LibertinusSerif-Regular.otf', 'LibertinusSerif-Bold.otf'].map(
  (n) => new Uint8Array(readFileSync(join('assets/fonts', n))),
);
const COVER = 'Sample/assets/cover.png';

async function pagesOf(slug: number) {
  const page = resolvePageSetup({...BUILTIN_PAGE_PRESETS['A5 print'], slug});
  if (!page.ok) throw new Error('valid');
  const index = new FakeIndex([NOTE_PATH, COVER]);
  index.images.set(COVER, png(20, 30));
  const result = await convert({
    source: '![](assets/cover.png)\n\n# The Handbook\n\nSome text.\n',
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings: {...SETTINGS, page: page.value, cover: {...DEFAULT_COVER}},
    assets: index,
  });
  const files: Record<string, Uint8Array> = {};
  for (const use of result.assets) files[use.to] = png(20, 30);
  const compiler = createTypstCompiler({
    createWorker: () => new LoopbackWorker(),
    compilerWasm: async () => wasm,
  });
  const compiled = await compiler.compile({
    file: 'main.typ',
    source: result.typ,
    files,
    fonts,
  });
  compiler.dispose();
  if (!compiled.ok) throw new Error(compiled.error);
  return readPdfPages(compiled.pdf);
}

describe('US-009 AC-11 the cover with a slug in the PDF', () => {
  it('US-009 AC-11: slug 5 gives pages of 164 × 226 mm and a cover box of 154 × 216 mm, 5 mm from the left and the top', async () => {
    const pages = await pagesOf(5);
    expect(pages).toHaveLength(2);
    const [cover, body] = pages as [(typeof pages)[0], (typeof pages)[0]];
    expect([mm(cover.width), mm(cover.height)]).toEqual([164, 226]);
    expect(cover.hasImage).toBe(true);
    expect(cover.hasText).toBe(false);
    const box = cover.clip;
    expect(box).not.toBeNull();
    expect(Math.abs(mm(box!.width) - 154)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mm(box!.height) - 216)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mm(box!.left) - 5)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mm(box!.top) - 5)).toBeLessThanOrEqual(0.5);
    // The body page has its text and its size (SCAR-015).
    expect([mm(body.width), mm(body.height)]).toEqual([164, 226]);
    expect(body.text).toContain('The Handbook');
  });

  it('US-009 AC-11: slug 0 fills the whole page of 154 × 216 mm as before', async () => {
    const cover = (await pagesOf(0))[0]!;
    expect([mm(cover.width), mm(cover.height)]).toEqual([154, 216]);
    const box = cover.clip!;
    expect(Math.abs(mm(box.width) - 154)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mm(box.left))).toBeLessThanOrEqual(0.5);
  });
});
