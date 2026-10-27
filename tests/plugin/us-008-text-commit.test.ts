// US-008 AC-20 — a text or number field of the settings tab is saved when it is
// left, not on every key: the helper, and a text check over the whole tab that
// fails when a field bypasses it (SCAR-017). The tab itself: manual check M2
// step 14. Source of truth: docs/user-stories/US-008-presets-and-settings.md.
import {describe, expect, it} from 'vitest';
import {
  commitOnChange,
  type CommitInput,
} from '../../src/plugin/settings/commit';
import {settingsSource} from '../support/settings-source';

class FakeInput implements CommitInput {
  value = '';
  private readonly listeners = new Map<string, (() => void)[]>();
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  fire(type: string): void {
    for (const l of this.listeners.get(type) ?? []) l();
  }
}

describe('US-008 AC-20 commitOnChange', () => {
  it('US-008 AC-20: does nothing while the user types and calls the handler once, with the text that stands there, when the field is left', () => {
    const input = new FakeInput();
    const seen: string[] = [];
    commitOnChange(
      input,
      () => input.value,
      (text) => {
        seen.push(text);
      },
    );
    for (const typed of ['2', '20', '200']) {
      input.value = typed;
      input.fire('input');
    }
    expect(seen).toEqual([]);
    input.fire('change');
    expect(seen).toEqual(['200']);
  });

  it('US-008 AC-20: calls the handler again for the next commit', () => {
    const input = new FakeInput();
    const seen: string[] = [];
    commitOnChange(
      input,
      () => input.value,
      (text) => {
        seen.push(text);
      },
    );
    input.value = 'a';
    input.fire('change');
    input.value = 'b';
    input.fire('change');
    expect(seen).toEqual(['a', 'b']);
  });

  it('US-008 AC-20: a handler that rejects does not leave an unhandled rejection', async () => {
    const input = new FakeInput();
    commitOnChange(
      input,
      () => 'x',
      async () => {
        throw new Error('refused');
      },
    );
    expect(() => input.fire('change')).not.toThrow();
    await Promise.resolve();
  });
});

describe('US-008 AC-20 wiring of the whole settings tab (text check, SCAR-017)', () => {
  const tab = settingsSource();
  /** The tab class only: the modals have their own fields and keys (SCAR-013). */
  const body = tab.slice(tab.indexOf('export class Obsidian2TypstSettingTab'));

  it('US-008 AC-20: every text field of the tab is saved through commitOnChange', () => {
    const fields = body.match(/\.addText\(/g)?.length ?? 0;
    const commits = body.match(/commitOnChange\(/g)?.length ?? 0;
    expect(fields).toBeGreaterThanOrEqual(5);
    expect(commits).toBe(fields);
  });

  it('US-008 AC-20: no text field saves on every key', () => {
    expect(body).not.toMatch(/t\.onChange\(\s*async \(text\)/);
    expect(body).not.toMatch(/onChange\(\s*\(?text\)? =>/);
  });
});
