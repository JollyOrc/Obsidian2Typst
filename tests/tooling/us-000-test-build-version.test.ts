// TICKET-026 / SCAR-012 — a test build has its own version, the app shows it,
// the check text names it, and the install script proves that the installed
// file is the fresh build.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {installBuild} from '../../build/install-scratch.mjs';
import {readCheck} from '../support/manual-checks';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as {
  version: string;
};
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  version: string;
  scripts: Record<string, string>;
};
const tab = readFileSync('src/plugin/settings/settings-tab.ts', 'utf8');

describe('TICKET-026 version of a test build', () => {
  it('SCAR-012: manifest and package have the same version', () => {
    expect(manifest.version).toBe(pkg.version);
  });

  it('SCAR-012: the version is a release x.y.z or a test build x.y.z-<check>.<n>', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+(-[a-z0-9]+\.\d+)?$/);
  });

  it('SCAR-012: the settings tab shows the version of the manifest it was loaded with', () => {
    expect(tab).toContain('manifest.version');
    expect(tab).toContain('Obsidian2Typst ');
  });

  it('SCAR-012: M2, M3, M6 to M18 name where they run and the version to expect, and M3, M6 to M18 name the current one', () => {
    // SCAR-029: each check is a file of its own, so each is read on its own
    // (before the split a section ran to the end of the one file).
    const ids = [
      'M2',
      'M3',
      ...Array.from({length: 13}, (_, i) => `M${i + 6}`),
    ];
    expect(ids.at(-1)).toBe('M18');
    for (const id of ids) {
      const section = readCheck(id).replace(/\s+/g, ' ');
      expect(section, id).toContain('Expected version');
      expect(section, id).toContain('scratch vault');
      if (id !== 'M2') {
        expect(section, id).toContain(`\`${manifest.version}\``);
      }
    }
  });

  it('SCAR-012: an npm script installs the build into the scratch vault', () => {
    expect(pkg.scripts['install:scratch']).toContain('install-scratch');
  });
});

describe('TICKET-026 installBuild', () => {
  function folders() {
    const root = mkdtempSync(join(tmpdir(), 'o2t-install-'));
    const from = join(root, 'from');
    const to = join(root, 'vault', '.obsidian', 'plugins', 'obsidian2typst');
    mkdirSync(from);
    writeFileSync(join(from, 'main.js'), 'console.log("new build");');
    writeFileSync(
      join(from, 'manifest.json'),
      JSON.stringify({id: 'obsidian2typst', version: '9.9.9-m9.9'}),
    );
    return {from, to};
  }

  it('SCAR-012: creates the folder, copies both files and reports version and checksums', () => {
    const {from, to} = folders();
    const result = installBuild({from, to});
    expect(readFileSync(join(to, 'main.js'), 'utf8')).toBe(
      'console.log("new build");',
    );
    expect(result.version).toBe('9.9.9-m9.9');
    expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('US-012: the style sheet is copied intact when the build has one, and is not required', () => {
    const {from, to} = folders();
    installBuild({from, to});
    expect(existsSync(join(to, 'styles.css'))).toBe(false);
    writeFileSync(join(from, 'styles.css'), '.o2t-panel {}');
    installBuild({from, to});
    expect(readFileSync(join(to, 'styles.css'), 'utf8')).toBe('.o2t-panel {}');
  });

  it('SCAR-012: replaces an older build', () => {
    const {from, to} = folders();
    mkdirSync(to, {recursive: true});
    writeFileSync(join(to, 'main.js'), 'old');
    writeFileSync(join(to, 'manifest.json'), '{"version":"0.0.1"}');
    installBuild({from, to});
    expect(readFileSync(join(to, 'main.js'), 'utf8')).toContain('new build');
    expect(readFileSync(join(to, 'manifest.json'), 'utf8')).toContain('9.9.9');
  });

  it('SCAR-012: fails when a source file is missing and does not leave a half install', () => {
    const {from, to} = folders();
    writeFileSync(join(from, 'manifest.json'), '');
    expect(() => installBuild({from: join(from, 'none'), to})).toThrow(
      /main\.js/,
    );
  });
});
