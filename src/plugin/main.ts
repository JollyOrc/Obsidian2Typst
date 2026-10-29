// Plugin entry point: the compiler (US-007), the plugin data and the presets
// (US-008). The export command and the settings tab come with TICKET-023 and
// TICKET-024.
import {
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  TFolder,
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
import {ConfirmModal} from './settings/rows';
import {Obsidian2TypstSettingTab} from './settings/settings-tab';
import {
  RESET_NOTICE,
  createSettingsStore,
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
        item.setTitle(entry.title ?? '');
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

  /** US-021 AC-8: opens the details pop-up of the preset `name`. */
  private openDetails(name: string): void {
    new PresetDetailsModal(
      this.app,
      {
        presets: this.presets,
        settings: this.pluginSettings,
        usePreset: (preset) => this.actions.usePreset(preset),
        openNote: (path) => this.showNote(path),
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
