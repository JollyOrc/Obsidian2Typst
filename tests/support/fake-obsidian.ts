// Test support for US-012: a stand-in for the parts of `obsidian` that the shared
// rows use (Setting and its controls, Modal, Notice). It records what a row
// shows (name, description, disabled controls, buttons) and lets a test fire the
// events of a control. Use with `vi.mock('obsidian', ...)`.

export const notices: string[] = [];
export const made: FakeSetting[] = [];
export const modals: FakeModal[] = [];

export class Notice {
  constructor(text: string) {
    notices.push(text);
  }
}

export class FakeEl {
  classes = new Set<string>();
  text = '';
  children: FakeEl[] = [];
  isConnected = true;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  scrollTop = 0;
  scrollHeight = 0;
  parentElement: FakeEl | null = null;
  clientHeight = 600;
  offsetHeight = 100;
  removed = 0;
  private readonly listeners = new Map<string, (() => void)[]>();
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  fire(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
  click(): void {
    this.fire('click');
  }
  focus(): void {}
  toggleClass(name: string, on: boolean): void {
    if (on) this.classes.add(name);
    else this.classes.delete(name);
  }
  appendChild(child: FakeEl): FakeEl {
    this.children.push(child);
    return child;
  }
  remove(): void {
    this.removed++;
  }
  /** Finds the first descendant by class and, optionally, `data-page`. */
  querySelector(selector: string): FakeEl | null {
    const page = /\[data-page="(\d+)"\]/.exec(selector)?.[1];
    const cls = /^\.([\w-]+)/.exec(selector)?.[1];
    const found = (el: FakeEl): FakeEl | null => {
      for (const child of el.children) {
        // A canvas made by the document stand-in is a plain object.
        if (!(child instanceof FakeEl)) continue;
        const matches =
          (cls === undefined || child.classes.has(cls)) &&
          (page === undefined || child.dataset['page'] === page);
        if (matches) return child;
        const deeper = found(child);
        if (deeper !== null) return deeper;
      }
      return null;
    };
    return found(this);
  }
  addClass(name: string): void {
    this.classes.add(name);
  }
  removeClass(name: string): void {
    this.classes.delete(name);
  }
  setText(text: string): void {
    this.text = text;
  }
  empty(): void {
    this.children = [];
  }
  createEl(_tag: string, options?: {text?: string; cls?: string}): FakeEl {
    const el = new FakeEl();
    el.text = options?.text ?? '';
    if (options?.cls !== undefined) el.classes.add(options.cls);
    this.children.push(el);
    return el;
  }
  createDiv(options?: {cls?: string}): FakeEl {
    return this.createEl('div', options);
  }
}

export class FakeInput {
  value = '';
  private readonly listeners = new Map<string, (() => void)[]>();
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  fire(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

export class FakeControl {
  kind = '';
  disabled = false;
  value: string | boolean = '';
  readonly inputEl = new FakeInput();
  readonly options: string[] = [];
  /**
   * The select element: `options` holds every option in document order, also
   * those inside an `optgroup` made with `createEl` (as Chromium does,
   * measured for US-021); `groups` records each optgroup's label and values.
   */
  readonly selectEl = {
    options: [] as {
      value: string;
      disabled?: boolean;
      title?: string;
    }[],
    groups: [] as {label: string; values: string[]}[],
    createEl: (
      tag: string,
      info: {attr?: {label?: string}} = {},
    ): {createEl(tag: string, info: {value?: string}): void} => {
      if (tag !== 'optgroup') throw new Error(`fake select: no ${tag}`);
      const group = {label: info.attr?.label ?? '', values: [] as string[]};
      this.selectEl.groups.push(group);
      return {
        createEl: (_tag: string, option: {value?: string}) => {
          const value = option.value ?? '';
          group.values.push(value);
          this.selectEl.options.push({value});
        },
      };
    },
  };
  changed: ((value: never) => unknown) | null = null;
  setValue(value: string | boolean): this {
    this.value = value;
    if (typeof value === 'string') this.inputEl.value = value;
    return this;
  }
  getValue(): string {
    return this.inputEl.value;
  }
  setPlaceholder(): this {
    return this;
  }
  setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    return this;
  }
  addOption(value: string): this {
    this.options.push(value);
    this.selectEl.options.push({value});
    return this;
  }
  onChange(callback: (value: never) => unknown): this {
    this.changed = callback;
    return this;
  }
  /** What the user does: types `text` and leaves the field. */
  type(text: string): void {
    this.inputEl.value = text;
    this.inputEl.fire('change');
  }
}

export class FakeButton {
  icon = '';
  clicked: (() => unknown) | null = null;
  setIcon(icon: string): this {
    this.icon = icon;
    return this;
  }
  setTooltip(): this {
    return this;
  }
  setButtonText(): this {
    return this;
  }
  onClick(callback: () => unknown): this {
    this.clicked = callback;
    return this;
  }
}

export class FakeSetting {
  name = '';
  desc = '';
  heading = false;
  readonly descEl = new FakeEl();
  readonly controls: FakeControl[] = [];
  readonly buttons: FakeButton[] = [];
  constructor() {
    made.push(this);
  }
  setName(name: string): this {
    this.name = name;
    return this;
  }
  setDesc(desc: string): this {
    this.desc = desc;
    return this;
  }
  setHeading(): this {
    this.heading = true;
    return this;
  }
  private control(kind: string, build: (c: FakeControl) => void): this {
    const control = new FakeControl();
    control.kind = kind;
    this.controls.push(control);
    build(control);
    return this;
  }
  addText(build: (c: FakeControl) => void): this {
    return this.control('text', build);
  }
  addToggle(build: (c: FakeControl) => void): this {
    return this.control('toggle', build);
  }
  addDropdown(build: (c: FakeControl) => void): this {
    return this.control('dropdown', build);
  }
  addExtraButton(build: (b: FakeButton) => void): this {
    const button = new FakeButton();
    this.buttons.push(button);
    build(button);
    return this;
  }
  addButton(build: (b: FakeButton) => void): this {
    return this.addExtraButton(build);
  }
}
export {FakeSetting as Setting};

export class FakeModal {
  readonly titleEl = new FakeEl();
  readonly contentEl = new FakeEl();
  constructor(readonly app: unknown) {
    modals.push(this);
  }
  open(): void {
    // Not drawn: a test that needs the dialog reads `modals`.
  }
  close(): void {}
}
export {FakeModal as Modal};

/** Forgets what earlier tests made. */
export function resetFake(): void {
  notices.length = 0;
  made.length = 0;
  modals.length = 0;
}

export class TFile {
  readonly extension: string;
  constructor(readonly path: string) {
    this.extension = path.slice(path.lastIndexOf('.') + 1);
  }
}

/** The view base class: a content element and the events it registers. */
export class ItemView {
  readonly contentEl = new FakeEl();
  readonly app: FakeApp;
  readonly events: {name: string; callback: (...args: never[]) => void}[] = [];
  constructor(readonly leaf: {app: FakeApp}) {
    this.app = leaf.app;
  }
  registerEvent(ref: {
    name: string;
    callback: (...args: never[]) => void;
  }): void {
    this.events.push(ref);
  }
  /** What Obsidian does when an event fires. */
  emit(name: string, ...args: unknown[]): void {
    for (const e of this.events)
      if (e.name === name) (e.callback as (...a: unknown[]) => void)(...args);
  }
}

export class FakeApp {
  active: TFile | null = null;
  readonly vault = {
    on: (name: string, callback: (...args: never[]) => void) => ({
      name,
      callback,
    }),
  };
  readonly workspace = {
    on: (name: string, callback: (...args: never[]) => void) => ({
      name,
      callback,
    }),
    getActiveFile: () => this.active,
  };
}
