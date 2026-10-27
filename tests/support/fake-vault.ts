// Test support for US-008: an in-memory vault for the preset store and the
// export command. It records every change the plugin makes (`writes`) and
// every file it reads (`reads`), and emits the events Obsidian emits.
import type {VaultEvent, VaultPort} from '../../src/plugin/presets/store';

const dirOf = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

export class FakeVault implements VaultPort {
  readonly files = new Map<string, string>();
  readonly folders = new Set<string>();
  /** `folder:`, `create:`, `rename:` and `trash:` entries, in order. */
  readonly writes: string[] = [];
  readonly reads: string[] = [];
  readonly trashed: string[] = [];
  private readonly handlers = new Set<(event: VaultEvent) => void>();

  constructor(files: Record<string, string> = {}, folders: string[] = []) {
    for (const [path, text] of Object.entries(files))
      this.files.set(path, text);
    for (const folder of folders) this.folders.add(folder);
  }

  async folderExists(path: string): Promise<boolean> {
    return this.folders.has(path);
  }

  async createFolder(path: string): Promise<void> {
    this.writes.push(`folder:${path}`);
    this.folders.add(path);
  }

  async listNotes(folder: string): Promise<string[]> {
    return [...this.files.keys()]
      .filter((path) => path.endsWith('.md') && dirOf(path) === folder)
      .sort();
  }

  async read(path: string): Promise<string> {
    this.reads.push(path);
    const text = this.files.get(path);
    if (text === undefined) throw new Error(`No such file: ${path}`);
    return text;
  }

  async create(path: string, text: string): Promise<void> {
    if (this.files.has(path)) throw new Error(`File already exists: ${path}`);
    this.writes.push(`create:${path}`);
    this.files.set(path, text);
    this.emit({kind: 'create', path});
  }

  async rename(from: string, to: string): Promise<void> {
    const text = this.files.get(from);
    if (text === undefined) throw new Error(`No such file: ${from}`);
    this.writes.push(`rename:${from}->${to}`);
    this.files.delete(from);
    this.files.set(to, text);
    this.emit({kind: 'rename', path: to, oldPath: from});
  }

  async trash(path: string): Promise<void> {
    if (!this.files.has(path)) throw new Error(`No such file: ${path}`);
    this.writes.push(`trash:${path}`);
    this.trashed.push(path);
    this.files.delete(path);
    this.emit({kind: 'delete', path});
  }

  /**
   * US-022 AC-7: an atomic read-change-write of one note, as Obsidian's
   * `Vault.process`: the text at the moment of the call goes into `change`;
   * the result is written and a `modify` event is sent.
   */
  async process(
    path: string,
    change: (text: string) => string,
  ): Promise<string> {
    const text = this.files.get(path);
    if (text === undefined) throw new Error(`No such file: ${path}`);
    const next = change(text);
    this.writes.push(`process:${path}`);
    this.files.set(path, next);
    this.emit({kind: 'modify', path});
    return next;
  }

  watch(handler: (event: VaultEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** A change made by the user or by sync: not a write of the plugin. */
  edit(path: string, text: string): void {
    const existed = this.files.has(path);
    this.files.set(path, text);
    this.emit({kind: existed ? 'modify' : 'create', path});
  }

  /** A deletion made by the user or by sync. */
  remove(path: string): void {
    this.files.delete(path);
    this.emit({kind: 'delete', path});
  }

  emit(event: VaultEvent): void {
    for (const handler of [...this.handlers]) handler(event);
  }

  get watching(): number {
    return this.handlers.size;
  }
}
