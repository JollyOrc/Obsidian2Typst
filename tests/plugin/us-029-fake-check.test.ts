// US-029 (SCAR-028) — the fake `obsidian` fields the US-029 tests read
// through, checked on a known input: the tag and parent of a made element,
// the container of a Setting, the text and tooltip of a button.
import {beforeEach, describe, expect, it} from 'vitest';
import {FakeEl, FakeSetting, made, resetFake} from '../support/fake-obsidian';

beforeEach(() => resetFake());

describe('US-029 the fake obsidian, on a known input', () => {
  it('US-029: createEl keeps the tag and the parent; open starts false', () => {
    const root = new FakeEl();
    const details = root.createEl('details');
    const body = details.createDiv();
    expect(details.tag).toBe('details');
    expect(details.open).toBe(false);
    expect(details.parentElement).toBe(root);
    expect(body.tag).toBe('div');
    expect(body.parentElement?.parentElement).toBe(root);
  });

  it('US-029: a Setting keeps its container; a button keeps its text, tooltip and disabled state', () => {
    const root = new FakeEl();
    const section = root.createEl('details');
    const row = new FakeSetting(section);
    row.addButton((b) => b.setButtonText('Use').setDisabled(true));
    row.addExtraButton((b) =>
      b.setIcon('settings').setTooltip('Settings of X'),
    );
    expect(row.parent).toBe(section);
    expect(made).toEqual([row]);
    expect(
      row.buttons.map((b) => [b.text, b.icon, b.tooltip, b.disabled]),
    ).toEqual([
      ['Use', '', '', true],
      ['', 'settings', 'Settings of X', false],
    ]);
  });

  it('US-029: a toggle fired on a details element reaches its listener', () => {
    const details = new FakeEl().createEl('details');
    let seen: boolean | null = null;
    details.addEventListener('toggle', () => (seen = details.open));
    details.open = true;
    details.fire('toggle');
    expect(seen).toBe(true);
  });
});
