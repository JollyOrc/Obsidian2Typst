// US-008 AC-17 (SCAR-013, SCAR-014) — how the dialogs of the settings tab are
// operated: Enter confirms, composing input does not, and a preset is deleted
// only after a confirmation (plugin logic without Obsidian; the dialogs
// themselves are checked by the manual check M2). Source of truth:
// docs/user-stories/US-008-presets-and-settings.md.
import {describe, expect, it, vi} from 'vitest';
import {BUILTIN_PRESET_TEXTS} from '../../src/core/presets';
import {createPresetStore} from '../../src/plugin/presets/store';
import {
  deleteConfirmation,
  deletePreset,
  isConfirmKey,
} from '../../src/plugin/settings/dialog';
import {FakeVault} from '../support/fake-vault';

const FOLDER = 'Obsidian2Typst/presets';

describe('US-008 AC-17 isConfirmKey', () => {
  it('US-008 AC-17: Enter confirms', () => {
    expect(isConfirmKey({key: 'Enter'})).toBe(true);
    expect(isConfirmKey({key: 'Enter', isComposing: false, keyCode: 13})).toBe(
      true,
    );
  });

  it('US-008 AC-17: Enter with Shift, Ctrl or Alt still confirms in a one-line field', () => {
    expect(isConfirmKey({key: 'Enter', shiftKey: true})).toBe(true);
    expect(isConfirmKey({key: 'Enter', ctrlKey: true})).toBe(true);
  });

  it('US-008 AC-17: Enter that ends an input-method composition does not confirm', () => {
    expect(isConfirmKey({key: 'Enter', isComposing: true})).toBe(false);
    expect(isConfirmKey({key: 'Enter', keyCode: 229})).toBe(false);
    expect(isConfirmKey({key: 'Process', keyCode: 229})).toBe(false);
  });

  it('US-008 AC-17: other keys do not confirm', () => {
    for (const key of ['a', ' ', 'Escape', 'Tab', 'ArrowDown', 'Enterx']) {
      expect(isConfirmKey({key}), key).toBe(false);
    }
  });
});

describe('US-008 AC-17 deleteConfirmation texts', () => {
  it('US-008 AC-17: names the preset, says where the note goes and offers Delete and Cancel', () => {
    expect(
      deleteConfirmation({name: 'Trial', isActive: false, next: 'A5 print'}),
    ).toEqual({
      title: 'Delete preset "Trial"?',
      lines: [
        'The note moves to the trash, as set in Obsidian under "Deleted files".',
      ],
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
  });

  it('US-008 AC-17: for the active preset it says which preset becomes active', () => {
    const text = deleteConfirmation({
      name: 'A5 print',
      isActive: true,
      next: 'A4 digital',
    });
    expect(text.lines).toEqual([
      'The note moves to the trash, as set in Obsidian under "Deleted files".',
      '"A4 digital" becomes the active preset.',
    ]);
  });
});

async function rig(names = ['A5 print', 'A4 digital']) {
  const files: Record<string, string> = {};
  for (const name of names) {
    files[`${FOLDER}/${name}.md`] = BUILTIN_PRESET_TEXTS['A5 print'];
  }
  const vault = new FakeVault(files, [FOLDER]);
  const store = createPresetStore({
    vault,
    folder: () => FOLDER,
    defaults: () => ({}),
    notify: () => undefined,
  });
  await store.load();
  const trashed = vi.spyOn(vault, 'trash');
  return {vault, store, trashed};
}

describe('US-008 AC-17 PresetStore.canRemove', () => {
  it('US-008 AC-17: gives the plan of planDelete and trashes nothing', async () => {
    const {store, trashed} = await rig();
    expect(store.canRemove('A5 print', 'A5 print')).toEqual({
      ok: true,
      active: 'A4 digital',
    });
    expect(store.canRemove('A4 digital', 'A5 print')).toEqual({
      ok: true,
      active: 'A5 print',
    });
    expect(trashed).not.toHaveBeenCalled();
    expect(store.entries().map((e) => e.name)).toEqual([
      'A4 digital',
      'A5 print',
    ]);
  });

  it('US-008 AC-17: refuses the last preset and an unknown name', async () => {
    const {store} = await rig(['Only']);
    expect(store.canRemove('Only', 'Only')).toEqual({
      ok: false,
      error: 'The last preset cannot be deleted',
    });
    expect(store.canRemove('Nope', 'Only')).toEqual({
      ok: false,
      error: 'Preset "Nope" does not exist',
    });
  });
});

describe('US-008 AC-17 deletePreset (the flow behind the Delete button)', () => {
  function flow(answer: boolean) {
    const calls: string[] = [];
    return {
      calls,
      deps: (store: Awaited<ReturnType<typeof rig>>['store']) => ({
        store,
        confirm: async (text: ReturnType<typeof deleteConfirmation>) => {
          calls.push(`confirm:${text.title}`);
          return answer;
        },
        setActive: async (name: string) => void calls.push(`active:${name}`),
        notify: (text: string) => void calls.push(`notice:${text}`),
      }),
    };
  }

  it('US-008 AC-17: asks first; after Delete the note is trashed and the next preset becomes active', async () => {
    const {store, trashed} = await rig();
    const f = flow(true);
    await deletePreset(f.deps(store), 'A5 print', 'A5 print');
    expect(f.calls).toEqual([
      'confirm:Delete preset "A5 print"?',
      'active:A4 digital',
    ]);
    expect(trashed).toHaveBeenCalledTimes(1);
  });

  it('US-008 AC-17: Cancel or Escape trashes nothing and changes no active preset', async () => {
    const {store, trashed} = await rig();
    const f = flow(false);
    await deletePreset(f.deps(store), 'A5 print', 'A5 print');
    expect(f.calls).toEqual(['confirm:Delete preset "A5 print"?']);
    expect(trashed).not.toHaveBeenCalled();
    expect(store.entries().map((e) => e.name)).toContain('A5 print');
  });

  it('US-008 AC-17: nothing is trashed while the question is still open', async () => {
    const {store, trashed} = await rig();
    let open: (answer: boolean) => void = () => undefined;
    const pending = deletePreset(
      {
        store,
        confirm: () => new Promise<boolean>((resolve) => (open = resolve)),
        setActive: async () => undefined,
        notify: () => undefined,
      },
      'A4 digital',
      'A5 print',
    );
    await Promise.resolve();
    expect(trashed).not.toHaveBeenCalled();
    open(true);
    await pending;
    expect(trashed).toHaveBeenCalledTimes(1);
  });

  it('US-008 AC-17: the last preset is refused at once with its message and no dialog opens', async () => {
    const {store, trashed} = await rig(['Only']);
    const f = flow(true);
    await deletePreset(f.deps(store), 'Only', 'Only');
    expect(f.calls).toEqual(['notice:The last preset cannot be deleted']);
    expect(trashed).not.toHaveBeenCalled();
  });

  it('US-008 AC-17: a non-active preset keeps the active one', async () => {
    const {store} = await rig();
    const f = flow(true);
    await deletePreset(f.deps(store), 'A4 digital', 'A5 print');
    expect(f.calls).toEqual([
      'confirm:Delete preset "A4 digital"?',
      'active:A5 print',
    ]);
  });

  it('US-008 AC-17: the confirmation of the active preset names the next one', async () => {
    const {store} = await rig();
    const texts: string[][] = [];
    await deletePreset(
      {
        store,
        confirm: async (t) => {
          texts.push(t.lines);
          return false;
        },
        setActive: async () => undefined,
        notify: () => undefined,
      },
      'A5 print',
      'A5 print',
    );
    expect(texts[0]?.[1]).toBe('"A4 digital" becomes the active preset.');
  });

  it('US-008 AC-17: the confirmation of a non-active preset has no sentence about the active one', async () => {
    const {store} = await rig();
    const texts: string[][] = [];
    await deletePreset(
      {
        store,
        confirm: async (t) => {
          texts.push(t.lines);
          return false;
        },
        setActive: async () => undefined,
        notify: () => undefined,
      },
      'A4 digital',
      'A5 print',
    );
    expect(texts[0]).toHaveLength(1);
  });

  it('US-008 AC-17: when the note vanished meanwhile, the error is shown and the active preset stays', async () => {
    const calls: string[] = [];
    await deletePreset(
      {
        store: {
          canRemove: () => ({ok: true, active: 'B'}),
          remove: async () => ({ok: false, error: 'Preset "A" does not exist'}),
        },
        confirm: async () => true,
        setActive: async (n) => void calls.push(`active:${n}`),
        notify: (t) => void calls.push(`notice:${t}`),
      },
      'A',
      'A',
    );
    expect(calls).toEqual(['notice:Preset "A" does not exist']);
  });
});
