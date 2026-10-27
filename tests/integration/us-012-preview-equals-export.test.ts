// US-012 AC-13 — the preview compile and the export give the same number of
// pages, with the real compiler, for the reference input and each built-in
// preset, and for a note with a cover and a custom heading font; a downsampler
// that drops the resolution is caught (SCAR-015). The drawn pixels: manual
// check M2 step 15. Source of truth:
// docs/user-stories/US-012-style-preview-panel.md.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {DEFAULT_COVER} from '../../src/core/cover';
import {DEFAULT_FONTS} from '../../src/core/fonts';
import {
  BUILTIN_PAGE_PRESETS,
  resolvePageSetup,
} from '../../src/core/layout/page-setup';
import {scaledDensity, withDensity} from '../../src/core/preview/downsample';
import {createTypstCompiler} from '../../src/plugin/compiler';
import {createPageRenderer} from '../../src/plugin/preview/renderer';
import {buildPreviewRequest} from '../../src/plugin/preview/request';
import {FakeIndex, NOTE_PATH, SETTINGS, run, standIn} from '../support/convert';
import {LoopbackWorker} from '../support/fake-worker';
import {VAULT_FAMILY, bundledFontFile, vaultTestFont} from '../support/fonts';
import {png} from '../support/images';
import {mm, readPdfPages} from '../support/pdf';
import {SAMPLE_DIR, VAULT, listFiles, readSample} from '../support/sample';

const modules = join(process.cwd(), 'node_modules/@myriaddreamin');
const wasm = new Uint8Array(
  readFileSync(
    join(modules, 'typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'),
  ),
);
const rendererWasm = new Uint8Array(
  readFileSync(
    join(modules, 'typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm'),
  ),
);
const FONTS = [
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-Italic.otf',
  'LibertinusSerif-BoldItalic.otf',
  'DejaVuSansMono.ttf',
  'DejaVuSansMono-Bold.ttf',
].map(bundledFontFile);

const compiler = createTypstCompiler({
  createWorker: () => new LoopbackWorker(),
  compilerWasm: async () => wasm,
});
const renderer = createPageRenderer({rendererWasm: async () => rendererWasm});

/** A copy with half the pixels; `keepSize` writes the resolution that keeps the placed size. */
const halve = (keepSize: boolean) => async (bytes: Uint8Array) => {
  // The stand-in files of the vault also hold JPEGs; only PNG is halved here.
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const half = png(
    Math.max(1, Math.round(pngWidth(bytes) / 2)),
    Math.max(1, Math.round(pngHeight(bytes) / 2)),
  );
  return keepSize ? withDensity(half, scaledDensity(null, 0.5)) : half;
};
const pngWidth = (b: Uint8Array) =>
  new DataView(b.buffer, b.byteOffset).getUint32(16);
const pngHeight = (b: Uint8Array) =>
  new DataView(b.buffer, b.byteOffset).getUint32(20);

/** Page counts of the export (PDF) and of the preview (vector) for one converted note. */
async function counts(
  converted: Awaited<ReturnType<typeof run>>,
  noteName: string,
  downsample: (bytes: Uint8Array) => Promise<Uint8Array | null>,
  assets: (path: string) => Uint8Array,
  fonts: readonly Uint8Array[],
) {
  const read = async (path: string) => assets(path);
  const exportRequest = await buildPreviewRequest({
    noteName,
    typ: converted.typ,
    uses: converted.assets,
    template: null,
    fonts,
    readAsset: read,
    downsample: async () => null,
  });
  const previewRequest = await buildPreviewRequest({
    noteName,
    typ: converted.typ,
    uses: converted.assets,
    template: null,
    fonts,
    readAsset: read,
    downsample: async (bytes) => downsample(bytes),
  });
  const pdf = await compiler.compile(exportRequest);
  if (!pdf.ok) throw new Error(pdf.error);
  const vector = await compiler.compileVector(previewRequest);
  if (!vector.ok) throw new Error(vector.error);
  const doc = await renderer.open(vector.vector);
  return {
    exported: readPdfPages(pdf.pdf),
    pageCount: doc.pageCount,
    firstPage: doc.pageSize(1),
    request: previewRequest,
    dispose: () => doc.dispose(),
  };
}

const vault = listFiles(SAMPLE_DIR).map((f) => `${VAULT}/${f}`);

describe('US-012 AC-13 preview page count equals export page count', () => {
  for (const name of Object.keys(
    BUILTIN_PAGE_PRESETS,
  ) as (keyof typeof BUILTIN_PAGE_PRESETS)[]) {
    it(`US-012 AC-13: the reference input in preset "${name}" has as many preview pages as exported pages`, async () => {
      const page = resolvePageSetup(BUILTIN_PAGE_PRESETS[name]);
      if (!page.ok) throw new Error('valid');
      const converted = await run(
        readSample('Book.md'),
        {
          noteName: 'Book',
          notePath: `${VAULT}/Book.md`,
          settings: {...SETTINGS, page: page.value},
          assets: new FakeIndex(vault),
        },
        vault,
      );
      const result = await counts(
        converted,
        'Book',
        halve(true),
        standIn,
        FONTS,
      );
      expect(result.exported.length).toBeGreaterThan(10);
      expect(result.pageCount).toBe(result.exported.length);
      result.dispose();
    }, 300_000);
  }

  it('US-012 AC-13: a note with a cover and a custom heading font has the same page count, page 1 is the cover page with its slug and the request holds the cover image', async () => {
    const page = resolvePageSetup({
      ...BUILTIN_PAGE_PRESETS['A5 print'],
      slug: 5,
    });
    if (!page.ok) throw new Error('valid');
    const COVER = 'Sample/assets/cover.png';
    const index = new FakeIndex([NOTE_PATH, COVER]);
    index.images.set(COVER, png(20, 30));
    const converted = await run(
      '![](assets/cover.png)\n\n# The Handbook\n\nSome text.\n',
      {
        settings: {
          ...SETTINGS,
          page: page.value,
          cover: {...DEFAULT_COVER},
          fonts: {...DEFAULT_FONTS, heading: {family: VAULT_FAMILY, size: 18}},
        },
        assets: index,
      },
      [NOTE_PATH, COVER],
    );
    const result = await counts(
      converted,
      'Rules',
      halve(true),
      () => png(20, 30),
      [...FONTS, vaultTestFont()],
    );
    expect(result.exported.length).toBeGreaterThanOrEqual(2);
    expect(result.pageCount).toBe(result.exported.length);
    expect(
      [mm(result.firstPage.width), mm(result.firstPage.height)].map(Math.round),
    ).toEqual([164, 226]);
    expect(Object.keys(result.request.files)).toContain('assets/cover.png');
    result.dispose();
  }, 120_000);

  it('US-012 AC-13: a downsampler that drops the resolution is caught: 40 images of 200×280 px give a different page count', async () => {
    const source = Array.from({length: 40}, () => '![](assets/big.png)').join(
      '\n\n',
    );
    const FILE = 'Sample/assets/big.png';
    const index = new FakeIndex([NOTE_PATH, FILE]);
    index.images.set(FILE, png(200, 280));
    const converted = await run(source, {assets: index}, [NOTE_PATH, FILE]);
    const good = await counts(
      converted,
      'Rules',
      halve(true),
      () => png(200, 280),
      FONTS,
    );
    const bad = await counts(
      converted,
      'Rules',
      halve(false),
      () => png(200, 280),
      FONTS,
    );
    expect(good.pageCount).toBe(good.exported.length);
    expect(bad.pageCount).not.toBe(bad.exported.length);
    good.dispose();
    bad.dispose();
  }, 120_000);
});
