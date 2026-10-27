// US-008 AC-3 to AC-7, AC-12: the presets of the vault in a running plugin.
// The store reads the preset notes through a small port, watches them, and
// creates, duplicates, renames and deletes them. It never changes a note by
// itself (AC-7). The port over Obsidian is in `../obsidian/vault-port.ts`.
import {
  BUILTIN_PRESET_TEXTS,
  copyName,
  effectiveSettings,
  emptyPresetText,
  formatPresetError,
  parsePreset,
  planDelete,
  readGroup,
  sortPresetNames,
  validatePresetName,
  type ParseResult,
  type PresetError,
  type PresetFields,
} from '../../core/presets';

/** What the store needs from the vault. Paths are vault paths. */
export interface VaultPort {
  folderExists(path: string): Promise<boolean>;
  /** Creates the folder and every missing parent. */
  createFolder(path: string): Promise<void>;
  /** The `.md` notes directly in `folder` (not in subfolders). */
  listNotes(folder: string): Promise<string[]>;
  read(path: string): Promise<string>;
  create(path: string, text: string): Promise<void>;
  /** Renames through Obsidian, so that links to the note are updated. */
  rename(from: string, to: string): Promise<void>;
  /** Moves to the trash according to the user's Obsidian setting. */
  trash(path: string): Promise<void>;
  /** Calls `handler` for every change of the vault; returns a stop function. */
  watch(handler: (event: VaultEvent) => void): () => void;
  /**
   * US-022 AC-7: one atomic read-change-write of the note at `path`; `change`
   * gets the text at the moment of the write. A throw in `change` writes
   * nothing. Only the `changePreset` action calls it (SCAR-017).
   */
  process(path: string, change: (text: string) => string): Promise<string>;
}

export type VaultEvent =
  | {kind: 'create' | 'modify' | 'delete'; path: string}
  | {kind: 'rename'; path: string; oldPath: string};

export type OkPreset = Extract<ParseResult, {ok: true}>;

/** One preset note as the store knows it. */
export interface PresetEntry {
  name: string;
  path: string;
  valid: boolean;
  /**
   * US-021 AC-2: the group the lists show it in, or null; read from the note
   * also when the preset is invalid, while its frontmatter is YAML.
   */
  group: string | null;
  /** The parsed note; set when `valid`. */
  preset?: OkPreset;
  /** The first error; set when not `valid`. */
  error?: PresetError;
}

export type StoreResult = {ok: true; name: string} | {ok: false; error: string};

export type UseResult =
  {ok: true; preset: OkPreset} | {ok: false; error: string};

export interface PresetStoreOptions {
  vault: VaultPort;
  /** The presets folder (read at every use, so a changed setting applies). */
  folder: () => string;
  /** The Defaults; a preset is judged together with them. */
  defaults: () => PresetFields;
  /** Shows a notice to the user. */
  notify: (text: string) => void;
}

export interface PresetStore {
  /** Creates the built-in notes on first start, reads all notes, starts watching. */
  load(): Promise<void>;
  /** The presets, sorted by name. */
  entries(): PresetEntry[];
  get(name: string): PresetEntry | undefined;
  /** The preset to export or preview with, or why it cannot be used. */
  use(name: string): UseResult;
  create(name: string, from?: string): Promise<StoreResult>;
  duplicate(name: string): Promise<StoreResult>;
  rename(name: string, newName: string): Promise<StoreResult>;
  /** The plan of `remove` without its effect: who becomes active, or why not. */
  canRemove(
    name: string,
    active: string,
  ): {ok: true; active: string} | {ok: false; error: string};
  remove(
    name: string,
    active: string,
  ): Promise<{ok: true; active: string} | {ok: false; error: string}>;
  /** Judges all notes again (after the Defaults changed); no vault read. */
  refresh(): void;
  /** One event per change, with the names of the presets that changed. */
  onChange(listener: (names: string[]) => void): () => void;
  dispose(): void;
}

/** How long the store waits after a change before it reads the note again. */
export const DEBOUNCE_MS = 300;

interface Record_ {
  name: string;
  path: string;
  /** The note text as last read or written. */
  text: string;
  parse: ParseResult;
  entry: PresetEntry;
  /** Messages for values that were replaced (not errors). */
  notices: string[];
}

const nameOf = (path: string): string => {
  const file = path.slice(path.lastIndexOf('/') + 1);
  return file.replace(/\.md$/i, '');
};

const dirOf = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

export function createPresetStore(options: PresetStoreOptions): PresetStore {
  const {vault} = options;
  const records = new Map<string, Record_>();
  const listeners = new Set<(names: string[]) => void>();
  const dirty = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stop: (() => void) | null = null;
  let queue: Promise<void> = Promise.resolve();

  const folder = (): string => options.folder();
  const isPresetPath = (path: string): boolean =>
    /\.md$/i.test(path) && dirOf(path) === folder();
  const pathFor = (name: string): string => `${folder()}/${name}.md`;

  /** Judges a note text together with the Defaults. */
  function evaluate(path: string, text: string): Record_ {
    const parse = parsePreset(text);
    const name = nameOf(path);
    const entry: PresetEntry = {
      name,
      path,
      valid: false,
      group: parse.ok ? (parse.fields.group ?? null) : readGroup(text),
    };
    let notices: string[] = [];
    if (parse.ok) {
      const effective = effectiveSettings(
        parse,
        options.defaults(),
        () => false,
      );
      if (effective.ok) {
        entry.valid = true;
        entry.preset = parse;
        notices = parse.notices;
      } else {
        entry.error = effective.error;
      }
    } else {
      entry.error = parse.error;
    }
    return {name, path, text, parse, entry, notices};
  }

  /** What a user of the store can see; equal outcomes send no event. */
  const outcome = (r: Record_ | undefined): string =>
    r === undefined
      ? 'none'
      : JSON.stringify([
          r.entry.valid,
          r.entry.error ?? null,
          r.parse.ok ? [r.parse.fields, r.parse.lines] : null,
        ]);

  function emit(names: Iterable<string>): void {
    const list = sortPresetNames([...new Set(names)]);
    if (list.length === 0) return;
    for (const listener of [...listeners]) listener(list);
  }

  function announce(r: Record_): void {
    if (!r.entry.valid && r.entry.error !== undefined) {
      options.notify(`Preset "${r.name}": ${formatPresetError(r.entry.error)}`);
    }
    for (const notice of r.notices) {
      options.notify(`Preset "${r.name}": ${notice}`);
    }
  }

  async function readAll(): Promise<void> {
    for (const path of await vault.listNotes(folder())) {
      const text = await vault.read(path);
      const record = evaluate(path, text);
      records.set(path, record);
      announce(record);
    }
  }

  /** Reads the notes that changed and sends one event for the batch. */
  async function process(paths: string[]): Promise<void> {
    const listed = new Set(await vault.listNotes(folder()));
    const changed: string[] = [];
    for (const path of paths) {
      const before = records.get(path);
      if (!listed.has(path)) {
        if (before !== undefined) {
          records.delete(path);
          changed.push(before.name);
        }
        continue;
      }
      const text = await vault.read(path);
      if (before !== undefined && before.text === text) continue;
      const after = evaluate(path, text);
      records.set(path, after);
      announce(after);
      if (outcome(before) !== outcome(after)) changed.push(after.name);
    }
    emit(changed);
  }

  function schedule(): void {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const paths = [...dirty];
      dirty.clear();
      queue = queue.then(() => process(paths));
    }, DEBOUNCE_MS);
  }

  function onEvent(event: VaultEvent): void {
    const paths =
      event.kind === 'rename' ? [event.path, event.oldPath] : [event.path];
    const relevant = paths.filter(isPresetPath);
    if (relevant.length === 0) return;
    for (const path of relevant) dirty.add(path);
    schedule();
  }

  const byName = (name: string): Record_ | undefined =>
    [...records.values()].find((r) => r.name === name);
  const names = (): string[] => [...records.values()].map((r) => r.name);

  async function ensureFolder(): Promise<void> {
    if (!(await vault.folderExists(folder())))
      await vault.createFolder(folder());
  }

  /** Writes a new note and records it; the note text is the one just written. */
  async function add(name: string, text: string): Promise<StoreResult> {
    await ensureFolder();
    const path = pathFor(name);
    await vault.create(path, text);
    records.set(path, evaluate(path, text));
    emit([name]);
    return {ok: true, name};
  }

  return {
    async load() {
      // Loading again (the presets folder changed) starts from nothing.
      stop?.();
      stop = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      dirty.clear();
      records.clear();
      if (!(await vault.folderExists(folder()))) {
        await vault.createFolder(folder());
        for (const name of ['A4 digital', 'A5 print'] as const) {
          await vault.create(pathFor(name), BUILTIN_PRESET_TEXTS[name]);
        }
      }
      await readAll();
      stop = vault.watch(onEvent);
      // US-021 AC-9: every screen drawn before the presets were read (the
      // style panel restored at startup) or showing another folder learns of
      // the load, also when the folder holds no preset.
      const list = sortPresetNames(names());
      for (const listener of [...listeners]) listener(list);
    },

    entries() {
      const sorted = sortPresetNames(names());
      return sorted.map((n) => (byName(n) as Record_).entry);
    },

    get(name) {
      return byName(name)?.entry;
    },

    use(name) {
      const record = byName(name);
      if (record === undefined) {
        return {ok: false, error: `Preset "${name}" does not exist`};
      }
      if (record.entry.preset === undefined) {
        const reason = formatPresetError(
          record.entry.error ?? {message: 'unknown error', line: null},
        );
        return {ok: false, error: `Preset "${name}" is invalid: ${reason}`};
      }
      return {ok: true, preset: record.entry.preset};
    },

    async create(name, from) {
      const checked = validatePresetName(name, names());
      if (!checked.ok) return checked;
      let text = emptyPresetText();
      if (from !== undefined) {
        const source = byName(from);
        if (source === undefined) {
          return {ok: false, error: `Preset "${from}" does not exist`};
        }
        text = await vault.read(source.path);
      }
      return add(checked.name, text);
    },

    async duplicate(name) {
      const source = byName(name);
      if (source === undefined) {
        return {ok: false, error: `Preset "${name}" does not exist`};
      }
      return add(copyName(name, names()), await vault.read(source.path));
    },

    async rename(name, newName) {
      const record = byName(name);
      if (record === undefined) {
        return {ok: false, error: `Preset "${name}" does not exist`};
      }
      const checked = validatePresetName(newName, names(), name);
      if (!checked.ok) return checked;
      const to = pathFor(checked.name);
      if (to !== record.path) {
        await vault.rename(record.path, to);
        records.delete(record.path);
        records.set(to, evaluate(to, record.text));
        emit([name, checked.name]);
      }
      return {ok: true, name: checked.name};
    },

    canRemove(name, active) {
      if (byName(name) === undefined) {
        return {ok: false, error: `Preset "${name}" does not exist`};
      }
      return planDelete(names(), name, active);
    },

    async remove(name, active) {
      const record = byName(name);
      if (record === undefined) {
        return {ok: false, error: `Preset "${name}" does not exist`};
      }
      const plan = planDelete(names(), name, active);
      if (!plan.ok) return plan;
      await vault.trash(record.path);
      records.delete(record.path);
      emit([name]);
      return plan;
    },

    refresh() {
      const changed: string[] = [];
      for (const [path, before] of [...records]) {
        const after = evaluate(path, before.text);
        records.set(path, after);
        if (outcome(before) !== outcome(after)) {
          changed.push(after.name);
          announce(after);
        }
      }
      emit(changed);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      dirty.clear();
      listeners.clear();
      stop?.();
      stop = null;
    },
  };
}
