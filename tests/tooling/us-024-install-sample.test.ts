// US-024 AC-8 — the generated vault for the manual checks: the install script
// copies it into the scratch vault as `Sample/`, and the checks name it.
// Source of truth: docs/user-stories/US-024-synthetic-public-fixture.md.
import {createHash} from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import * as install from '../../build/install-scratch.mjs';
import {SAMPLE_DIR, VAULT, listFiles} from '../support/sample';

const VAULT_NAME = ['The', 'Rules'].join(' ');

type InstallSample = (options: {from: string; to: string}) => {
  files: number;
};
/** The function the ticket adds; looked up at run time to keep tsc green. */
const installSample = (): InstallSample => {
  const fn = (install as Record<string, unknown>)['installSample'];
  if (typeof fn !== 'function') throw new Error('installSample is missing');
  return fn as InstallSample;
};

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, {recursive: true, force: true});
});
const sha = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

describe('US-024 AC-8 the sample vault in the scratch vault', () => {
  it('US-024 AC-8: installSample copies every file of the sample vault intact', () => {
    const vault = mkdtempSync(join(tmpdir(), 'o2t-us024-vault-'));
    temps.push(vault);
    const to = join(vault, VAULT);
    const result = installSample()({from: SAMPLE_DIR, to});
    const files = listFiles(SAMPLE_DIR);
    expect(result.files).toBe(files.length);
    expect(listFiles(to)).toEqual(files);
    for (const f of files) {
      expect(sha(join(to, f)), f).toBe(sha(join(SAMPLE_DIR, f)));
    }
  });

  it('US-024 AC-8: a file left from an older sample in Sample/ is removed', () => {
    const vault = mkdtempSync(join(tmpdir(), 'o2t-us024-vault-'));
    temps.push(vault);
    const to = join(vault, VAULT);
    mkdirSync(join(to, 'old'), {recursive: true});
    writeFileSync(join(to, 'old', 'stray.md'), 'from an older sample\n');
    installSample()({from: SAMPLE_DIR, to});
    expect(listFiles(to)).toEqual(listFiles(SAMPLE_DIR));
  });

  it('US-024 AC-8: `npm run install:scratch` installs the sample vault as Sample/', () => {
    const script = readFileSync('build/install-scratch.mjs', 'utf8');
    expect(script).toMatch(
      /installSample\(\{\s*from: join\(root, 'tests\/fixtures\/sample'\),\s*to: join\(root, 'spikes\/typst-wasm\/scratch-vault\/Sample'\),?\s*\}\)/,
    );
  });

  it('US-024 AC-8: the manual checks name the sample vault, never the private one', () => {
    const checks = readFileSync('docs/technical/manual-checks.md', 'utf8');
    expect(checks).not.toContain(VAULT_NAME);
    expect(checks).not.toContain('compiledtext');
    expect(checks).toContain(`${VAULT}/Book.md`);
  });
});
