// US-008 AC-20 (SCAR-017): the one place that saves a text or number field of
// the settings tab. A half-typed value is never saved, validated or shown to the
// presets: the handler runs when the field is left or Enter is pressed (the
// `change` event), with the text that stands in the field then.
// US-029 AC-5 (decision 3): a modal keeps its fields in a `PendingFields`
// registry; closing it saves every field whose text differs from the text last
// saved, without relying on a `change` event when the field is removed.

/** What the helper needs of an input element. */
export interface CommitInput {
  addEventListener(type: 'change', listener: () => void): void;
}

/** US-029 | AC-5: the fields of one modal, saved on close. */
export interface PendingFields {
  /** True once `flush` ran: a refused value then shows as a notice. */
  readonly closed: boolean;
  /** Registers a field; `committed` records the text a `change` saved. */
  add(
    read: () => string,
    handler: (text: string) => Promise<void> | void,
  ): {committed(text: string): void};
  /** Forgets the fields (the modal draws its rows again). */
  clear(): void;
  /** Saves every field whose text differs from its last saved text. */
  flush(): void;
}

/** Runs a handler; a rejected or throwing one is swallowed (it shows its own message). */
function run(
  handler: (text: string) => Promise<void> | void,
  text: string,
): void {
  try {
    void Promise.resolve(handler(text)).catch(() => undefined);
  } catch {
    // A handler that throws shows its own message in its row.
  }
}

/**
 * US-029 | AC-5 (decision 3): a registry for the text fields of one modal.
 * A field's last saved text starts as its text when registered (nothing typed
 * yet) and follows every `change`; `flush` saves only fields typed since, so
 * a field saved by `change` is not saved twice and an untouched one not at all.
 */
export function createPendingFields(): PendingFields {
  let fields: {
    read: () => string;
    save: (text: string) => void;
    last: string;
  }[] = [];
  let closed = false;
  return {
    get closed() {
      return closed;
    },
    add(read, handler) {
      const field = {
        read,
        save: (text: string) => run(handler, text),
        last: read(),
      };
      fields.push(field);
      return {committed: (text) => void (field.last = text)};
    },
    clear() {
      fields = [];
    },
    flush() {
      closed = true;
      for (const field of fields) {
        const text = field.read();
        if (text === field.last) continue;
        field.last = text;
        field.save(text);
      }
    },
  };
}

/**
 * Calls `handler` with `read()` on every `change` event of `input`. A rejected
 * handler is swallowed here: every handler shows its own message in its row.
 * US-029 AC-5: with `pending`, the field is registered there too, so a modal
 * that closes saves what was typed but not yet saved.
 */
export function commitOnChange(
  input: CommitInput,
  read: () => string,
  handler: (text: string) => Promise<void> | void,
  pending?: PendingFields,
): void {
  const field = pending?.add(read, handler);
  input.addEventListener('change', () => {
    const text = read();
    field?.committed(text);
    run(handler, text);
  });
}
