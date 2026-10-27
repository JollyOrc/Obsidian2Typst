// TICKET-003: the build produces an installable plugin bundle.
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('TICKET-003 build', () => {
  const build = spawnSync('npm', ['run', 'build'], {encoding: 'utf8'});

  it('TICKET-003: npm run build exits with 0', () => {
    expect(build.status, build.stdout + build.stderr).toBe(0);
  });

  it('TICKET-003: writes main.js as CommonJS with obsidian left external', () => {
    expect(existsSync('main.js')).toBe(true);
    const js = readFileSync('main.js', 'utf8');
    expect(js).toContain('module.exports');
    expect(js).toContain('require("obsidian")');
  });

  it('US-007 AC-13: main.js embeds the default fonts and stays under 25 MB (AC-12)', () => {
    const size = statSync('main.js').size;
    expect(size).toBeGreaterThan(15_000_000);
    expect(size).toBeLessThan(25_000_000);
    const js = readFileSync('main.js', 'utf8');
    expect(js).not.toMatch(/assets\/fonts\/[A-Za-z-]+\.(otf|ttf)/);
  });

  it('TICKET-003: manifest.json is desktop-only and versions.json maps the version', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(manifest).toMatchObject({
      id: 'obsidian2typst',
      name: 'Obsidian2Typst',
      version: pkg.version,
      isDesktopOnly: true,
    });
    for (const key of ['minAppVersion', 'description', 'author']) {
      expect(typeof manifest[key]).toBe('string');
    }
    const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
    // A test build (x.y.z-m3.1, SCAR-012) belongs to the release x.y.z.
    const release = String(manifest.version).replace(/-.*$/, '');
    expect(versions[release]).toBe(manifest.minAppVersion);
  });
}, 60_000);
