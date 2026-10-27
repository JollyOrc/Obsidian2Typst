// CLAUDE.md rules 9 and 10 — the init.d state directory exists, the SCAR ledger
// is append-only in form (one entry per gate, gates named G0 to G5), and the
// next-action file has the fields the bootloader reconciles. Content is not
// judged here; its presence and shape are.
import {existsSync, readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const read = (name: string) => readFileSync(`docs/state/${name}`, 'utf8');

// TICKET-074: docs/state/ is not published (US-024 D9); the four tests that
// read it run where it exists and skip in a public copy. The CLAUDE.md test
// runs everywhere.

describe('init.d state directory (CLAUDE.md rules 9 to 11)', () => {
  it.skipIf(!existsSync('docs/state'))(
    'has the governance file, the SCAR ledger and the next-action file',
    () => {
      for (const name of [
        '00_governance.md',
        '30_scar_checks.md',
        '99_next_action.md',
      ])
        expect(existsSync(`docs/state/${name}`), name).toBe(true);
    },
  );

  it.skipIf(!existsSync('docs/state'))(
    'keeps every ledger entry under a heading that names its date and gate',
    () => {
      const headings = read('30_scar_checks.md')
        .split('\n')
        .filter((line) => line.startsWith('## '));
      expect(headings.length).toBeGreaterThan(0);
      for (const heading of headings)
        expect(heading, heading).toMatch(/^## \d{4}-\d{2}-\d{2} · G[0-5] · /);
    },
  );

  it.skipIf(!existsSync('docs/state'))(
    'gives each ledger entry a result for SCARs (ok, gap or n/a)',
    () => {
      const entries = read('30_scar_checks.md').split(/^## /m).slice(1);
      for (const entry of entries)
        expect(entry, entry.split('\n')[0]).toMatch(/SCAR-\d{3}/);
    },
  );

  it.skipIf(!existsSync('docs/state'))(
    'has the fields the bootloader reconciles in the next-action file',
    () => {
      const text = read('99_next_action.md');
      for (const field of [
        'Current Target',
        'Last Completed Step',
        'Next Permitted Action',
        'SCAR gate due',
      ])
        expect(text, field).toContain(field);
    },
  );

  it('is named in CLAUDE.md with the gates G0 to G5 and the bootloader rule', () => {
    const claude = readFileSync('CLAUDE.md', 'utf8');
    for (const gate of ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'])
      expect(claude, gate).toContain(`**${gate}**`);
    expect(claude).toContain('docs/state/*.md');
  });
});
