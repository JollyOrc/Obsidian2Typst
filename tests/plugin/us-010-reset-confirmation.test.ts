// US-010 AC-6 (SCAR-014) — the reset icon of a Fonts row in the settings tab
// asks before it removes a value from the Defaults: the texts of the question,
// and the flow behind the icon (plugin logic without Obsidian; the dialog
// itself is checked by the manual check M5). Source of truth:
// docs/user-stories/US-010-fonts.md.
import {describe, expect, it, vi} from 'vitest';
import {
  resetConfirmation,
  resetDefaultField,
} from '../../src/plugin/settings/dialog';

describe('US-010 AC-6 resetConfirmation texts', () => {
  it('US-010 AC-6: names the field and the value, says what happens and offers Reset and Cancel', () => {
    expect(resetConfirmation({label: 'Heading font', value: 'Cinzel'})).toEqual(
      {
        title: 'Reset "Heading font"?',
        lines: [
          'The value "Cinzel" is removed from the Defaults. Presets that do not set this field use the built-in value.',
        ],
        confirmLabel: 'Reset',
        cancelLabel: 'Cancel',
      },
    );
  });

  it('US-010 AC-6: shows a number the way it is written', () => {
    expect(
      resetConfirmation({label: 'Body size (pt)', value: 10.5}).lines[0],
    ).toContain('"10.5"');
  });
});

describe('US-010 AC-6 resetDefaultField (the flow behind the reset icon)', () => {
  function flow(answer: boolean) {
    const confirm = vi.fn(async () => answer);
    const save = vi.fn(async () => true);
    return {confirm, save};
  }

  it('US-010 AC-6: removes the value only after the user confirmed', async () => {
    const {confirm, save} = flow(true);
    const done = await resetDefaultField(
      {confirm, save},
      {label: 'Default font', value: 'EB Garamond'},
    );
    expect(done).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(undefined);
  });

  it('US-010 AC-6: changes nothing when the user cancels', async () => {
    const {confirm, save} = flow(false);
    const done = await resetDefaultField(
      {confirm, save},
      {label: 'Default font', value: 'EB Garamond'},
    );
    expect(done).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('US-010 AC-6: asks nothing and changes nothing when the field has no value', async () => {
    const {confirm, save} = flow(true);
    const done = await resetDefaultField(
      {confirm, save},
      {label: 'Default font', value: undefined},
    );
    expect(done).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('US-010 AC-6: reports false when the save is refused, so the tab keeps what it shows', async () => {
    const confirm = vi.fn(async () => true);
    const save = vi.fn(async () => false);
    expect(
      await resetDefaultField(
        {confirm, save},
        {label: 'Default font', value: 'X'},
      ),
    ).toBe(false);
  });
});
