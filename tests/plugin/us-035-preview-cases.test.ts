// US-035 AC-1, AC-2, AC-3, AC-9, AC-10 — the preview's cases (SCAR-019): box
// values 0, 11, 16, 45, 46 and `varies`; tracks default, full, `none` and an
// unknown label; colour and grayscale; a missing value as —; an attack
// without dice highlighted; the parts drawn in the shared model's order; the
// heading above the block and the quote test of the context.
// Source of truth: docs/user-stories/US-035-entry-block-preview-in-obsidian.md.
// Added at G4 of #134 (2026-11-07).
import {describe, expect, it} from 'vitest';
import {statblockModel} from '../../src/core/entries/model';
import {STATBLOCK_BUILTINS} from '../../src/core/markers';
import {
  createEntryProcessor,
  headingAbove,
  inQuote,
  type PreviewDeps,
} from '../../src/plugin/entries/processor';
import {ENTRIES} from '../support/entries';
import {FakeEl} from '../support/fake-obsidian';

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z" fill="#000"/></svg>';

function render(
  source: string,
  settings: {entries?: unknown; colorMode?: string} | null = {entries: ENTRIES},
): Promise<FakeEl> {
  const deps: PreviewDeps = {
    settings: async () => settings,
    readIcon: async (p) => (p.includes('gone') ? null : ICON),
    heading: () => 'Fen Hare',
    fileName: () => 'Rules',
    inContainer: () => false,
  };
  const el = new FakeEl();
  return createEntryProcessor(deps)
    .handler(source, el, {})
    .then(() => el);
}
const all = (el: FakeEl): string =>
  [el.text, ...el.descendants().map((x) => x.text)].join(' ');
const withClass = (el: FakeEl, cls: string): FakeEl[] =>
  el.descendants().filter((x) => x.classes.has(cls));
const yaml = (...lines: string[]): string => lines.join('\n') + '\n';

describe('US-035 AC-10 box values', () => {
  const cases: [string, number, string | null][] = [
    ['0', 0, null],
    ['11', 11, null],
    ['16', 16, null],
    ['45', 45, null],
    ['46', 0, 'STAT_BOXES_MANY: 46'],
    ['varies', 0, 'STAT_BOXES_NOT_NUMBER'],
  ];
  for (const [value, boxes, notice] of cases) {
    it(`US-035 AC-10: vigour ${value} → ${boxes} boxes${notice === null ? '' : `, notice ${notice}`}`, async () => {
      const el = await render(yaml(`vigour: ${value}`, 'might: 4'));
      expect(withClass(el, 'o2t-sb-box')).toHaveLength(boxes);
      const notices = withClass(el, 'o2t-sb-notice').map((n) => all(n));
      if (notice === null) expect(notices).toEqual([]);
      else expect(notices.join(' ')).toContain(notice);
    });
  }
});

describe('US-035 AC-10 tracks', () => {
  const cells = async (states: string | null) => {
    const el = await render(
      yaml('might: 4', ...(states === null ? [] : [`states: ${states}`])),
    );
    return {
      el,
      labels: withClass(el, 'o2t-sb-cell').map((c) => c.attrs['aria-label']),
    };
  };
  it('US-035 AC-10: default, full, none', async () => {
    expect((await cells(null)).labels).toEqual([
      'Fine',
      'Hurt',
      'Down',
      'Gone',
    ]);
    expect((await cells('[Fine, Hurt, Down, Fading, Gone]')).labels).toEqual([
      'Fine',
      'Hurt',
      'Down',
      'Fading',
      'Gone',
    ]);
    expect((await cells('none')).labels).toEqual([]);
  });

  it('US-035 AC-10, AC-3: an unknown label warns; a missing icon leaves its cell empty', async () => {
    const {el, labels} = await cells('[Fine, Dazed]');
    expect(labels).toEqual(['Fine']);
    expect(all(el)).toContain('ENTRY_TRACK_UNKNOWN: Dazed');
    const full = await render(yaml('might: 4'));
    const gone = withClass(full, 'o2t-sb-cell').find(
      (c) => c.attrs['aria-label'] === 'Gone',
    );
    expect(gone?.children).toEqual([]);
    const fine = withClass(full, 'o2t-sb-cell')[0];
    const src = fine?.children[0]?.attrs['src'] ?? '';
    // recoloured to the frame colour (here the built-in)
    expect(decodeURIComponent(src)).toContain(
      `fill="${STATBLOCK_BUILTINS.frame.color}"`,
    );
    expect(decodeURIComponent(src)).not.toContain('fill="#000"/');
  });
});

describe('US-035 AC-3, AC-10 colour and grayscale', () => {
  it('US-035 AC-10: grayscale sets #4d4d4d and no fill', async () => {
    const el = await render(yaml('might: 4'), {
      entries: {...ENTRIES, statblock: {...ENTRIES.statblock, fill: '#fbe2c5'}},
      colorMode: 'grayscale',
    });
    const props = withClass(el, 'o2t-sb')[0]?.cssProps ?? {};
    expect(props['--o2t-sb-frame']).toBe('#4d4d4d');
    expect(props['--o2t-sb-fill']).toBe('transparent');
    expect(props['--o2t-sb-box-fill']).toBe('#ffffff');
  });

  it('US-035 AC-3: sizes in em of the editor text (1 pt = 1/10.5 em)', async () => {
    const el = await render(yaml('might: 4'), {
      entries: {
        ...ENTRIES,
        statblock: {...ENTRIES.statblock, sizes: {band: 21}},
      },
    });
    expect(withClass(el, 'o2t-sb')[0]?.cssProps['--o2t-sb-size-band']).toBe(
      '2em',
    );
  });
});

describe('US-035 AC-2 the same rules as the PDF', () => {
  it('US-035 AC-2: the parts are drawn in the model’s order', async () => {
    const data = {
      vigour: 11,
      might: 4,
      wits: 2,
      speed: 5,
      move: 3,
      attacks: ['Kick: 2d6'],
      skills: ['Quick Step'],
      tags: ['beast'],
    };
    const model = statblockModel(data, ENTRIES, {
      heading: 'Fen Hare',
      fileName: 'Rules',
      missing: 'dash',
    });
    const el = await render(
      yaml(
        'vigour: 11',
        'might: 4',
        'wits: 2',
        'speed: 5',
        'move: 3',
        'attacks: ["Kick: 2d6"]',
        'skills: [Quick Step]',
        'tags: [beast]',
      ),
    );
    const CLASS: Record<string, string> = {
      band: 'o2t-sb-band',
      boxes: 'o2t-sb-boxrow',
      track: 'o2t-sb-track',
      attributes: 'o2t-sb-attributes',
      traits: 'o2t-sb-traits',
      attacks: 'o2t-sb-attacks',
      skills: 'o2t-sb-skills',
      tags: 'o2t-sb-tags',
    };
    const root = withClass(el, 'o2t-sb')[0] as FakeEl;
    const drawn = root.children.map(
      (c) => Object.entries(CLASS).find(([, cls]) => c.classes.has(cls))?.[0],
    );
    expect(drawn).toEqual(model?.parts);
  });

  it('US-035 AC-2: a missing value is shown as —; an attack without dice is highlighted', async () => {
    const el = await render(yaml('might: 4', 'attacks: [Stare]'));
    expect(all(el)).toContain('Might 4 · Wits — · Speed —');
    expect(withClass(el, 'o2t-sb-nodice')).toHaveLength(1);
    expect(all(el)).toContain('STAT_ATTACK_NO_DICE: "Stare"');
  });

  it('US-035 AC-2: bold and italic as in the PDF, links as their text', async () => {
    const el = await render(
      yaml('might: "**4**"', 'attacks: ["*Bite* [[Rules#Bite|bite]]: 1d6"]'),
    );
    expect(el.descendants().some((x) => x.tag === 'strong')).toBe(true);
    expect(el.descendants().some((x) => x.tag === 'em')).toBe(true);
    expect(all(el)).toContain('bite');
    expect(all(el)).not.toContain('[[');
  });
});

describe('US-035 AC-1, AC-9 the block’s place', () => {
  const note = [
    '# Menagerie', // 0
    '```', // 1
    '# not a heading', // 2
    '```', // 3
    '### Fen [[Hare]] *quick*', // 4
    '', // 5
    '```o2t-entry', // 6
    '> ```o2t-entry', // 7
  ];
  it('US-035 AC-1: the nearest heading above, as plain text; fences skipped', () => {
    expect(headingAbove(note, 6)).toBe('Fen Hare quick');
    expect(headingAbove(note, 3)).toBe('Menagerie');
    expect(headingAbove(note, 0)).toBeNull();
  });
  it('US-035 AC-9: a block in a quote or callout', () => {
    expect(inQuote(note, 7)).toBe(true);
    expect(inQuote(note, 6)).toBe(false);
  });
});
