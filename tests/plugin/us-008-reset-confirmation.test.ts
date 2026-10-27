// US-008 AC-18 (SCAR-014) — the reset icons of the older Defaults rows ask
// before they remove a value. Same flow as US-010 AC-6; here the values of the
// older rows (colour, numbering, millimetres, switches). The dialog itself is
// checked by the manual check M2. Source of truth:
// docs/user-stories/US-008-presets-and-settings.md.
import {describe, expect, it, vi} from 'vitest';
import {
  resetConfirmation,
  resetDefaultField,
} from '../../src/plugin/settings/dialog';
import {settingsSource} from '../support/settings-source';

describe('US-008 AC-18 resetConfirmation texts', () => {
  it('US-008 AC-18: names a colour as it is written', () => {
    expect(
      resetConfirmation({label: 'Highlight colour', value: '#aa3300'}),
    ).toEqual({
      title: 'Reset "Highlight colour"?',
      lines: [
        'The value "#aa3300" is removed from the Defaults. Presets that do not set this field use the built-in value.',
      ],
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel',
    });
  });

  it('US-008 AC-18: shows millimetres as written', () => {
    expect(
      resetConfirmation({label: 'Bleed (mm)', value: 3.5}).lines[0],
    ).toContain('"3.5"');
  });

  it('US-008 AC-18: shows a switch as on or off', () => {
    expect(
      resetConfirmation({label: 'Facing pages', value: true}).lines[0],
    ).toContain('The value "on" is removed');
    expect(
      resetConfirmation({label: 'Facing pages', value: false}).lines[0],
    ).toContain('The value "off" is removed');
  });
});

describe('US-008 AC-18 resetDefaultField for the older rows', () => {
  function flow(answer: boolean) {
    return {
      confirm: vi.fn(async () => answer),
      save: vi.fn(async () => true),
    };
  }

  it('US-008 AC-18: a switch set to off is a value: it asks and then removes it', async () => {
    const {confirm, save} = flow(true);
    const done = await resetDefaultField(
      {confirm, save},
      {label: 'Facing pages', value: false},
    );
    expect(done).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(undefined);
  });

  it('US-008 AC-18: Cancel leaves a switch as it is', async () => {
    const {confirm, save} = flow(false);
    const done = await resetDefaultField(
      {confirm, save},
      {label: 'Footnotes for external links', value: true},
    );
    expect(done).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('US-008 AC-18: a row without a value asks nothing and changes nothing', async () => {
    const {confirm, save} = flow(true);
    const done = await resetDefaultField(
      {confirm, save},
      {label: 'Slug (mm)', value: undefined},
    );
    expect(done).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('US-008 AC-18: the save is not called while the question is open', async () => {
    let answer: (v: boolean) => void = () => undefined;
    const save = vi.fn(async () => true);
    const pending = resetDefaultField(
      {
        confirm: () => new Promise<boolean>((r) => (answer = r)),
        save,
      },
      {label: 'Gutter (mm)', value: 4},
    );
    await Promise.resolve();
    expect(save).not.toHaveBeenCalled();
    answer(true);
    expect(await pending).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('US-008 AC-18 the icon acts on the value of the click, not of the drawing', () => {
  it('US-008 AC-18: a value that is set after the row was drawn is asked about and removed', async () => {
    const defaults: {bleed?: string} = {}; // nothing when the tab is drawn
    const confirm = vi.fn(async () => true);
    const save = vi.fn(async () => true);
    const click = () =>
      resetDefaultField(
        {confirm, save},
        {label: 'Bleed (mm)', value: () => defaults.bleed},
      );
    defaults.bleed = '5'; // typed in the open tab
    expect(await click()).toBe(true);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [expect.stringContaining('The value "5" is removed')],
      }),
    );
    expect(save).toHaveBeenCalledWith(undefined);
  });

  it('US-008 AC-18: a value that was removed after the row was drawn asks nothing', async () => {
    const defaults: {bleed?: string} = {bleed: '5'};
    const confirm = vi.fn(async () => true);
    const click = () =>
      resetDefaultField(
        {confirm, save: async () => true},
        {label: 'Bleed (mm)', value: () => defaults.bleed},
      );
    defaults.bleed = undefined;
    expect(await click()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('US-008 AC-18: the settings tab reads the Defaults when the icon is clicked (text check)', () => {
    const tab = settingsSource();
    expect(tab).toMatch(/value: \(\) =>/);
    expect(tab).not.toMatch(/addResetButton\(setting, row, current,/);
  });
});

describe('US-008 AC-18 wiring of the settings tab (text check)', () => {
  const tab = settingsSource();

  it('US-008 AC-18: one reset button helper serves the Defaults and the Fonts rows', () => {
    expect(tab.match(/setIcon\('reset'\)/g)).toHaveLength(1);
    expect(tab.match(/\baddResetButton\(env,/g)?.length).toBeGreaterThanOrEqual(
      2,
    );
    expect(tab.match(/resetDefaultField\(/g)).toHaveLength(1);
  });

  it('US-008 AC-18: no icon removes a value without the question', () => {
    expect(tab).not.toMatch(
      /onClick\(async \(\) => \{\s*if \(await save\(undefined\)\)/,
    );
  });

  it('US-008 AC-18: the value of a switch reaches the question (a dropped boolean would make the icon do nothing)', () => {
    expect(tab).toContain("typeof current === 'boolean'");
  });
});
