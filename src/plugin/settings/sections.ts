// US-029 AC-1, AC-7: the collapsible sections of the settings tab and the
// style panel. A section is a `details` element whose summary is a heading
// row; which sections are open is kept by the screen for its lifetime (a
// session), never in data.json.
import {Setting} from 'obsidian';

/** US-029 AC-7: the open and closed sections of one screen. */
export interface SectionState {
  isOpen(name: string): boolean;
  set(name: string, open: boolean): void;
}

/**
 * US-029 | AC-7 (decision 2): a state in which the sections named in
 * `firstOpen` are open and every other one is closed until the user opens it.
 */
export function createSectionState(firstOpen: readonly string[]): SectionState {
  const open = new Set(firstOpen);
  return {
    isOpen: (name) => open.has(name),
    set: (name, isOpen) => {
      if (isOpen) open.add(name);
      else open.delete(name);
    },
  };
}

/**
 * US-029 | AC-1, AC-7: Adds the section `name` to `root`: a `details` element,
 * open as `state` says, with a heading row in its summary; opening or closing
 * it (click, Enter or Space on the summary: the element's own behaviour) is
 * written into `state` by its `toggle` event. Returns the element the
 * section's rows are drawn into.
 */
export function addSection(
  root: HTMLElement,
  name: string,
  state: SectionState,
): HTMLElement {
  const details = root.createEl('details', {cls: 'o2t-section'});
  details.open = state.isOpen(name);
  const summary = details.createEl('summary');
  new Setting(summary).setName(name).setHeading();
  details.addEventListener('toggle', () => state.set(name, details.open));
  return details;
}
