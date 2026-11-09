// Plugin entry point: the compiler (US-007), the plugin data and the presets
// (US-008). The export command and the settings tab come with TICKET-023 and
// TICKET-024.
import {
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  TFolder,
  normalizePath,
  type MarkdownPostProcessorContext,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  createActions,
  panelOpener,
  type ActionDeps,
  type Actions,
} from './actions';
import {
  activePresetView,
  imageFileEntries,
  menuItemTitle,
  noteMenuEntries,
  presetEditEntries,
  ribbonMenuEntries,
  type MenuEntry,
} from './menus';
import {lineContext} from '../core/convert';
import {isPresetNote} from '../core/presets';
import {
  createTypstCompiler,
  type TypstCompiler,
  type VectorCompiler,
} from './compiler';
import type {CompileRequest} from '../core/compile';
import {embeddedFonts} from './compiler/embedded-fonts';
import {compileFonts} from './compile-fonts';
import {
  embeddedCompilerWasm,
  embeddedRendererWasm,
} from './compiler/embedded-wasm';
import {startWorker} from './compiler/start-worker';
import {createDiskWriter} from './disk-writer';
import {
  createEntriesApi,
  createEntryProcessor,
  headingAbove,
  inQuote,
  type PreviewDeps,
} from './entries/processor';
import {
  composeApi,
  createDetailsApi,
  createDetailsProcessor,
  type DetailsDeps,
  type PluginApi,
} from './details/processor';
import {createFontSet} from './fonts';
import {createExportHost} from './obsidian/export-host';
import {chooseExportFolder} from './obsidian/folder-dialog';
import {
  createFontVault,
  createNoteSource,
  createVaultFiles,
} from './obsidian/vault-access';
import {createVaultPort} from './obsidian/vault-port';
import {downsampleImage} from './preview/browser-downsample';
import {
  createPreviewController,
  type CompileJob,
  type PreviewCompile,
  type PreviewState,
} from './preview/controller';
import {VIEW_TYPE_STYLE_PANEL} from './preview/open';
import {StylePanelView} from './preview/panel';
import {createPageRenderer} from './preview/renderer';
import {preparePreview} from './preview/request';
import type {ExportRequest} from './export-command';
import {createExportLock, runExport, type ExportResult} from './run-export';
import {createPresetStore, type PresetStore} from './presets/store';
import {PresetDetailsModal} from './settings/details-modal';
import {NameModal} from './settings/name-modal';
import {presetScreenActions} from './settings/preset-actions';
import {ConfirmModal} from './settings/rows';
import {Obsidian2TypstSettingTab} from './settings/settings-tab';
import {
  RESET_NOTICE,
  createSettingsStore,
  onActivePresetChange,
  type SettingsStore,
} from './settings/data';

export default class Obsidian2TypstPlugin extends Plugin {
  /** The compile service; one worker per compile (US-007 AC-3b). */
  readonly compiler: TypstCompiler & VectorCompiler = createTypstCompiler({
    createWorker: startWorker,
    compilerWasm: embeddedCompilerWasm,
  });

  /** US-010: the bundled and vault fonts (kept per preset folder on demand). */
  readonly fontSet = createFontSet({
    bundled: embeddedFonts,
    vault: createFontVault(this.app),
    compiler: this.compiler,
  });

  /** US-008 AC-8: the plugin data in `data.json`. */
  readonly pluginSettings: SettingsStore = createSettingsStore({
    load: () => this.loadData() as Promise<unknown>,
    save: (data) => this.saveData(data),
  });

  /** US-008 AC-3, US-022 AC-7: the vault port of the preset notes. */
  private readonly presetNotes = createVaultPort(this.app);

  /** US-008 AC-3: the preset notes of the vault. */
  readonly presets: PresetStore = createPresetStore({
    vault: this.presetNotes,
    folder: () => this.pluginSettings.data.presetsFolder,
    defaults: () => this.pluginSettings.data.defaults,
    notify: (text) => void new Notice(text),
  });

  /** US-012: draws the vector documents of the preview. */
  private readonly pageRenderer = createPageRenderer({
    rendererWasm: embeddedRendererWasm,
  });

  private readonly previewListeners = new Set<(state: PreviewState) => void>();

  /** US-012: one controller for the preview; the panel listens to it. */
  readonly preview = createPreviewController({
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
    prepare: async (path) =>
      preparePreview(
        {
          notes: createNoteSource(this.app),
          vault: createVaultFiles(this.app),
          presets: this.presets,
          fonts: this.fontSet,
          settings: this.pluginSettings,
        },
        path,
        {downsample: downsampleImage, bundledFonts: await embeddedFonts()},
      ),
    compile: (request) => this.compilePreview(request),
    onState: (state) => {
      for (const listener of this.previewListeners) listener(state);
    },
  });

  /**
   * US-035 AC-1, AC-7: what the `o2t-entry` preview reads, each time a
   * block is drawn (SCAR-016): the active preset (`pickActive`, as every
   * other part of the plugin), the icon files, the block's place.
   */
  private readonly entryDeps: PreviewDeps = {
    settings: async () => {
      const view = this.activeView();
      if (!view.valid || view.fields === null) return null;
      return {entries: view.fields.entries, colorMode: view.fields.colorMode};
    },
    readIcon: async (path) => {
      const at = normalizePath(path);
      const adapter = this.app.vault.adapter;
      return (await adapter.exists(at)) ? adapter.read(at) : null;
    },
    heading: (handle) => {
      const place = this.blockPlace(handle);
      return place === null ? null : headingAbove(place.lines, place.at);
    },
    fileName: (handle) => {
      const path = (handle as {ctx: MarkdownPostProcessorContext}).ctx
        .sourcePath;
      return path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
    },
    inContainer: (handle) => {
      const place = this.blockPlace(handle);
      return place !== null && inQuote(place.lines, place.at);
    },
  };

  /** US-035 AC-1: the processor of `o2t-entry` blocks. */
  private readonly entryProcessor = createEntryProcessor(this.entryDeps);

  /**
   * US-038 AC-14: what the details preview reads: the same readers as the
   * statblock's, and the active preset's `details` group.
   */
  private readonly detailsDeps: DetailsDeps = {
    ...this.entryDeps,
    settings: async () => {
      const view = this.activeView();
      if (!view.valid || view.fields === null) return null;
      return {details: view.fields.details, colorMode: view.fields.colorMode};
    },
  };

  /** US-038 AC-14: the processor of details blocks. */
  private readonly detailsProcessor = createDetailsProcessor(this.detailsDeps);

  /**
   * US-035 AC-11 (decision 1): the drawing API for the author's vault views,
   * `app.plugins.plugins["obsidian2typst"].api` (documented in the manual).
   */
  api: PluginApi | null = null;

  /** US-020 AC-1: what the actions are built over. */
  private readonly actionDeps: ActionDeps = {
    notes: createNoteSource(this.app),
    vault: createVaultFiles(this.app),
    presets: this.presets,
    fonts: this.fontSet,
    settings: this.pluginSettings,
    chooseFolder: chooseExportFolder,
    notice: (text) => void new Notice(text),
    run: (request) => this.runExportRequest(request),
    showNote: (path) => this.showNote(path),
    openPanel: panelOpener({
      getLeavesOfType: (type) => this.app.workspace.getLeavesOfType(type),
      getRightLeaf: () => this.app.workspace.getRightLeaf(false),
      revealLeaf: (leaf) =>
        this.app.workspace.revealLeaf(leaf as WorkspaceLeaf),
    }),
    presetNotes: this.presetNotes,
    confirm: (question) =>
      new Promise((resolve) =>
        new ConfirmModal(this.app, question, resolve).open(),
      ),
  };

  /** US-020 AC-1: the actions every entry point calls. */
  private readonly actions: Actions = createActions(this.actionDeps);

  override async onload(): Promise<void> {
    const {reset} = await this.pluginSettings.load();
    if (reset) new Notice(RESET_NOTICE);
    this.addSettingTab(
      new Obsidian2TypstSettingTab(this.app, this, {
        settings: this.pluginSettings,
        presets: this.presets,
        fonts: this.fontSet,
        usePreset: (name) => this.actions.usePreset(name),
        openDetails: (name) => this.openDetails(name),
      }),
    );
    this.registerView(
      VIEW_TYPE_STYLE_PANEL,
      (leaf) =>
        new StylePanelView(leaf, {
          settings: this.pluginSettings,
          presets: this.presets,
          fonts: this.fontSet,
          controller: this.preview,
          usePreset: (name) => this.actions.usePreset(name),
          openDetails: (name) => this.openDetails(name),
          subscribe: (listener) => {
            this.previewListeners.add(listener);
            return () => void this.previewListeners.delete(listener);
          },
        }),
    );
    this.addCommand({
      id: 'open-style-panel',
      name: 'Open style panel',
      callback: () => void this.actions.previewNote(),
    });
    this.app.workspace.onLayoutReady(() => void this.presets.load());
    // US-035 AC-1, AC-11: the o2t-entry preview and its drawing API.
    this.registerMarkdownCodeBlockProcessor('o2t-entry', (source, el, ctx) =>
      this.entryProcessor.handler(source, el, {ctx, el}),
    );
    // US-038 AC-14, AC-15: the details block's preview and `renderDetails`.
    this.registerMarkdownCodeBlockProcessor('o2t-details', (source, el, ctx) =>
      this.detailsProcessor.handler(source, el, {ctx, el}),
    );
    this.api = composeApi(
      createEntriesApi(this.entryDeps),
      createDetailsApi(this.detailsDeps),
    );
    // US-035 AC-7 (decision 2): a change of the active preset, or of its
    // note, redraws the open previews at once.
    this.register(
      onActivePresetChange(this.pluginSettings, () => this.redrawEntries()),
    );
    this.register(
      this.presets.onChange((names) => {
        if (names.includes(this.activeView().name ?? '')) this.redrawEntries();
      }),
    );
    this.addCommand({
      id: 'export-current-note',
      name: 'Export current note',
      callback: () => void this.actions.exportNote(),
    });
    this.addCommand({
      id: 'check-compiler',
      name: 'Check compiler (developer)',
      callback: () => void this.checkCompiler(),
    });
    // US-020 AC-3: the ribbon menu, built anew at each click (SCAR-016).
    this.addRibbonIcon('printer', 'Obsidian2Typst', (evt) => {
      const menu = new Menu();
      this.showEntries(
        menu,
        ribbonMenuEntries(this.actions, {
          names: this.presets.entries(),
          stored: this.pluginSettings.data.activePreset,
        }),
      );
      menu.showAtMouseEvent(evt);
    });
    // US-020 AC-6: the file explorer menu of one file (not files-menu).
    // US-022 AC-3: an image file gets the cover item; synchronous (AC-9).
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        const folder = file instanceof TFolder;
        this.showEntries(
          menu,
          noteMenuEntries(
            this.actions,
            {path: file.path, folder},
            this.pluginSettings.data.presetsFolder,
          ),
          'obsidian2typst',
        );
        if (folder) return;
        this.showEntries(
          menu,
          imageFileEntries(this.actions, file.path, this.activeView()),
          'obsidian2typst',
        );
      }),
    );
    // US-020 AC-7: the editor menu, for the note of that editor; Preview
    // activates that editor's pane (AC-8).
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, info) => {
        const file = info.file;
        if (file === null) return;
        const leaf = info instanceof MarkdownView ? info.leaf : null;
        const actions =
          leaf === null
            ? this.actions
            : createActions({
                ...this.actionDeps,
                showNote: async () =>
                  this.app.workspace.setActiveLeaf(leaf, {focus: true}),
              });
        this.showEntries(
          menu,
          noteMenuEntries(
            actions,
            {path: file.path, folder: false},
            this.pluginSettings.data.presetsFolder,
          ),
          'obsidian2typst',
        );
        // US-022 AC-1, AC-3, AC-9, AC-11: the line of the cursor, from what
        // is in memory now (no file is read: the menu is built synchronously).
        if (isPresetNote(file.path, this.pluginSettings.data.presetsFolder)) {
          return;
        }
        const view = this.activeView();
        const context = lineContext(
          editor.getValue(),
          editor.getCursor().line,
          file.path,
          this.actionDeps.vault.files(),
          view.fields?.headingRules,
        );
        this.showEntries(
          menu,
          presetEditEntries(actions, context, view),
          'obsidian2typst',
        );
      }),
    );
  }

  /**
   * US-035 AC-1, AC-9: the note's lines and the block's first line, from the
   * section info of the processor's context; null when Obsidian gives none.
   */
  private blockPlace(handle: unknown): {lines: string[]; at: number} | null {
    const {ctx, el} = handle as {
      ctx: MarkdownPostProcessorContext;
      el: HTMLElement;
    };
    const info = ctx.getSectionInfo(el);
    if (info === null) return null;
    return {lines: info.text.split('\n'), at: info.lineStart};
  }

  /**
   * US-035 AC-7 (decision 2): forgets the icons and redraws every open note
   * holding an `o2t-entry` block: reading views with
   * `previewMode.rerender(true)`; live-preview editors through a refresh of
   * the editor options, which rebuilds their block widgets (not measured;
   * the manual check covers it).
   */
  private redrawEntries(): void {
    this.entryProcessor.clearIconCache();
    this.detailsProcessor.clearIconCache();
    this.api?.clearIconCache();
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      const text = view.getViewData();
      if (!text.includes('```o2t-entry') && !text.includes('```o2t-details'))
        continue;
      view.previewMode.rerender(true);
    }
    this.app.workspace.updateOptions();
  }

  /** US-022 AC-6: the active preset as the menus see it when they open. */
  private activeView(): ReturnType<typeof activePresetView> {
    return activePresetView(
      this.presets.entries(),
      this.pluginSettings.data.activePreset,
      this.pluginSettings.data.defaults,
    );
  }

  /**
   * US-020 AC-3, AC-6, AC-7: draws menu entries into an Obsidian menu, the
   * only place that turns a `MenuEntry` into a menu item (SCAR-017). The note
   * menus pass `section`, so their two items stay together among Obsidian's
   * own items; the plugin's own ribbon menu needs none.
   * US-029 AC-10: an entry drawn with a section gets the plugin's prefix
   * (`menuItemTitle`); the ribbon menu's titles stay as they are.
   */
  private showEntries(
    menu: Menu,
    entries: readonly MenuEntry[],
    section?: string,
  ): void {
    for (const entry of entries) {
      if (entry.separator === true) {
        menu.addSeparator();
        continue;
      }
      menu.addItem((item) => {
        // US-029 AC-10: the plugin's prefix in the shared menus (with a section).
        item.setTitle(menuItemTitle(entry, section !== undefined));
        if (section !== undefined) item.setSection(section);
        if (entry.icon !== undefined) item.setIcon(entry.icon);
        if (entry.checked !== undefined) item.setChecked(entry.checked);
        if (entry.disabled === true) item.setDisabled(true);
        if (entry.label === true) item.setIsLabel(true);
        const run = entry.run;
        if (run !== undefined) item.onClick(() => void run());
      });
    }
  }

  /** One export at a time (US-007 AC-3). */
  private readonly exportLock = createExportLock();

  /**
   * US-008 AC-15 | US-007 AC-1: runs one export request; the preview waits
   * while it runs (US-012 AC-9).
   */
  private async runExportRequest(
    request: ExportRequest,
  ): Promise<ExportResult> {
    this.preview.exportStarted();
    try {
      return await runExport({
        ...request,
        host: createExportHost(this.app, createDiskWriter(request.exportDir)),
        compiler: this.compiler,
        fonts: compileFonts(await embeddedFonts(), request.fonts),
        lock: this.exportLock,
      });
    } finally {
      this.preview.exportFinished();
    }
  }

  /**
   * US-021 AC-8 | US-029 AC-6, AC-8: opens the preset screen of the preset
   * `name` (the tab's gear and the panel's `info` button). Duplicate, Rename
   * and Delete are `presetScreenActions` with Obsidian's dialogs and notices.
   */
  private openDetails(name: string): void {
    const settings = this.pluginSettings;
    new PresetDetailsModal(
      this.app,
      {
        presets: this.presets,
        settings,
        usePreset: (preset) => this.actions.usePreset(preset),
        openNote: (path) => this.showNote(path),
        ...presetScreenActions({
          presets: this.presets,
          settings,
          askName: (title, initial, submit) =>
            new Promise<void>((resolve) =>
              new NameModal(this.app, title, initial, submit, resolve).open(),
            ),
          confirm: (text) =>
            new Promise<boolean>((resolve) =>
              new ConfirmModal(this.app, text, resolve).open(),
            ),
          notify: (text) => void new Notice(text),
        }),
      },
      name,
    ).open();
  }

  /**
   * US-020 AC-8: makes the note at `path` the active note, as a click on it in
   * the file explorer does (the current tab, or a new one when it is pinned).
   */
  private async showNote(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    if (file !== null) await this.app.workspace.getLeaf(false).openFile(file);
  }

  /**
   * US-012 AC-8, AC-13: compiles the request to the vector format and opens it
   * in the page renderer; `cancel` ends the worker.
   */
  private compilePreview(request: CompileRequest): CompileJob {
    const job = this.compiler.startVector(request);
    const result = (async (): Promise<PreviewCompile> => {
      const vector = await job.result;
      if (!vector.ok) return {ok: false, error: vector.error};
      const document = await this.pageRenderer.open(vector.vector);
      if (document.pageCount === 0) {
        document.dispose();
        return {ok: false, error: 'The document has no pages'};
      }
      return {
        ok: true,
        pageCount: document.pageCount,
        pageSize: document.pageSize(1),
        document,
        release: () => document.dispose(),
        // US-028 AC-5: the decisions reach the preview's warning count.
        ...(vector.fitDecisions === undefined
          ? {}
          : {fitDecisions: vector.fitDecisions}),
        // US-028 AC-14 (decision C): so does a layout that did not settle.
        ...(vector.settled === undefined ? {} : {settled: vector.settled}),
        // US-032 AC-10: the entries' facts reach the warning count.
        ...(vector.entryPlaces === undefined || vector.entryEnds === undefined
          ? {}
          : {
              entryPlaces: vector.entryPlaces,
              entryEnds: vector.entryEnds,
              entrySections: vector.entrySections ?? [],
            }),
        // US-034 AC-2: the drawn widths reach the IMAGE_LOW_DPI count.
        ...(vector.images === undefined ? {} : {images: vector.images}),
        // US-036 AC-3: the sheet page's small-boxes warning is counted.
        ...(vector.sheets === undefined ? {} : {sheets: vector.sheets}),
      };
    })();
    return {result, cancel: () => job.cancel()};
  }

  override onunload(): void {
    this.preview.dispose();
    this.compiler.dispose();
    this.presets.dispose();
  }

  /**
   * US-007 AC-9, manual procedure M1: compiles a test document through the real
   * worker and the embedded compiler and reports the longest gap between two
   * event-loop turns on the main thread.
   */
  private async checkCompiler(): Promise<void> {
    new Notice('Compiling…');
    let last = performance.now();
    let longestGap = 0;
    const timer = window.setInterval(() => {
      const now = performance.now();
      longestGap = Math.max(longestGap, now - last);
      last = now;
    }, 10);
    const started = performance.now();
    const result = await this.compiler.compile({
      file: 'check.typ',
      source: '= Compiler check\n\nHello from the embedded compiler.\n',
      files: {},
      fonts: await embeddedFonts(),
    });
    window.clearInterval(timer);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    const outcome = result.ok
      ? `PDF ${new TextDecoder().decode(result.pdf.subarray(0, 5))}, ${result.pdf.length} bytes`
      : result.error;
    const line = `${new Date().toISOString()}: ${outcome}; ${seconds} s; longest gap ${Math.round(longestGap)} ms`;
    const adapter = this.app.vault.adapter;
    const path = 'o2t-check.md';
    const before = (await adapter.exists(path)) ? await adapter.read(path) : '';
    await adapter.write(path, `${before}${line}\n`);
    new Notice(line, 10000);
  }
}
