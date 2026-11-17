// US-042 AC-3, AC-5, AC-6 — the export dialog drawn with the fake `obsidian`:
// its rows in order, the red and grey lines while the folder is typed, a
// preset change, Choose folder…, the keys, More options, and the one answer
// resolved in `onClose` (SCAR-013, SCAR-016). The look and the focus in
// Obsidian are checked by hand (AC-15). Source of truth:
// docs/user-stories/US-042-ui-standard.md.
import {posix} from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  made,
  resetFake,
  type FakeControl,
  type FakeEl,
  type FakeSetting,
} from '../support/fake-obsidian';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

const MODIFIED = new Date(2026, 10, 17, 14, 2);

interface Drawn {
  titleEl: FakeEl;
  contentEl: FakeEl;
  closed: number;
  onOpen(): void;
  onClose(): void;
  choose(): Promise<{preset: string; folder: string} | null>;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

async function rig(
  options: {
    active?: string;
    folders?: Record<string, string>;
    existing?: string[];
    picked?: string | null;
  } = {},
) {
  resetFake();
  const asked: (string | null)[] = [];
  const statted: string[] = [];
  let settingsOpened = 0;
  const {ExportDialog} = await import('../../src/plugin/export-dialog/dialog');
  const dialog = new ExportDialog({} as never, {
    noteName: 'Book',
    presets: [
      {name: 'A5 print', valid: true, group: null},
      {name: 'Broken', valid: false, group: null},
      {name: 'Proof', valid: true, group: null},
    ],
    activePreset: options.active ?? 'A5 print',
    lastExportFolders: options.folders ?? {'A5 print': '/out/a5'},
    pathApi: posix,
    join: (folder: string, name: string) => posix.join(folder, name),
    modifiedAt: async (path: string) => {
      statted.push(path);
      return (options.existing ?? []).includes(path) ? MODIFIED : null;
    },
    chooseFolder: async (initial: string | null) => {
      asked.push(initial);
      return options.picked === undefined ? null : options.picked;
    },
    openSettings: () => void settingsOpened++,
  }) as unknown as Drawn;
  const answer = dialog.choose();
  dialog.onOpen();
  await flush();
  const rows = made.filter((s) => inside(s.parent, dialog.contentEl));
  return {
    dialog,
    answer,
    rows,
    asked,
    statted,
    settingsOpened: () => settingsOpened,
  };
}

function inside(el: unknown, ancestor: FakeEl): boolean {
  let at = el as FakeEl | null | undefined;
  while (at !== null && at !== undefined) {
    if (at === ancestor) return true;
    at = at.parentElement;
  }
  return false;
}

const byClass = (root: FakeEl, cls: string): FakeEl => {
  const found = root.descendants().find((el) => el.classes.has(cls));
  if (found === undefined) throw new Error(`no .${cls}`);
  return found;
};

const field = (rows: FakeSetting[]): FakeControl => {
  const control = rows[1]?.controls.find((c) => c.kind === 'text');
  if (control === undefined) throw new Error('no folder field');
  return control;
};
const button = (rows: FakeSetting[], text: string) => {
  const found = rows.flatMap((r) => r.buttons).find((b) => b.text === text);
  if (found === undefined) throw new Error(`no button ${text}`);
  return found;
};
const type = async (control: FakeControl, text: string): Promise<void> => {
  control.setValue(text);
  control.changed?.(text as never);
  await flush();
};
const key = (k: string, extra: Record<string, unknown> = {}) => ({
  key: k,
  isComposing: false,
  keyCode: k === 'Enter' ? 13 : 0,
  preventDefault: () => undefined,
  ...extra,
});

describe('US-042 AC-3: the rows of the dialog', () => {
  beforeEach(() => resetFake());

  it('the title names the note', async () => {
    const {dialog} = await rig();
    expect(dialog.titleEl.text).toBe('Export Book');
  });

  it('a heading row with the valid presets, the active one chosen', async () => {
    const {rows} = await rig({active: 'Proof'});
    const preset = rows[0] as FakeSetting;
    expect(preset.heading).toBe(true);
    const dropdown = preset.controls[0] as FakeControl;
    expect(dropdown.kind).toBe('dropdown');
    expect(dropdown.selectEl.options.map((o) => o.value)).toEqual([
      'A5 print',
      'Proof',
    ]);
    expect(dropdown.value).toBe('Proof');
  });

  it('the destination row: the folder field, Choose folder…, then Export', async () => {
    const {rows} = await rig();
    expect(field(rows).value).toBe('/out/a5');
    expect((rows[1] as FakeSetting).buttons.map((b) => b.text)).toEqual([
      'Choose folder…',
      'Export',
    ]);
  });

  it('the row More options with a gear, last', async () => {
    const {rows} = await rig();
    const more = rows.at(-1) as FakeSetting;
    expect(more.name).toBe('More options');
    expect(more.buttons.map((b) => b.icon)).toEqual(['settings']);
    expect(rows).toHaveLength(3);
  });
});

describe('US-042 AC-4, AC-5: the red and the grey line, live (SCAR-016)', () => {
  it('a remembered folder: no red line, the PDF to be written', async () => {
    const {dialog, statted} = await rig();
    expect(byClass(dialog.contentEl, 'o2t-export-error').text).toBe('');
    expect(byClass(dialog.contentEl, 'o2t-export-info').text).toBe(
      'Book.pdf will be written.',
    );
    expect(statted).toContain('/out/a5/Book.pdf');
  });

  it('an existing PDF: its date, and that it will be replaced (no question, O2T-2)', async () => {
    const {dialog} = await rig({existing: ['/out/a5/Book.pdf']});
    expect(byClass(dialog.contentEl, 'o2t-export-info').text).toBe(
      'Book.pdf exists (from 2026-11-17 14:02) and will be replaced.',
    );
  });

  it('a relative folder typed: the red line, Export disabled, no grey line', async () => {
    const {dialog, rows} = await rig();
    await type(field(rows), 'out/a5');
    expect(byClass(dialog.contentEl, 'o2t-export-error').text).toBe(
      'Export folder "out/a5" is not an absolute path.',
    );
    expect(byClass(dialog.contentEl, 'o2t-export-info').text).toBe('');
    expect(button(rows, 'Export').disabled).toBe(true);
  });

  it('typed again into a good folder: the red line goes, Export is enabled', async () => {
    const {dialog, rows} = await rig({existing: ['/out/b/Book.pdf']});
    await type(field(rows), 'out');
    await type(field(rows), '/out/b');
    expect(byClass(dialog.contentEl, 'o2t-export-error').text).toBe('');
    expect(byClass(dialog.contentEl, 'o2t-export-info').text).toBe(
      'Book.pdf exists (from 2026-11-17 14:02) and will be replaced.',
    );
    expect(button(rows, 'Export').disabled).toBe(false);
  });

  it('no remembered folder: the empty field is refused at once', async () => {
    const {dialog, rows} = await rig({folders: {}});
    expect(field(rows).value).toBe('');
    expect(byClass(dialog.contentEl, 'o2t-export-error').text).toBe(
      'Choose an export folder.',
    );
    expect(button(rows, 'Export').disabled).toBe(true);
  });
});

describe('US-042 AC-3: choosing another preset', () => {
  it('puts its remembered folder into the field, at once', async () => {
    const {dialog, rows} = await rig({
      folders: {'A5 print': '/out/a5', Proof: '/out/proof'},
    });
    (rows[0]?.controls[0] as FakeControl).changed?.('Proof' as never);
    await flush();
    expect(field(rows).value).toBe('/out/proof');
    expect(byClass(dialog.contentEl, 'o2t-export-info').text).toBe(
      'Book.pdf will be written.',
    );
  });

  it('a preset without a remembered folder empties the field', async () => {
    const {dialog, rows} = await rig();
    (rows[0]?.controls[0] as FakeControl).changed?.('Proof' as never);
    await flush();
    expect(field(rows).value).toBe('');
    expect(byClass(dialog.contentEl, 'o2t-export-error').text).toBe(
      'Choose an export folder.',
    );
  });
});

describe('US-042 AC-3: Choose folder…', () => {
  it("starts at the field's folder and puts the chosen one into it", async () => {
    const {rows, asked} = await rig({picked: '/picked'});
    await button(rows, 'Choose folder…').clicked?.();
    await flush();
    expect(asked).toEqual(['/out/a5']);
    expect(field(rows).value).toBe('/picked');
  });

  it('an empty field starts the system dialog nowhere; a cancelled dialog changes nothing', async () => {
    const {rows, asked} = await rig({folders: {}, picked: null});
    await button(rows, 'Choose folder…').clicked?.();
    await flush();
    expect(asked).toEqual([null]);
    expect(field(rows).value).toBe('');
  });
});

describe('US-042 AC-6: one answer, given when the dialog closes', () => {
  it('Export closes the dialog and answers the preset and the folder', async () => {
    const {dialog, rows, answer} = await rig();
    await button(rows, 'Export').clicked?.();
    expect(dialog.closed).toBe(1);
    dialog.onClose();
    await expect(answer).resolves.toEqual({
      preset: 'A5 print',
      folder: '/out/a5',
    });
  });

  it('the answer holds what is shown at the click: another preset and a typed folder', async () => {
    const {dialog, rows, answer} = await rig();
    (rows[0]?.controls[0] as FakeControl).changed?.('Proof' as never);
    await flush();
    await type(field(rows), '/out/proof/');
    await button(rows, 'Export').clicked?.();
    dialog.onClose();
    await expect(answer).resolves.toEqual({
      preset: 'Proof',
      folder: '/out/proof',
    });
  });

  it('closed any other way (Escape, the X, a click outside): no answer', async () => {
    const {dialog, answer} = await rig();
    dialog.onClose();
    await expect(answer).resolves.toBeNull();
  });

  it('Enter runs Export while it is enabled', async () => {
    const {dialog, answer} = await rig();
    (
      dialog.contentEl as unknown as {dispatch(t: string, e: unknown): void}
    ).dispatch('keydown', key('Enter'));
    expect(dialog.closed).toBe(1);
    dialog.onClose();
    await expect(answer).resolves.toEqual({
      preset: 'A5 print',
      folder: '/out/a5',
    });
  });

  it('Enter does nothing while the folder is refused, or while an input method composes', async () => {
    const {dialog, rows} = await rig();
    const content = dialog.contentEl as unknown as {
      dispatch(t: string, e: unknown): void;
    };
    content.dispatch('keydown', key('Enter', {keyCode: 229}));
    content.dispatch('keydown', key('Enter', {isComposing: true}));
    expect(dialog.closed).toBe(0);
    await type(field(rows), 'relative');
    content.dispatch('keydown', key('Enter'));
    expect(dialog.closed).toBe(0);
  });

  it('More options closes the dialog without an answer and opens the settings', async () => {
    const {dialog, rows, answer, settingsOpened} = await rig();
    await (rows.at(-1) as FakeSetting).buttons[0]?.clicked?.();
    expect(dialog.closed).toBe(1);
    dialog.onClose();
    await expect(answer).resolves.toBeNull();
    expect(settingsOpened()).toBe(1);
  });
});
