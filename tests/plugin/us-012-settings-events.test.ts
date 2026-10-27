// US-012 AC-14: the settings store tells listeners about each saved change.
import {describe, expect, it} from 'vitest';
import {
  createSettingsStore,
  type SettingsStorage,
} from '../../src/plugin/settings/data';

class Storage implements SettingsStorage {
  stored: unknown = null;
  async load(): Promise<unknown> {
    return this.stored;
  }
  async save(data: unknown): Promise<void> {
    this.stored = JSON.parse(JSON.stringify(data));
  }
}

describe('US-012 AC-14 settings change event', () => {
  it('US-012 AC-14: the settings store sends one event after each saved change and none after a refused one', async () => {
    const store = createSettingsStore(new Storage());
    await store.load();
    let events = 0;
    const off = store.onChange(() => void events++);
    await store.update({activePreset: 'A4 digital'});
    expect(events).toBe(1);
    expect((await store.setDefaults({page: {bleed: 4}})).ok).toBe(true);
    expect(events).toBe(2);
    expect((await store.setDefaults({page: {bleed: 'x'}})).ok).toBe(false);
    expect(events).toBe(2);
    off();
    await store.update({strictMode: true});
    expect(events).toBe(2);
  });
});
