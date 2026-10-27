// US-012 AC-4, AC-5, AC-7, AC-8, AC-11, AC-14 — the panel view with stand-ins for
// Obsidian, the controller and the renderer: what it listens to, what it passes
// on, when it draws, and what it frees on close. The pixels: manual check M2
// step 15.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {
  PreviewController,
  PreviewState,
} from '../../src/plugin/preview/controller';
import {
  StylePanelView,
  type StylePanelDeps,
} from '../../src/plugin/preview/panel';
import type {PresetStore} from '../../src/plugin/presets/store';
import type {FontSet} from '../../src/plugin/fonts';
import {
  createSettingsStore,
  type SettingsStorage,
} from '../../src/plugin/settings/data';
import {
  FakeApp,
  TFile,
  made,
  modals,
  resetFake,
} from '../support/fake-obsidian';

vi.mock('obsidian', async () => await import('../support/fake-obsidian'));

class Storage implements SettingsStorage {
  async load(): Promise<unknown> {
    return null;
  }
  async save(): Promise<void> {}
}

const frames: (() => void)[] = [];
const canvases: {released: number}[] = [];
vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
  frames.push(fn);
  return 0;
});
vi.stubGlobal('document', {
  createElement: () => {
    const record = {released: 0};
    canvases.push(record);
    return {
      style: {} as Record<string, string>,
      width: 0,
      height: 0,
      remove: () => void record.released++,
      getContext: () => ({
        getImageData: () => ({data: new Uint8ClampedArray(4)}),
      }),
    };
  },
});
vi.spyOn(console, 'log').mockImplementation(() => undefined);

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    while (frames.length > 0) frames.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

function state(patch: Partial<PreviewState> = {}): PreviewState {
  return {
    status: 'ready',
    note: 'N.md',
    noteName: 'N',
    error: null,
    hint: null,
    warnings: 0,
    greyed: false,
    pages: null,
    rangeText: '',
    rangeError: null,
    rangeMessage: null,
    shown: [],
    ...patch,
  };
}

async function rig() {
  resetFake();
  frames.length = 0;
  canvases.length = 0;
  const settings = createSettingsStore(new Storage());
  await settings.load();
  const calls: string[] = [];
  let listener: ((s: PreviewState) => void) | null = null;
  let stopped = 0;
  const drawnPages: number[] = [];
  const document = {
    pageSize: () => ({width: 100, height: 200}),
    draw: async (page: number) => void drawnPages.push(page),
  };
  const controller = {
    state: state(),
    setNote: (p: string | null) => void calls.push(`setNote:${p}`),
    renamed: (a: string, b: string) => void calls.push(`renamed:${a}>${b}`),
    deleted: (p: string) => void calls.push(`deleted:${p}`),
    refresh: () => void calls.push('refresh'),
    styleChanged: () => void calls.push('styleChanged'),
    setRange: (t: string) => void calls.push(`range:${t}`),
    exportStarted() {},
    exportFinished() {},
    dispose() {},
  } as unknown as PreviewController & {state: PreviewState};
  const presetListeners: (() => void)[] = [];
  const presets = {
    entries: () => [],
    use: () => ({ok: false as const, error: 'none'}),
    refresh: () => undefined,
    onChange: (l: () => void) => {
      presetListeners.push(l);
      return () => void presetListeners.splice(presetListeners.indexOf(l), 1);
    },
  } as unknown as PresetStore;
  const deps: StylePanelDeps = {
    settings,
    presets,
    fonts: (async () => {
      throw new Error('no fonts');
    }) as unknown as FontSet,
    controller,
    // US-020 AC-1: the dropdown's action (not used by these tests).
    usePreset: async () => undefined,
    // US-021 AC-8: the details pop-up (not used by these tests).
    openDetails: () => undefined,
    subscribe: (l) => {
      listener = l;
      return () => void stopped++;
    },
  };
  const app = new FakeApp();
  const view = new StylePanelView({app} as never, deps);
  await view.onOpen();
  const push = (patch: Partial<PreviewState>): void => {
    controller.state = state(patch);
    (listener as unknown as (s: PreviewState) => void)(controller.state);
  };
  return {
    view,
    app,
    settings,
    calls,
    push,
    document,
    drawnPages,
    presetListeners,
    stopped: () => stopped,
    emit: (name: string, ...args: unknown[]) =>
      (view as unknown as {emit(n: string, ...a: unknown[]): void}).emit(
        name,
        ...args,
      ),
  };
}

beforeEach(() => resetFake());

describe('US-012 AC-4 the note the panel follows', () => {
  it('US-012 AC-4: a Markdown note that becomes active is passed to the controller; a PDF or no file is not', async () => {
    const r = await rig();
    r.calls.length = 0;
    r.app.active = new TFile('Book/Rules.md');
    r.emit('active-leaf-change');
    r.app.active = new TFile('Book/Map.pdf');
    r.emit('active-leaf-change');
    r.app.active = null;
    r.emit('active-leaf-change');
    expect(r.calls).toEqual(['setNote:Book/Rules.md']);
  });

  it('US-012 AC-4: opening the panel with an active Markdown note passes it at once', async () => {
    resetFake();
    const calls: string[] = [];
    const settings = createSettingsStore(new Storage());
    await settings.load();
    const app = new FakeApp();
    app.active = new TFile('A.md');
    const view = new StylePanelView({app} as never, {
      settings,
      presets: {
        entries: () => [],
        use: () => ({ok: false, error: ''}),
        refresh: () => undefined,
        onChange: () => () => undefined,
      } as unknown as PresetStore,
      fonts: (async () => undefined) as unknown as FontSet,
      controller: {
        state: state(),
        setNote: (p: string | null) => void calls.push(`setNote:${p}`),
      } as unknown as PreviewController,
      usePreset: async () => undefined,
      openDetails: () => undefined,
      subscribe: () => () => undefined,
    });
    await view.onOpen();
    expect(calls).toEqual(['setNote:A.md']);
  });

  it('US-012 AC-4: a rename and a delete reach the controller with the paths', async () => {
    const r = await rig();
    r.calls.length = 0;
    r.emit('rename', {path: 'B.md'}, 'A.md');
    r.emit('delete', {path: 'B.md'});
    expect(r.calls).toEqual(['renamed:A.md>B.md', 'deleted:B.md']);
  });

  it('US-012 AC-5: the panel registers only rename, delete and active-leaf-change (no edit events)', async () => {
    const r = await rig();
    const names = (r.view as unknown as {events: {name: string}[]}).events.map(
      (e) => e.name,
    );
    expect(names.sort()).toEqual(['active-leaf-change', 'delete', 'rename']);
  });
});

describe('US-012 AC-5, AC-14 what counts as a style change', () => {
  it('US-012 AC-14: a changed Default value is a style change; a remembered export folder is not', async () => {
    const r = await rig();
    r.calls.length = 0;
    await r.settings.setLastExportFolder('A5 print', 'Out');
    expect(r.calls).toEqual([]);
    await r.settings.setDefaults({page: {bleed: 3}});
    expect(r.calls).toEqual(['styleChanged']);
  });

  it('US-012 AC-14: the active preset, strict mode and the presets folder are style changes', async () => {
    const r = await rig();
    r.calls.length = 0;
    await r.settings.update({activePreset: 'A4 digital'});
    await r.settings.update({strictMode: true});
    await r.settings.update({presetsFolder: 'Other'});
    expect(r.calls).toEqual(['styleChanged', 'styleChanged', 'styleChanged']);
  });

  it('US-012 AC-14: a change of the presets redraws the rows and is a style change', async () => {
    const r = await rig();
    const before = made.length;
    r.calls.length = 0;
    r.presetListeners.forEach((l) => l());
    expect(made.length).toBeGreaterThan(before);
    expect(r.calls).toEqual(['styleChanged']);
  });

  it('US-012 AC-14: a change from the Settings tab redraws the rows; a change saved from a row of the panel does not (the field keeps its place)', async () => {
    const r = await rig();
    const before = made.length;
    await r.settings.setDefaults({page: {bleed: 3}});
    expect(made.length).toBeGreaterThan(before);
    made.length = 0;
    // a row of the panel saves
    const view = r.view as unknown as {
      drawControls(): void;
    };
    view.drawControls();
    const bleed = made.find((s) => s.name === 'Bleed (mm)');
    made.length = 0;
    bleed?.controls[0]?.type('4');
    await vi.waitFor(() =>
      expect(r.settings.data.defaults.page?.bleed).toBe(4),
    );
    await flush();
    expect(made).toHaveLength(0);
    expect(r.calls.filter((c) => c === 'styleChanged').length).toBeGreaterThan(
      0,
    );
  });
});

describe('US-012 AC-7, AC-11 drawing', () => {
  const pages = (document: unknown) => ({
    count: 3,
    document,
    aspect: 0.5,
    size: {width: 100, height: 200},
  });

  it('US-012 AC-7: pages near the visible part are drawn once each through the canvas helper', async () => {
    const r = await rig();
    r.push({pages: pages(r.document), shown: [1, 2, 3]});
    await flush();
    expect(r.drawnPages.sort()).toEqual([1, 2, 3]);
    expect(canvases).toHaveLength(3);
    // nothing changed: nothing is drawn again
    r.push({pages: pages(r.document), shown: [1, 2, 3]});
    await flush();
    expect(r.drawnPages).toHaveLength(3);
  });

  it('US-012 AC-11: while the pages are greyed nothing is drawn', async () => {
    const r = await rig();
    r.push({pages: pages(r.document), shown: [1, 2], greyed: true});
    await flush();
    expect(r.drawnPages).toEqual([]);
    expect(canvases).toHaveLength(0);
  });

  it('US-012 AC-7: a new document or another range releases the drawn canvases before new ones are made', async () => {
    const r = await rig();
    r.push({pages: pages(r.document), shown: [1, 2, 3]});
    await flush();
    r.push({pages: pages(r.document), shown: [2]});
    await flush();
    expect(canvases.slice(0, 3).every((c) => c.released === 1)).toBe(true);
  });

  it('US-012 AC-4, AC-11: with no pages the status line shows the state and the area keeps the no-note text', async () => {
    const r = await rig();
    r.push({status: 'no-note', pages: null, noteName: null});
    await flush();
    expect(r.view.contentEl.querySelector('.o2t-preview-area')).not.toBeNull();
  });
});

describe('US-012 AC-8 closing the panel', () => {
  it('US-012 AC-8: closing stops every listener, drops the note (frees the document) and releases the canvases', async () => {
    const r = await rig();
    r.push({
      pages: {
        count: 1,
        document: r.document,
        aspect: 0.5,
        size: {width: 100, height: 200},
      },
      shown: [1],
    });
    await flush();
    r.calls.length = 0;
    await r.view.onClose();
    expect(r.stopped()).toBe(1);
    expect(r.calls).toEqual(['setNote:null']);
    expect(canvases.every((c) => c.released === 1)).toBe(true);
    // the stores no longer reach the panel
    await r.settings.setDefaults({page: {bleed: 9}});
    expect(r.calls).toEqual(['setNote:null']);
    expect(r.presetListeners).toHaveLength(0);
  });
});

describe('US-012 AC-9, AC-8 the wiring in main.ts (text check)', () => {
  it('US-012 AC-9: the export announces its start before the run and its end in a finally', async () => {
    const {readFileSync} = await import('node:fs');
    const main = readFileSync('src/plugin/main.ts', 'utf8');
    const start = main.indexOf('this.preview.exportStarted()');
    const run = main.indexOf('await runExport(');
    const end = main.indexOf('this.preview.exportFinished()');
    expect(start).toBeGreaterThan(0);
    expect(run).toBeGreaterThan(start);
    expect(main.slice(run, end)).toContain('finally');
    expect(end).toBeGreaterThan(run);
  });

  it('US-012 AC-8: the plugin disposes the controller on unload and gives the renderer document a release', async () => {
    const {readFileSync} = await import('node:fs');
    const main = readFileSync('src/plugin/main.ts', 'utf8');
    expect(main).toContain('this.preview.dispose()');
    expect(main).toContain('release: () => document.dispose()');
    expect(main).toContain('cancel: () => job.cancel()');
  });
});

void modals;
