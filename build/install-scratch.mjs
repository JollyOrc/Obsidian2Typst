// SCAR-012: puts the fresh build where the human runs the manual check and
// proves by checksum that the installed file is the fresh one. Run with
// `npm run install:scratch`.
/* global console, process */
import {createHash} from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {buildPlugin} from './build-plugin.mjs';

const FILES = ['main.js', 'manifest.json'];
/** US-012: copied when the build has it (the style panel's sheet). */
const OPTIONAL = ['styles.css'];
const sha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

/**
 * Copies `main.js`, `manifest.json` and, when present, `styles.css` from `from` to `to` (created when
 * missing) and checks every copy against its source. Reads all sources first,
 * so a missing file leaves the target untouched.
 */
export function installBuild({from, to}) {
  for (const name of FILES) readFileSync(join(from, name));
  mkdirSync(to, {recursive: true});
  const names = [
    ...FILES,
    ...OPTIONAL.filter((n) => existsSync(join(from, n))),
  ];
  for (const name of names) {
    copyFileSync(join(from, name), join(to, name));
    if (sha256(join(from, name)) !== sha256(join(to, name))) {
      throw new Error(`${name} was not copied intact`);
    }
  }
  const {version} = JSON.parse(readFileSync(join(to, 'manifest.json'), 'utf8'));
  return {version, checksum: sha256(join(to, 'main.js'))};
}

/** Every file below `dir`, relative to it, sorted. */
function filesBelow(dir) {
  const out = [];
  const walk = (at) => {
    for (const entry of readdirSync(at, {withFileTypes: true})) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else out.push(relative(dir, path));
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * US-024 | AC-8: The generated sample vault in the scratch vault.
 *
 * Copies every file below `from` (the committed sample vault) to `to` (the
 * scratch vault's `Sample/` folder) and checks every copy against its source
 * by SHA-256. Reads all sources first, so a missing source leaves the target
 * untouched; then removes the old `to` folder, so a file deleted from the
 * sample does not stay behind (`to` holds generated data only). Returns the
 * number of files copied.
 */
export function installSample({from, to}) {
  const files = filesBelow(from);
  const data = files.map((f) => readFileSync(join(from, f)));
  rmSync(to, {recursive: true, force: true});
  files.forEach((f, i) => {
    mkdirSync(dirname(join(to, f)), {recursive: true});
    writeFileSync(join(to, f), data[i]);
    if (sha256(join(from, f)) !== sha256(join(to, f))) {
      throw new Error(`${f} was not copied intact`);
    }
  });
  return {files: files.length};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(import.meta.dirname, '..');
  await buildPlugin({outfile: join(root, 'main.js'), logLevel: 'warning'});
  const to = join(
    root,
    'spikes/typst-wasm/scratch-vault/.obsidian/plugins/obsidian2typst',
  );
  const result = installBuild({from: root, to});
  console.log(`Installed version ${result.version} into ${to}`);
  console.log(`main.js sha256 ${result.checksum}`);
  const sample = installSample({
    from: join(root, 'tests/fixtures/sample'),
    to: join(root, 'spikes/typst-wasm/scratch-vault/Sample'),
  });
  console.log(`Installed the sample vault (${sample.files} files) as Sample/`);
}
