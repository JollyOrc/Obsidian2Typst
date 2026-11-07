// US-032 AC-5, AC-6, AC-8 — a `full-image` entry whose text fits its left
// page ends on its image page: no overflow is reported and the next page is
// not headed "(continued)". Found in M21 (2026-11-07): the end marker came
// after the image page, so the next entry's page (Dune Lark) read
// "Bog Wight (continued)" and the report said "about 1 lines over".
// Source of truth: docs/user-stories/US-032-entry-fit-overflow-and-auto-layout.md.
import {afterAll, describe, expect, it} from 'vitest';
import {entry} from '../support/entries';
import {compileEntries, disposeEntriesCompiler} from '../support/entries-pdf';
import {png} from '../support/images';

afterAll(disposeEntriesCompiler);

describe('US-032 AC-6 a full-image entry that fits its left page', () => {
  it('US-032 AC-6, AC-8: ends on its image page; the next page is not "(continued)"', async () => {
    const source = [
      '# Menagerie',
      '',
      entry(
        '### Bog Wight',
        [
          'might: 5',
          'layout: full-image',
          'illustration: "![](assets/e-square.png)"',
        ],
        ['A short opening paragraph for the wight, long enough to count.'],
      ),
      '',
      entry(
        '### Dune Lark',
        ['might: 4', 'layout: spread-text'],
        ['A short opening paragraph for the lark, long enough to count.'],
      ),
    ].join('\n');
    const c = await compileEntries(source, {
      over: {headingRules: {Menagerie: 'entries'}},
      images: {'Sample/assets/e-square.png': png(600, 600)},
    });
    const wight = c.places.find((p) => p.heading === 'Bog Wight');
    const end = c.ends.find((e) => e.heading === 'Bog Wight');
    expect(wight?.layout).toBe('full-image');
    expect(end?.page).toBe((wight?.page ?? 0) + 1);
    expect(end?.overflowLines ?? 0).toBe(0);
    const lark = c.places.find((p) => p.heading === 'Dune Lark');
    expect(lark?.page).toBe((wight?.page ?? 0) + 2);
    const larkPage = c.pages[(lark?.page ?? 1) - 1];
    expect(larkPage?.header ?? '').not.toContain('(continued)');
  });
});
