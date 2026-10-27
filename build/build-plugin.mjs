// Builds main.js (CommonJS, desktop). The compiler WASM and the code of the
// compiler worker are embedded as text (US-007 AC-12), so the release is
// main.js, manifest.json and styles.css only.
import {build} from 'esbuild';
import {readdirSync, readFileSync} from 'node:fs';
import {builtinModules} from 'node:module';
import {join} from 'node:path';
import {gzipBase64} from './embed.mjs';

const root = join(import.meta.dirname, '..');
const compilerWasmPath = join(
  root,
  'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
);

const rendererWasmPath = join(
  root,
  'node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
);

/** The default fonts (US-007 AC-13): every .otf and .ttf of assets/fonts. */
const fontsDir = join(root, 'assets/fonts');
const defaultFonts = () =>
  readdirSync(fontsDir)
    .filter((name) => /\.(otf|ttf)$/.test(name))
    .sort()
    .map((name) =>
      gzipBase64(new Uint8Array(readFileSync(join(fontsDir, name)))),
    );

/** Computed once per process: gzip of 28 MB takes a few seconds. */
let cached;
async function embedded() {
  if (cached !== undefined) return cached;
  const worker = await build({
    entryPoints: [join(root, 'src/plugin/compiler/worker.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    banner: {js: '// o2t-worker'},
    legalComments: 'none',
    logLevel: 'warning',
  });
  cached = {
    'compiler-wasm': gzipBase64(new Uint8Array(readFileSync(compilerWasmPath))),
    'renderer-wasm': gzipBase64(new Uint8Array(readFileSync(rendererWasmPath))),
    'worker-source': worker.outputFiles[0].text,
    'default-fonts': defaultFonts(),
  };
  return cached;
}

const embeddedModules = {
  name: 'embedded',
  setup(b) {
    b.onResolve({filter: /^embedded:/}, (args) => ({
      path: args.path.slice('embedded:'.length),
      namespace: 'embedded',
    }));
    b.onLoad({filter: /.*/, namespace: 'embedded'}, async (args) => ({
      contents: `export default ${JSON.stringify((await embedded())[args.path])};`,
      loader: 'js',
    }));
  },
};

/** Builds the plugin bundle into `outfile`. */
export async function buildPlugin({outfile, logLevel = 'info'}) {
  await build({
    entryPoints: [join(root, 'src/plugin/main.ts')],
    outfile,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'es2022',
    sourcemap: false,
    minify: false,
    logLevel,
    plugins: [embeddedModules],
    external: [
      'obsidian',
      'electron',
      '@codemirror/*',
      '@lezer/*',
      ...builtinModules,
      ...builtinModules.map((m) => `node:${m}`),
    ],
  });
}
