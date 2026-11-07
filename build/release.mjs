// The release build: turns the commit to release into the files of a GitHub
// release, the same way every time (docs/process/release.md). Run with
// `npm run release:build` (a clean clone of HEAD, the full gate there) or
// `node build/release.mjs` (the working tree as it is, no gate; for a try).
//
// What it does:
// 1. checks the versions: `manifest.json` and `package.json` agree, the
//    version is a release (`x.y.z`, not a test build `x.y.z-m21.1`),
//    `versions.json` maps it to `minAppVersion`, `releases/v<x.y.z>.md`
//    exists with a release date, and `releases/RELEASES.md` lists it;
// 2. with `--clean`: refuses a working tree with uncommitted changes, clones
//    HEAD into a temporary folder, `npm ci`; with `--gate` also runs
//    typecheck, lint, `npm test` and `npm run test:integration` there;
// 3. builds `main.js` (in the clone, or here);
// 4. writes `dist/release/<x.y.z>/`: `main.js`, `manifest.json`,
//    `styles.css`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, the zip
//    `artefact-v<x.y.z>.zip` of those five, `SHA256SUMS.txt` and
//    `notes.md` (the release notes without their title, for GitHub);
// 5. prints the checksums and the command that publishes the release. It
//    never tags, pushes or publishes: those stay a person's decision.
//
// The zip is written here without a dependency (deflate from `node:zlib`),
// with a fixed timestamp, so the same files give the same zip.
/* global Buffer, console, process */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {crc32, deflateRawSync} from 'node:zlib';

/** The files of a release, in the order they go into the zip. */
export const RELEASE_FILES = [
  'main.js',
  'manifest.json',
  'styles.css',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
];

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/**
 * Checks that the tree at `root` is ready to be released; returns the
 * version and the minimum app version. Throws one error naming every
 * problem found. `testBuild: true` accepts a test build version and skips
 * the release notes (for trying the script on a test build).
 */
export function checkRelease(root, {testBuild = false} = {}) {
  const problems = [];
  const manifest = readJson(join(root, 'manifest.json'));
  const pkg = readJson(join(root, 'package.json'));
  const versions = readJson(join(root, 'versions.json'));
  const version = String(manifest.version);
  if (pkg.version !== version) {
    problems.push(
      `package.json has version ${pkg.version}, manifest.json ${version}`,
    );
  }
  const release = /^\d+\.\d+\.\d+$/.test(version);
  if (
    !release &&
    !(testBuild && /^\d+\.\d+\.\d+-[a-z0-9]+\.\d+$/.test(version))
  ) {
    problems.push(
      `version ${version} is not a release (x.y.z); set it before building`,
    );
  }
  const base = version.replace(/-.*$/, '');
  if (versions[base] !== manifest.minAppVersion) {
    problems.push(
      `versions.json does not map ${base} to ${manifest.minAppVersion}`,
    );
  }
  if (!testBuild) {
    const notes = join(root, 'releases', `v${base}.md`);
    if (!existsSync(notes)) {
      problems.push(`releases/v${base}.md is missing`);
    } else if (
      !/^\*\*Release date:\*\* \d{4}-\d{2}-\d{2}\s*$/m.test(
        readFileSync(notes, 'utf8'),
      )
    ) {
      problems.push(`releases/v${base}.md has no release date`);
    }
    const table = join(root, 'releases', 'RELEASES.md');
    if (
      !existsSync(table) ||
      !readFileSync(table, 'utf8').includes(`| v${base} |`)
    ) {
      problems.push(`releases/RELEASES.md does not list v${base}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Not ready to release:\n- ${problems.join('\n- ')}`);
  }
  return {version, minAppVersion: manifest.minAppVersion};
}

/** A DOS date and time: 1980-01-01 00:00, so the zip does not depend on when it is made. */
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/**
 * A zip archive of `entries` ({name, data}), each deflated, with a fixed
 * timestamp and no extra fields. Names are written as given (UTF-8).
 */
export function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const {name, data} of entries) {
    const raw = Buffer.from(data);
    const packed = deflateRawSync(raw, {level: 9});
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(raw) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4); // made by: Unix, 3.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // -rw-r--r--
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/**
 * Copies the release files from `from` to `out` (emptied first), writes the
 * zip, `SHA256SUMS.txt` and `notes.md`; returns the checksums by file name.
 */
export function assembleRelease({from, out, version}) {
  const data = RELEASE_FILES.map((name) => ({
    name,
    data: readFileSync(join(from, name)),
  }));
  rmSync(out, {recursive: true, force: true});
  mkdirSync(out, {recursive: true});
  for (const {name, data: bytes} of data) writeFileSync(join(out, name), bytes);
  const zipName = `artefact-v${version}.zip`;
  writeFileSync(join(out, zipName), makeZip(data));
  const sums = {};
  for (const name of [zipName, ...RELEASE_FILES]) {
    sums[name] = sha256(readFileSync(join(out, name)));
  }
  writeFileSync(
    join(out, 'SHA256SUMS.txt'),
    Object.entries(sums)
      .map(([name, sum]) => `${sum}  ${name}`)
      .join('\n') + '\n',
  );
  const notes = join(from, 'releases', `v${version.replace(/-.*$/, '')}.md`);
  if (existsSync(notes)) {
    // GitHub shows the release's title; the notes start after the heading.
    const text = readFileSync(notes, 'utf8').replace(/^# [^\n]*\n+/, '');
    writeFileSync(join(out, 'notes.md'), text);
  }
  return {zip: zipName, sums};
}

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, {cwd, stdio: 'inherit'});

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Set(process.argv.slice(2));
  const clean = args.has('--clean');
  const gate = args.has('--gate');
  const root = join(import.meta.dirname, '..');
  try {
    const {version} = checkRelease(root, {testBuild: args.has('--test-build')});
    let from = root;
    let temp = null;
    if (clean) {
      const dirty = execFileSync('git', ['status', '--porcelain'], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
      if (dirty !== '') {
        throw new Error(
          'The working tree has uncommitted changes; commit them first (a clean build is of HEAD).',
        );
      }
      const head = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
      temp = mkdtempSync(join(tmpdir(), 'o2t-release-'));
      console.log(`Cloning ${head.slice(0, 7)} into ${temp}`);
      run('git', ['clone', '--quiet', root, temp], root);
      run('git', ['checkout', '--quiet', head], temp);
      run('npm', ['ci', '--silent'], temp);
      from = temp;
      if (gate) {
        for (const script of [
          'typecheck',
          'lint',
          'test',
          'test:integration',
        ]) {
          console.log(`Gate: npm run ${script}`);
          run('npm', ['run', '-s', script], temp);
        }
      }
    } else if (gate) {
      throw new Error(
        '--gate needs --clean (the gate runs in the clean clone).',
      );
    }
    const {buildPlugin} = await import(join(from, 'build/build-plugin.mjs'));
    await buildPlugin({outfile: join(from, 'main.js'), logLevel: 'warning'});
    const out = join(root, 'dist', 'release', version);
    const {zip, sums} = assembleRelease({from, out, version});
    if (temp !== null) rmSync(temp, {recursive: true, force: true});
    console.log(
      `\nRelease ${version} in ${out}${clean ? ' (built from a clean clone of HEAD)' : ' (built from the working tree)'}`,
    );
    for (const [name, sum] of Object.entries(sums))
      console.log(`${sum}  ${name}`);
    const files = [zip, ...RELEASE_FILES]
      .map((f) => `"${join(out, f)}"`)
      .join(' ');
    console.log(
      `\nTo publish (after the tag ${version} is pushed):\n` +
        `gh release create ${version} --verify-tag --title "Obsidian2Typst ${version}" --notes-file "${join(out, 'notes.md')}" ${files}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
