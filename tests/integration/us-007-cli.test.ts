// US-007 AC-5 — the generated .typ also compiles with the official typst CLI.
// The CLI is not installed in every environment: the test is skipped there and
// TICKET-019 (item "typst CLI in CI") carries the follow-up, so a skipped run
// is never mistaken for a pass.
import {spawnSync} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, describe, expect, it} from 'vitest';
import {createAssetResolver} from '../../src/core/assets';
import {FIT_IMAGE_HELPER} from '../../src/core/emit';
import {blocks} from '../support/blocks';
import {png} from '../support/images';

const version = spawnSync('typst', ['--version'], {encoding: 'utf8'});
const available = version.status === 0;
const tmp = mkdtempSync(join(tmpdir(), 'o2t-us007-cli-'));
afterAll(() => rmSync(tmp, {recursive: true, force: true}));

const MD = [
  '# Rules',
  '',
  'Some *text* with a footnote[^1] and a list:',
  '',
  '- one',
  '- two',
  '',
  '![[crypt.png|200]]',
  '',
  '[^1]: The note.',
].join('\n');

describe('US-007 AC-5: the official typst CLI', () => {
  it.skipIf(!available)(
    'US-007 AC-5: typst compile accepts the generated .typ (skipped without the CLI: TICKET-019)',
    () => {
      const major = /typst (\d+\.\d+)/.exec(version.stdout)?.[1];
      expect(major, version.stdout).toBe('0.14');
      const resolver = createAssetResolver({
        notePath: 'N/Rules.md',
        files: new Map([['N/assets/crypt.png', png(4, 4).subarray(0, 16)]]),
      });
      const out = blocks(MD, {assets: resolver});
      mkdirSync(join(tmp, 'assets'), {recursive: true});
      writeFileSync(join(tmp, 'assets/crypt.png'), png(40, 40));
      writeFileSync(
        join(tmp, 'Rules.typ'),
        `${FIT_IMAGE_HELPER}\n${out.typ}\n`,
      );
      const run = spawnSync(
        'typst',
        [
          'compile',
          '--root',
          tmp,
          join(tmp, 'Rules.typ'),
          join(tmp, 'Rules.pdf'),
        ],
        {encoding: 'utf8'},
      );
      expect(run.status, run.stderr).toBe(0);
      expect(existsSync(join(tmp, 'Rules.pdf'))).toBe(true);
    },
  );

  it('US-007 AC-5: when the CLI is missing, the skip is explained by a ticket item', async () => {
    if (available) return;
    const {readFileSync} = await import('node:fs');
    const ticket = readFileSync(
      'docs/tickets/TICKET-019-in-plugin-compilation.md',
      'utf8',
    );
    expect(ticket).toContain('typst CLI in CI');
  });
});
