// US-029 AC-3 — a toggle shows the value an export would use: the preset's
// when it sets the field, else the Defaults', else the built-in value. The
// G0 defect: an unset field with a built-in `true` was shown off. Source of
// truth: docs/user-stories/US-029-settings-screen-and-menu-marking.md.
import {describe, expect, it} from 'vitest';

/** US-029: the shape of the function that does not exist yet (red until the code). */
interface OwnerModule {
  effectiveValue(
    presetFields: unknown,
    defaults: unknown,
    path: readonly string[],
  ): unknown;
}

const OWNER = '../../src/core/presets/owner';
const load = async (): Promise<OwnerModule> =>
  (await import(/* @vite-ignore */ OWNER)) as OwnerModule;

describe('US-029 AC-3 the effective value (SCAR-019: unset, true, false, built-in false, owned)', () => {
  it.each([
    [
      'externalLinkFootnotes unset (built-in true)',
      {},
      {},
      ['externalLinkFootnotes'],
      true,
    ],
    [
      'externalLinkFootnotes true',
      {},
      {externalLinkFootnotes: true},
      ['externalLinkFootnotes'],
      true,
    ],
    [
      'externalLinkFootnotes false',
      {},
      {externalLinkFootnotes: false},
      ['externalLinkFootnotes'],
      false,
    ],
    [
      'book.romanFrontMatter unset (built-in false)',
      {},
      {},
      ['book', 'romanFrontMatter'],
      false,
    ],
    [
      'page.folios: Defaults true, preset false',
      {page: {folios: false}},
      {page: {folios: true}},
      ['page', 'folios'],
      false,
    ],
    ['page.facingPages unset', {}, {}, ['page', 'facingPages'], true],
  ] as const)(
    'US-029 AC-3: %s',
    async (_name, preset, defaults, path, expected) => {
      const {effectiveValue} = await load();
      expect(effectiveValue(preset, defaults, path)).toBe(expected);
    },
  );

  it('US-029 AC-3: every toggle row of the story shows its built-in value when nothing sets it', async () => {
    const {effectiveValue} = await load();
    const builtins: [string[], boolean][] = [
      [['page', 'facingPages'], true],
      [['page', 'folios'], true],
      [['page', 'runningHeader'], true],
      [['linkPageNumbers'], true],
      [['externalLinkFootnotes'], true],
      [['book', 'romanFrontMatter'], false],
      [['toc', 'pageNumbers'], true],
      [['toc', 'dotLeaders'], true],
    ];
    for (const [path, value] of builtins) {
      expect(effectiveValue({}, {}, path), path.join('.')).toBe(value);
    }
  });

  it('US-029 AC-3: the Defaults count when the preset leaves the field unset; the preset when it sets it', async () => {
    const {effectiveValue} = await load();
    expect(
      effectiveValue({page: {bleed: 3}}, {page: {folios: false}}, [
        'page',
        'folios',
      ]),
    ).toBe(false);
    expect(
      effectiveValue({toc: {dotLeaders: true}}, {toc: {dotLeaders: false}}, [
        'toc',
        'dotLeaders',
      ]),
    ).toBe(true);
  });
});
