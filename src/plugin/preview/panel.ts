// US-012 AC-1 to AC-5, AC-7, AC-11, AC-14, AC-15: the style panel. A view in the
// right sidebar with the rows of the Settings tab (the shared rows module), the
// page range, a button, a status text and the drawn pages. It draws and
// listens; which note is shown, when a compile starts and which result counts
// is decided by the controller. The panel writes no preset note.
import {ItemView, Setting, TFile, type WorkspaceLeaf} from 'obsidian';
import {planCanvases} from '../../core/preview/canvas';
import {ownerNote, shownValue} from '../../core/presets/owner';
import {formatPresetError, getField, type FieldPath} from '../../core/presets';
import type {FontSet} from '../fonts';
import type {PresetStore} from '../presets/store';
import {commitOnChange} from '../settings/commit';
import type {SettingsStore} from '../settings/data';
import {
  addDefaultRows,
  addFontRows,
  addPresetDropdown,
  addRangeInput,
  createTrimState,
  type RowsEnv,
} from '../settings/rows';
import {captureScroll, type ScrollNode} from '../settings/scroll';
import {makePageCanvas, inspectPage, type DrawingCanvas} from './canvas';
import type {PreviewController, PreviewState} from './controller';
import {
  VIEW_TYPE_STYLE_PANEL,
  presetDropdownGroups,
  previewStatus,
} from './open';
import type {RenderedDocument} from './renderer';

/** What the panel needs from the plugin. */
export interface StylePanelDeps {
  settings: SettingsStore;
  presets: PresetStore;
  fonts: FontSet;
  controller: PreviewController;
  /** US-020 AC-1: the action behind the preset dropdown. */
  usePreset(name: string): Promise<void>;
  /** US-021 AC-8: opens the details pop-up of a preset. */
  openDetails(name: string): void;
  /** Listens to the state of the controller; returns the way to stop. */
  subscribe(listener: (state: PreviewState) => void): () => void;
}

/** Pixels per point of a drawn page (A5 at 2 px/pt is about 840 px wide). */
const PIXEL_PER_POINT = 2;
/** Space between two pages in the preview, in CSS pixels (see styles.css). */
const PAGE_GAP = 8;

const log = (text: string): void => console.log(`[o2t preview] ${text}`);

/** The one view of the style panel. */
export class StylePanelView extends ItemView {
  private readonly stops: (() => void)[] = [];
  private readonly trim = createTrimState();
  private restoreScroll: () => void = () => undefined;
  private rowsEl: HTMLElement | null = null;
  private selectorEl: HTMLElement | null = null;
  private messageEl: HTMLElement | null = null;
  private lineEl: HTMLElement | null = null;
  private areaEl: HTMLElement | null = null;
  /** True while a save that this panel started runs (no redraw of its rows). */
  private ownSave = false;
  /** What the conversion reads, as text: tells a style change from another. */
  private styleKey = '';
  private readonly drawn = new Map<number, DrawingCanvas>();
  /** The document and pages the placeholders were made for. */
  private placed: {document: unknown; key: string} | null = null;
  private painting = false;
  private paintAgain = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: StylePanelDeps,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_STYLE_PANEL;
  }

  getDisplayText(): string {
    return 'Style preview';
  }

  override getIcon(): string {
    return 'book-open';
  }

  /** The active preset's fields, or null when it cannot be used. */
  private activeFields(): {name: string; fields: unknown} | null {
    const name = this.deps.settings.data.activePreset;
    const used = this.deps.presets.use(name);
    return used.ok ? {name, fields: used.preset.fields} : null;
  }

  /** The rows' host: the same functions as the Settings tab (AC-15). */
  private rowsEnv(): RowsEnv {
    const {settings, presets, fonts} = this.deps;
    // A change saved from a row must not redraw the row the user is in.
    const own: SettingsStore = Object.create(settings, {
      setDefaults: {
        value: async (fields: Parameters<SettingsStore['setDefaults']>[0]) => {
          this.ownSave = true;
          try {
            return await settings.setDefaults(fields);
          } finally {
            this.ownSave = false;
          }
        },
      },
    });
    return {
      app: this.app,
      settings: own,
      presets,
      fonts,
      redraw: () => this.drawControls(),
      ownerNote: (path) => {
        const active = this.activeFields();
        return active === null
          ? null
          : ownerNote(active.name, active.fields, path);
      },
      shown: (path) =>
        shownValue(
          this.activeFields()?.fields ?? {},
          settings.data.defaults,
          path,
        ),
      trim: this.trim,
    };
  }

  /** The selector and the rows (US-012 AC-1, AC-2, AC-3). */
  private drawControls(): void {
    const selector = this.selectorEl;
    const rows = this.rowsEl;
    if (selector === null || rows === null) return;
    const holder = this.contentEl;
    this.restoreScroll = captureScroll(holder as unknown as ScrollNode);
    selector.empty();
    rows.empty();
    this.presetSelector(selector);
    const env = this.rowsEnv();
    this.pageRows(rows, env);
    this.fontRows(rows, env);
    this.coverRows(rows);
    this.restoreScroll();
    requestAnimationFrame(() => this.restoreScroll());
  }

  private presetSelector(root: HTMLElement): void {
    const {settings, presets} = this.deps;
    const entries = presets.entries().map((entry) => ({
      name: entry.name,
      valid: entry.valid,
      group: entry.group,
      error:
        entry.error === undefined ? undefined : formatPresetError(entry.error),
    }));
    addPresetDropdown(
      root,
      presetDropdownGroups(entries, settings.data.activePreset),
      (name) => void this.deps.usePreset(name),
    ).addExtraButton((b) =>
      // US-021 AC-8: the active preset of the moment of the click (SCAR-016).
      b
        .setIcon('info')
        .setTooltip('Details of the preset')
        .onClick(() =>
          this.deps.openDetails(this.deps.settings.data.activePreset),
        ),
    );
  }

  /** The Page group: the page rows of the Defaults (US-009). */
  private pageRows(root: HTMLElement, env: RowsEnv): void {
    new Setting(root).setName('Page').setHeading();
    addDefaultRows(root, env);
  }

  /** The Fonts group (US-010). */
  private fontRows(root: HTMLElement, env: RowsEnv): void {
    new Setting(root).setName('Fonts').setHeading();
    const holder = root.createDiv();
    void addFontRows(holder, env).finally(() => this.restoreScroll());
  }

  /**
   * The Cover group (US-011): cover settings exist in preset notes only, so the
   * rows show the effective values and are not editable here.
   */
  private coverRows(root: HTMLElement): void {
    new Setting(root).setName('Cover').setHeading();
    const active = this.activeFields();
    const set = getField(
      (active?.fields ?? {}) as Record<string, unknown>,
      ['cover'] as FieldPath,
    ) as Record<string, unknown> | undefined;
    const rows: [string, string, unknown, unknown][] = [
      ['Cover', 'mode', set?.['mode'], 'auto'],
      ['Cover image', 'file', set?.['file'], 'none'],
      [
        'Blank page after cover',
        'blankPageAfter',
        set?.['blankPageAfter'],
        false,
      ],
      [
        'Crop warning (%)',
        'cropWarningPercent',
        set?.['cropWarningPercent'],
        5,
      ],
    ];
    for (const [label, , value, builtin] of rows) {
      const owned = value !== undefined && value !== null && value !== '';
      const shown = String(owned ? value : builtin);
      new Setting(root)
        .setName(label)
        .setDesc(
          owned && active !== null
            ? `${shown}; set by preset "${active.name}"; change it in the preset note`
            : `${shown}; built-in value; set it in a preset note`,
        );
    }
  }

  override async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass('o2t-panel');
    this.selectorEl = root.createDiv();
    this.rowsEl = root.createDiv();
    this.drawControls();
    const rangeField = addRangeInput(
      root,
      this.deps.controller.state.rangeText,
    );
    commitOnChange(
      rangeField.input,
      () => rangeField.input.value,
      (text) => this.deps.controller.setRange(text),
    );
    this.messageEl = root.createDiv({cls: 'o2t-range-message'});
    new Setting(root).addButton((b) =>
      b.setButtonText('Refresh').onClick(() => this.deps.controller.refresh()),
    );
    const statusLine = root.createDiv({cls: 'o2t-status'});
    this.lineEl = statusLine;
    const previewArea = root.createDiv({cls: 'o2t-preview-area'});
    this.areaEl = previewArea;
    previewArea.addEventListener('scroll', () => this.schedulePaint());

    this.styleKey = this.currentStyleKey();
    const onStyle = (): void => {
      const key = this.currentStyleKey();
      if (key === this.styleKey) return;
      this.styleKey = key;
      if (!this.ownSave) this.drawControls();
      this.deps.controller.styleChanged();
    };
    const offSettings = this.deps.settings.onChange(onStyle);
    const offPresets = this.deps.presets.onChange(() => {
      this.drawControls();
      this.styleKey = this.currentStyleKey();
      this.deps.controller.styleChanged();
    });
    const stopListening = this.deps.subscribe((state) => this.show(state));
    this.stops.push(offSettings, offPresets, stopListening);
    // The note's name and removal; never its text (US-012 AC-5).
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) =>
        this.deps.controller.renamed(oldPath, file.path),
      ),
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) =>
        this.deps.controller.deleted(file.path),
      ),
    );
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => this.followNote()),
    );
    this.followNote();
    this.show(this.deps.controller.state);
  }

  override async onClose(): Promise<void> {
    for (const off of this.stops.splice(0)) off();
    // Frees the document and ends a running compile (US-012 AC-8).
    this.deps.controller.setNote(null);
    this.releaseAll();
    this.contentEl.empty();
  }

  /** Text of what the conversion reads; read now, never kept from a drawing. */
  private currentStyleKey(): string {
    const data = this.deps.settings.data;
    return JSON.stringify([
      data.defaults,
      data.activePreset,
      data.strictMode,
      data.presetsFolder,
    ]);
  }

  /** US-012 AC-4: the last Markdown note that was active. */
  private followNote(): void {
    const file = this.app.workspace.getActiveFile();
    if (file instanceof TFile && file.extension.toLowerCase() === 'md') {
      this.deps.controller.setNote(file.path);
    }
  }

  /** Shows a state of the controller: texts, placeholders, drawing. */
  private show(state: PreviewState): void {
    const line = this.lineEl;
    const area = this.areaEl;
    if (line === null || area === null) return;
    line.setText(previewStatus(state));
    this.messageEl?.setText(state.rangeError ?? state.rangeMessage ?? '');
    area.toggleClass('o2t-preview-greyed', state.greyed);
    if (state.pages === null) {
      this.releaseAll();
      area.empty();
      this.placed = null;
      if (state.status === 'no-note') {
        area.createEl('p', {
          cls: 'setting-item-description',
          text: 'Open a note to preview it',
        });
      }
      return;
    }
    const key = state.shown.join(',');
    if (
      this.placed === null ||
      this.placed.document !== state.pages.document ||
      this.placed.key !== key
    ) {
      this.releaseAll();
      area.empty();
      this.placed = {document: state.pages.document, key};
      for (const page of state.shown) {
        const slot = area.createDiv({cls: 'o2t-preview-page'});
        slot.dataset['page'] = String(page);
        slot.style.aspectRatio = `${state.pages.size.width} / ${state.pages.size.height}`;
      }
    }
    // Nothing is drawn while the pages are greyed (`paintOnce`, AC-11).
    this.schedulePaint();
  }

  private schedulePaint(): void {
    requestAnimationFrame(() => void this.paint());
  }

  private releaseAll(): void {
    for (const canvas of this.drawn.values()) canvas.release();
    this.drawn.clear();
  }

  /** US-012 AC-7: draws the pages near the visible part, releases far ones. */
  private async paint(): Promise<void> {
    if (this.painting) {
      this.paintAgain = true;
      return;
    }
    this.painting = true;
    try {
      do {
        this.paintAgain = false;
        await this.paintOnce();
      } while (this.paintAgain);
    } finally {
      this.painting = false;
    }
  }

  private async paintOnce(): Promise<void> {
    const area = this.areaEl;
    const state = this.deps.controller.state;
    if (area === null || state.pages === null || state.greyed) return;
    const document = state.pages.document as RenderedDocument;
    const first = area.querySelector<HTMLElement>('.o2t-preview-page');
    const plan = planCanvases({
      pages: state.shown,
      drawn: new Set(this.drawn.keys()),
      scrollTop: area.scrollTop,
      viewport: area.clientHeight,
      pageHeight: first?.offsetHeight ?? 0,
      gap: PAGE_GAP,
    });
    for (const page of plan.release) {
      this.drawn.get(page)?.release();
      this.drawn.delete(page);
      log(`page ${page} released`);
    }
    for (const page of plan.draw) {
      const slot = area.querySelector<HTMLElement>(
        `.o2t-preview-page[data-page="${page}"]`,
      );
      if (slot === null) continue;
      try {
        const size = document.pageSize(page);
        const canvas = makePageCanvas(size.width, size.height, PIXEL_PER_POINT);
        slot.appendChild(canvas.canvas);
        await document.draw(page, canvas.context, canvas.pixelPerPt);
        // The document may have been replaced while the page was drawn.
        if (this.deps.controller.state.pages?.document !== document) {
          canvas.release();
          return;
        }
        inspectPage(page, canvas);
        this.drawn.set(page, canvas);
      } catch (error) {
        log(`page ${page} not drawn: ${String(error)}`);
      }
    }
  }
}
