// US-008 AC-17 (SCAR-013, SCAR-014): how the dialogs of the settings tab are
// operated, as plain functions without Obsidian so that tests can run them.
import type {PresetStore} from '../presets/store';

/** The parts of a keyboard event that decide whether Enter confirms. */
export interface KeyLike {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
  /** Modifier keys do not change the rule in a one-line field. */
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

/**
 * Enter in a one-line field has the effect of the confirming button, except
 * while an input method is composing text: that Enter ends the composition
 * (`isComposing`, or key code 229 in browsers that report it so).
 */
export function isConfirmKey(event: KeyLike): boolean {
  if (event.isComposing === true || event.keyCode === 229) return false;
  return event.key === 'Enter';
}

export interface DeleteConfirmation {
  title: string;
  lines: string[];
  confirmLabel: string;
  cancelLabel: string;
}

/** The texts of the question before a preset note is moved to the trash. */
export function deleteConfirmation(options: {
  name: string;
  isActive: boolean;
  next: string;
}): DeleteConfirmation {
  const lines = [
    'The note moves to the trash, as set in Obsidian under "Deleted files".',
  ];
  if (options.isActive) {
    lines.push(`"${options.next}" becomes the active preset.`);
  }
  return {
    title: `Delete preset "${options.name}"?`,
    lines,
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };
}

export interface DeletePresetDeps {
  store: Pick<PresetStore, 'canRemove' | 'remove'>;
  /** Shows the question; true only when the user chose the confirm button. */
  confirm(text: DeleteConfirmation): Promise<boolean>;
  setActive(name: string): Promise<void>;
  notify(text: string): void;
}

/**
 * The flow behind the `Delete` button: a refusal comes first (no dialog), then
 * the question, and the note is trashed only after the user confirmed.
 */
export async function deletePreset(
  deps: DeletePresetDeps,
  name: string,
  active: string,
): Promise<void> {
  const plan = deps.store.canRemove(name, active);
  if (!plan.ok) {
    deps.notify(plan.error);
    return;
  }
  const confirmed = await deps.confirm(
    deleteConfirmation({
      name,
      isActive: name === active,
      next: plan.active,
    }),
  );
  if (!confirmed) return;
  const result = await deps.store.remove(name, active);
  if (!result.ok) {
    deps.notify(result.error);
    return;
  }
  await deps.setActive(result.active);
}

/**
 * US-010 AC-6, US-008 AC-18 (SCAR-014): the question before a Defaults value
 * is removed. Transform of the value in the text (SCAR-001): a string or a
 * number is shown as written; a boolean is shown as `on` or `off`.
 */
export function resetConfirmation(options: {
  label: string;
  value: string | number | boolean;
}): DeleteConfirmation {
  return {
    title: `Reset "${options.label}"?`,
    lines: [
      `The value "${valueText(options.value)}" is removed from the Defaults. Presets that do not set this field use the built-in value.`,
    ],
    confirmLabel: 'Reset',
    cancelLabel: 'Cancel',
  };
}

type Reset = string | number | boolean | undefined;

function valueText(value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  return String(value);
}

export interface ResetFieldDeps {
  /** Shows the question; true only when the user chose the confirm button. */
  confirm(text: DeleteConfirmation): Promise<boolean>;
  /** Saves the new value (`undefined` removes it); false when refused. */
  save(value: undefined): Promise<boolean>;
}

/**
 * The flow behind the reset icon of a Defaults row: a row without a value asks
 * nothing, otherwise the value is removed only after the user confirmed.
 * True when the value was removed.
 */
export async function resetDefaultField(
  deps: ResetFieldDeps,
  field: {
    label: string;
    /** The value, or a function that reads it when the icon is clicked. */
    value: Reset | (() => Reset);
  },
): Promise<boolean> {
  const value = typeof field.value === 'function' ? field.value() : field.value;
  if (value === undefined) return false;
  const confirmed = await deps.confirm(
    resetConfirmation({label: field.label, value}),
  );
  if (!confirmed) return false;
  return deps.save(undefined);
}
