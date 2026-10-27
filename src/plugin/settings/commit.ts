// US-008 AC-20 (SCAR-017): the one place that saves a text or number field of
// the settings tab. A half-typed value is never saved, validated or shown to the
// presets: the handler runs when the field is left or Enter is pressed (the
// `change` event), with the text that stands in the field then.

/** What the helper needs of an input element. */
export interface CommitInput {
  addEventListener(type: 'change', listener: () => void): void;
}

/**
 * Calls `handler` with `read()` on every `change` event of `input`. A rejected
 * handler is swallowed here: every handler shows its own message in its row.
 */
export function commitOnChange(
  input: CommitInput,
  read: () => string,
  handler: (text: string) => Promise<void> | void,
): void {
  input.addEventListener('change', () => {
    try {
      void Promise.resolve(handler(read())).catch(() => undefined);
    } catch {
      // A handler that throws shows its own message in its row.
    }
  });
}
