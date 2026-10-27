// US-007 AC-1, AC-1b, AC-3, AC-4, AC-11 — the export run: what is written,
// in which order, and what a compile error, a failing worker, a busy lock and
// a strict-mode abort leave behind (fake host and fake compiler).
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import type {Warning} from '../../src/core/emit';
import type {CompileRequest, CompileResult} from '../../src/core/compile';
import type {TypstCompiler} from '../../src/plugin/compiler';
import {
  createExportLock,
  runExport,
  type RunExportHost,
  type RunExportOptions,
} from '../../src/plugin/run-export';
import {
  DEFAULT_WARNING_SETTINGS,
  finishExport,
  type ExportHost,
} from '../../src/plugin/warning-flow';

const PDF = new Uint8Array([37, 80, 68, 70]);
const PNG = new Uint8Array([137, 80, 78, 71, 1]);
const w = (code: string, message: string, line: number): Warning => ({
  code,
  message,
  line,
});
const TWO = [
  w('LINK_UNRESOLVED', 'No heading matches "[[Nowhere]]"', 412),
  w('ASSET_MISSING', 'Image file not found: assets/crypt.png', 977),
];

/** Notices, files and a log of every call, in the order they happen. */
class FakeHost implements RunExportHost {
  readonly notices: string[] = [];
  readonly text = new Map<string, string>();
  readonly bytes = new Map<string, Uint8Array>();
  readonly vault = new Map<string, string>();
  readonly log: string[] = [];
  failOn: string | null = null;
  notice(text: string): void {
    this.notices.push(text);
    this.log.push(`notice:${text}`);
  }
  async writeExportFile(path: string, text: string): Promise<void> {
    if (path.endsWith(this.failOn ?? '\0')) throw new Error('disk full');
    this.text.set(path, text);
    this.log.push(`text:${path}`);
  }
  async writeExportBytes(path: string, data: Uint8Array): Promise<void> {
    if (path.endsWith(this.failOn ?? '\0')) throw new Error('disk full');
    this.bytes.set(path, data);
    this.log.push(`bytes:${path}`);
  }
  async writeVaultFile(path: string, text: string): Promise<void> {
    this.vault.set(path, text);
    this.log.push(`vault:${path}`);
  }
}

/** A compiler that records its requests and answers with `answer`. */
class FakeCompiler implements TypstCompiler {
  fontInfo(): Promise<never[]> {
    return Promise.resolve([]);
  }
  readonly requests: CompileRequest[] = [];
  disposed = 0;
  constructor(
    private readonly log: string[],
    private readonly answer: () => Promise<CompileResult> = async () => ({
      ok: true,
      pdf: PDF,
    }),
  ) {}
  async compile(request: CompileRequest): Promise<CompileResult> {
    this.log.push('compile');
    this.requests.push(request);
    return this.answer();
  }
  dispose(): void {
    this.disposed++;
  }
}

interface Setup {
  host: FakeHost;
  compiler: FakeCompiler;
  lock: ReturnType<typeof createExportLock>;
  options: RunExportOptions;
}

function setup(
  overrides: Partial<RunExportOptions> = {},
  answer?: () => Promise<CompileResult>,
): Setup {
  const host = new FakeHost();
  const compiler = new FakeCompiler(host.log, answer);
  const lock = createExportLock();
  const options: RunExportOptions = {
    noteName: 'Rules',
    source: {path: 'Sample/Rules.md', inVault: true},
    typ: '= Rules\n#image("assets/crypt.png")\n',
    warnings: [],
    uses: [{from: 'Sample/assets/crypt.png', to: 'assets/crypt.png'}],
    readAsset: async (path) => {
      if (path !== 'Sample/assets/crypt.png') throw new Error(path);
      return PNG;
    },
    template: null,
    exportDir: '/out/run1',
    settings: DEFAULT_WARNING_SETTINGS,
    host,
    compiler,
    fonts: [new Uint8Array([1, 2])],
    lock,
    ...overrides,
  };
  return {host, compiler, lock, options};
}

describe('US-007 AC-1: what an export writes', () => {
  it('US-007 AC-1: writes <name>.typ, assets/…, <name>.pdf and export-warnings.md into the export folder, nothing else', async () => {
    const {host, options} = setup();
    const result = await runExport(options);
    expect(result).toEqual({status: 'exported'});
    expect([...host.text.keys()].sort()).toEqual([
      '/out/run1/Rules.typ',
      '/out/run1/export-warnings.md',
    ]);
    expect([...host.bytes.keys()].sort()).toEqual([
      '/out/run1/Rules.pdf',
      '/out/run1/assets/crypt.png',
    ]);
    expect(host.text.get('/out/run1/Rules.typ')).toBe(options.typ);
    expect(host.bytes.get('/out/run1/Rules.pdf')).toBe(PDF);
    expect(host.bytes.get('/out/run1/assets/crypt.png')).toBe(PNG);
  });

  it('US-007 AC-1: writes template.typ when a template is configured', async () => {
    const {host, options} = setup({template: '#let accent = red\n'});
    await runExport(options);
    expect(host.text.get('/out/run1/template.typ')).toBe('#let accent = red\n');
  });

  it('US-007 AC-1: an export folder with a trailing slash gives the same paths', async () => {
    const {host, options} = setup({exportDir: '/out/run1/'});
    await runExport(options);
    expect(host.text.has('/out/run1/Rules.typ')).toBe(true);
    expect(host.bytes.has('/out/run1/Rules.pdf')).toBe(true);
  });

  it('US-007 AC-1: the order is .typ, assets, template, Compiling… notice, compile, PDF, report file, vault note', async () => {
    const {host, options} = setup({template: 'T'});
    await runExport(options);
    expect(host.log).toEqual([
      'text:/out/run1/Rules.typ',
      'bytes:/out/run1/assets/crypt.png',
      'text:/out/run1/template.typ',
      'notice:Compiling…',
      'compile',
      'bytes:/out/run1/Rules.pdf',
      'text:/out/run1/export-warnings.md',
      'vault:Rules export warnings.md',
    ]);
  });

  it('US-007 AC-1: the compiler gets the file name, the source, every asset and the template as files, and the fonts', async () => {
    const {compiler, options} = setup({template: 'TEMPLATE'});
    await runExport(options);
    expect(compiler.requests).toHaveLength(1);
    const request = compiler.requests[0]!;
    expect(request.file).toBe('Rules.typ');
    expect(request.source).toBe(options.typ);
    expect(Object.keys(request.files).sort()).toEqual([
      'assets/crypt.png',
      'template.typ',
    ]);
    expect(request.files['assets/crypt.png']).toBe(PNG);
    expect(new TextDecoder().decode(request.files['template.typ'])).toBe(
      'TEMPLATE',
    );
    expect(request.fonts).toBe(options.fonts);
  });

  it('US-007 AC-1: an asset used twice is read and written once', async () => {
    let reads = 0;
    const {host, options} = setup({
      uses: [
        {from: 'a/x.png', to: 'assets/x.png'},
        {from: 'a/x.png', to: 'assets/x.png'},
      ],
      readAsset: async () => {
        reads++;
        return PNG;
      },
    });
    await runExport(options);
    expect(reads).toBe(1);
    expect(
      host.log.filter((l) => l === 'bytes:/out/run1/assets/x.png'),
    ).toHaveLength(1);
  });

  it('US-007 AC-1: a note without images writes no assets folder file and compiles with no files', async () => {
    const {host, compiler, options} = setup({uses: []});
    await runExport(options);
    expect([...host.bytes.keys()]).toEqual(['/out/run1/Rules.pdf']);
    expect(compiler.requests[0]?.files).toEqual({});
  });

  it('US-007 AC-1: with warnings the report file and the vault note are written and the notice names the report', async () => {
    const {host, options} = setup({warnings: TWO});
    const result = await runExport(options);
    expect(result).toEqual({status: 'exported'});
    expect(host.text.get('/out/run1/export-warnings.md')).toContain(
      'LINK_UNRESOLVED',
    );
    expect(host.vault.get('Rules export warnings.md')).toContain(
      'obsidian://obsidian2typst-goto',
    );
    expect(host.notices).toEqual([
      'Compiling…',
      'Exported with 2 warnings. Report: /out/run1/export-warnings.md',
    ]);
  });

  it('US-007 AC-1: without warnings only the Compiling… notice is shown', async () => {
    const {host, options} = setup();
    await runExport(options);
    expect(host.notices).toEqual(['Compiling…']);
  });
});

describe('US-007 AC-1b: a note called template', () => {
  for (const note of ['template', 'Template', 'TEMPLATE']) {
    it(`US-007 AC-1b: the note ${note} is written as template-note.typ and template-note.pdf, template.typ keeps the template`, async () => {
      const {host, compiler, options} = setup({
        noteName: note,
        template: 'THE TEMPLATE',
      });
      await runExport(options);
      expect(host.text.get('/out/run1/template-note.typ')).toBe(options.typ);
      expect(host.bytes.has('/out/run1/template-note.pdf')).toBe(true);
      expect(host.text.get('/out/run1/template.typ')).toBe('THE TEMPLATE');
      expect(host.text.has('/out/run1/Template.typ')).toBe(false);
      expect(host.text.has('/out/run1/TEMPLATE.typ')).toBe(false);
      expect(compiler.requests[0]?.file).toBe('template-note.typ');
    });
  }

  it('US-007 AC-1b: writing to the same export folder twice never turns template.typ into the note', async () => {
    const first = setup({noteName: 'template', template: 'THE TEMPLATE'});
    await runExport(first.options);
    const second = setup({
      noteName: 'template',
      template: 'THE TEMPLATE',
      host: first.host,
    });
    await runExport({...second.options, host: first.host});
    expect(first.host.text.get('/out/run1/template.typ')).toBe('THE TEMPLATE');
  });
});

describe('US-007 AC-4: a compile error', () => {
  const error: CompileResult = {
    ok: false,
    kind: 'typst',
    error: 'Typst error at Rules.typ:41:8: unknown variable: foo',
  };

  it('US-007 AC-4: writes no PDF but the .typ, the assets and the template, and shows the error notice', async () => {
    const {host, options} = setup({template: 'T'}, async () => error);
    const result = await runExport(options);
    expect(result).toEqual({status: 'compile-error'});
    expect(host.bytes.has('/out/run1/Rules.pdf')).toBe(false);
    expect(host.text.get('/out/run1/Rules.typ')).toBe(options.typ);
    expect(host.bytes.has('/out/run1/assets/crypt.png')).toBe(true);
    expect(host.text.get('/out/run1/template.typ')).toBe('T');
    expect(host.notices).toEqual([
      'Compiling…',
      'Typst error at Rules.typ:41:8: unknown variable: foo',
    ]);
  });

  it('US-007 AC-4: the warnings report is still written and the Exported with N warnings notice is not shown', async () => {
    const {host, options} = setup({warnings: TWO}, async () => error);
    await runExport(options);
    expect(host.text.has('/out/run1/export-warnings.md')).toBe(true);
    expect(host.vault.has('Rules export warnings.md')).toBe(true);
    expect(host.notices.some((n) => n.startsWith('Exported with'))).toBe(false);
  });

  it('US-007 AC-4: an old PDF in the export folder is not touched', async () => {
    const {host, options} = setup({}, async () => error);
    host.bytes.set('/out/run1/Rules.pdf', new Uint8Array([7]));
    await runExport(options);
    expect([...host.bytes.get('/out/run1/Rules.pdf')!]).toEqual([7]);
  });

  it('US-007 AC-3b: a failing worker gives the same files and the notice Typst compiler failed', async () => {
    const {host, options} = setup({warnings: TWO}, async () => ({
      ok: false,
      kind: 'worker',
      error: 'Typst compiler failed: no memory',
    }));
    const result = await runExport(options);
    expect(result).toEqual({status: 'compiler-failed'});
    expect(host.bytes.has('/out/run1/Rules.pdf')).toBe(false);
    expect(host.text.has('/out/run1/Rules.typ')).toBe(true);
    expect(host.text.has('/out/run1/export-warnings.md')).toBe(true);
    expect(host.notices).toEqual([
      'Compiling…',
      'Typst compiler failed: no memory',
    ]);
  });
});

describe('US-007 AC-3: one export at a time', () => {
  it('US-007 AC-3: a second export while one runs is refused with An export is already running and writes nothing', async () => {
    let release: (result: CompileResult) => void = () => undefined;
    const slow = new Promise<CompileResult>((resolve) => (release = resolve));
    const first = setup({}, () => slow);
    const running = runExport(first.options);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = setup({lock: first.lock});
    const result = await runExport(second.options);
    expect(result).toEqual({status: 'busy'});
    expect(second.host.notices).toEqual(['An export is already running']);
    expect(second.host.log).toEqual(['notice:An export is already running']);
    expect(second.compiler.requests).toHaveLength(0);

    release({ok: true, pdf: PDF});
    expect(await running).toEqual({status: 'exported'});
  });

  it('US-007 AC-3: the lock is free again after a successful export', async () => {
    const {lock, options} = setup();
    await runExport(options);
    const again = setup({lock});
    expect(await runExport(again.options)).toEqual({status: 'exported'});
  });

  it('US-007 AC-3: the lock is free again after a compile error, a failing worker and a strict-mode abort', async () => {
    const lock = createExportLock();
    const results: CompileResult[] = [
      {ok: false, kind: 'typst', error: 'Typst error: x'},
      {ok: false, kind: 'worker', error: 'Typst compiler failed: x'},
    ];
    for (const answer of results) {
      const run = setup({lock}, async () => answer);
      await runExport(run.options);
    }
    const strict = setup({
      lock,
      warnings: TWO,
      settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
    });
    expect(await runExport(strict.options)).toEqual({status: 'aborted'});
    const last = setup({lock});
    expect(await runExport(last.options)).toEqual({status: 'exported'});
  });

  it('US-007 AC-3: the lock is free again after a write error and the error reaches the caller', async () => {
    const lock = createExportLock();
    const broken = setup({lock});
    broken.host.failOn = 'Rules.typ';
    await expect(runExport(broken.options)).rejects.toThrow('disk full');
    const next = setup({lock});
    expect(await runExport(next.options)).toEqual({status: 'exported'});
  });

  it('US-007 AC-3: the lock is free again after the compiler itself throws, and the error reaches the caller', async () => {
    const lock = createExportLock();
    const broken = setup({lock}, async () => {
      throw new Error('unexpected');
    });
    await expect(runExport(broken.options)).rejects.toThrow('unexpected');
    expect(await runExport(setup({lock}).options)).toEqual({
      status: 'exported',
    });
  });

  it('US-007 AC-3: the lock is free again after the PDF cannot be written', async () => {
    const lock = createExportLock();
    const broken = setup({lock});
    broken.host.failOn = 'Rules.pdf';
    await expect(runExport(broken.options)).rejects.toThrow('disk full');
    expect(await runExport(setup({lock}).options)).toEqual({
      status: 'exported',
    });
  });

  it('US-007 AC-3: the lock is free again when an asset cannot be read, and nothing is compiled', async () => {
    const lock = createExportLock();
    const broken = setup({
      lock,
      readAsset: async () => {
        throw new Error('not readable');
      },
    });
    await expect(runExport(broken.options)).rejects.toThrow('not readable');
    expect(broken.compiler.requests).toHaveLength(0);
    expect(await runExport(setup({lock}).options)).toEqual({
      status: 'exported',
    });
  });

  it('US-007 AC-3: the lock itself: acquire, refuse while held, release once, release twice is harmless', () => {
    const lock = createExportLock();
    const release = lock.tryAcquire();
    expect(release).not.toBeNull();
    expect(lock.tryAcquire()).toBeNull();
    release?.();
    release?.();
    const again = lock.tryAcquire();
    expect(again).not.toBeNull();
    expect(lock.tryAcquire()).toBeNull();
    again?.();
    expect(lock.tryAcquire()).not.toBeNull();
  });

  it('US-007 AC-3: an old release function cannot free a newer hold', () => {
    const lock = createExportLock();
    const old = lock.tryAcquire();
    old?.();
    const current = lock.tryAcquire();
    old?.();
    expect(lock.tryAcquire()).toBeNull();
    current?.();
  });
});

describe('US-007 AC-4: strict mode', () => {
  it('US-007 AC-4: with a warning in strict mode nothing is written, nothing is compiled and Compiling… is not shown', async () => {
    const {host, compiler, options} = setup({
      warnings: TWO,
      settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
    });
    const result = await runExport(options);
    expect(result).toEqual({status: 'aborted'});
    expect(compiler.requests).toHaveLength(0);
    expect(host.text.size + host.bytes.size + host.vault.size).toBe(0);
    expect(host.notices).toHaveLength(1);
    expect(host.notices[0]).toMatch(
      /^Export aborted: 2 warnings \(strict mode\)/,
    );
  });

  it('US-007 AC-4: strict mode without a warning exports normally', async () => {
    const {host, options} = setup({
      settings: {...DEFAULT_WARNING_SETTINGS, strictMode: true},
    });
    expect(await runExport(options)).toEqual({status: 'exported'});
    expect(host.bytes.has('/out/run1/Rules.pdf')).toBe(true);
  });
});

describe('US-007 AC-11: finishExport accepts a failed output', () => {
  const host = (): ExportHost & {notices: string[]; files: string[]} => {
    const out = {
      notices: [] as string[],
      files: [] as string[],
      notice: (text: string) => void out.notices.push(text),
      writeExportFile: async (path: string) => void out.files.push(path),
      writeVaultFile: async (path: string) => void out.files.push(path),
    };
    return out;
  };

  it('US-007 AC-11: when writeOutput returns failed the report files are written, the success notice is left out and the result says failed', async () => {
    const h = host();
    const result = await finishExport({
      warnings: TWO,
      source: {path: 'N/Rules.md', inVault: true},
      exportDir: '/out',
      settings: DEFAULT_WARNING_SETTINGS,
      host: h,
      writeOutput: async () => ({failed: true}),
    });
    expect(result).toEqual({aborted: false, failed: true});
    expect(h.files).toEqual([
      '/out/export-warnings.md',
      'Rules export warnings.md',
    ]);
    expect(h.notices).toEqual([]);
  });

  it('US-007 AC-11: a writeOutput that returns nothing keeps the result of US-006 exactly', async () => {
    const h = host();
    const result = await finishExport({
      warnings: TWO,
      source: {path: 'N/Rules.md', inVault: true},
      exportDir: '/out',
      settings: DEFAULT_WARNING_SETTINGS,
      host: h,
      writeOutput: async () => undefined,
    });
    expect(result).toStrictEqual({aborted: false});
    expect(h.notices).toHaveLength(1);
  });
});

describe('US-007 AC-11: the plugin layer is wired, and the pure layer is not', () => {
  it('US-007 AC-11: run-export and compiler import no Obsidian module', () => {
    for (const file of [
      'src/plugin/run-export.ts',
      'src/plugin/compiler/index.ts',
      'src/plugin/compiler/worker-core.ts',
      'src/plugin/disk-writer.ts',
    ]) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/from ['"]obsidian['"]/);
    }
  });
});
