// US-007 AC-3, AC-3b, AC-4 — the compile service that talks to a worker
// (scripted fake workers; the real compiler is used in
// tests/integration/us-007-compile-service.test.ts).
import {describe, expect, it} from 'vitest';
import {createTypstCompiler, type WorkerLike} from '../../src/plugin/compiler';
import {ScriptedWorker} from '../support/fake-worker';

const WASM = new Uint8Array([0, 97, 115, 109, 1, 2, 3]);
const FONT = new Uint8Array([9, 8, 7]);
const PNG = new Uint8Array([137, 80, 78, 71]);
const REQUEST = {
  file: 'Rules.typ',
  source: '= Title',
  files: {'assets/x.png': PNG, 'template.typ': new Uint8Array([35])},
  fonts: [FONT],
};
const PDF = new Uint8Array([37, 80, 68, 70, 45]);

/** A worker that answers like the real one. */
const goodWorker = () =>
  new ScriptedWorker((message, worker) => {
    if (message['type'] === 'init') {
      worker.emit({type: 'ready', id: message['id']});
    } else if (message['type'] === 'compile') {
      worker.emit({
        type: 'compiled',
        id: message['id'],
        pdf: PDF.buffer.slice(0),
      });
    }
  });

/** The compiler under test with the workers it created. */
function setup(make: () => ScriptedWorker = goodWorker) {
  const workers: ScriptedWorker[] = [];
  let wasmReads = 0;
  const compiler = createTypstCompiler({
    createWorker: (): WorkerLike => {
      const worker = make();
      workers.push(worker);
      return worker;
    },
    compilerWasm: async () => {
      wasmReads++;
      return WASM;
    },
  });
  return {compiler, workers, wasmReads: () => wasmReads};
}

describe('US-007 AC-3b: one worker per export', () => {
  it('US-007 AC-3b: no worker is created and no WASM is read before the first compile', () => {
    const {workers, wasmReads} = setup();
    expect(workers).toHaveLength(0);
    expect(wasmReads()).toBe(0);
  });

  it('US-007 AC-3b: each compile creates its own worker and terminates it when it succeeds', async () => {
    const {compiler, workers} = setup();
    const first = await compiler.compile(REQUEST);
    const second = await compiler.compile(REQUEST);
    expect(first.ok && second.ok).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers.map((w) => w.terminated)).toEqual([1, 1]);
  });

  it('US-007 AC-3b: the worker is terminated after a Typst error', async () => {
    const {compiler, workers} = setup(
      () =>
        new ScriptedWorker((message, worker) => {
          worker.emit(
            message['type'] === 'init'
              ? {type: 'ready', id: message['id']}
              : {
                  type: 'compile-error',
                  id: message['id'],
                  message: '/Rules.typ:41:8: error: unknown variable: foo',
                },
          );
        }),
    );
    await compiler.compile(REQUEST);
    expect(workers[0]?.terminated).toBe(1);
  });

  it('US-007 AC-3b: the worker is terminated after a worker error', async () => {
    const {compiler, workers} = setup(
      () => new ScriptedWorker((_m, worker) => worker.fail('boom')),
    );
    await compiler.compile(REQUEST);
    expect(workers[0]?.terminated).toBe(1);
  });

  it('US-007 AC-3b: the compile result of a worker that was terminated twice is still one result (no second terminate)', async () => {
    const {compiler, workers} = setup();
    await compiler.compile(REQUEST);
    compiler.dispose();
    expect(workers[0]?.terminated).toBe(1);
  });
});

describe('US-007 AC-3b: the messages to the worker', () => {
  it('US-007 AC-3b: init comes first with the compiler WASM and the fonts, compile follows after ready with file, source and files', async () => {
    const {compiler, workers} = setup();
    await compiler.compile(REQUEST);
    const [init, compile] = workers[0]!.received;
    expect(workers[0]?.received).toHaveLength(2);
    expect(init).toMatchObject({type: 'init'});
    expect(init?.['compilerWasm']).toEqual(WASM.buffer.slice(0));
    expect(init?.['fonts']).toEqual([FONT.buffer.slice(0)]);
    expect(compile).toMatchObject({
      type: 'compile',
      file: 'Rules.typ',
      source: '= Title',
    });
    expect(compile?.['id']).toBe(init?.['id']);
    expect(
      (compile?.['files'] as {path: string}[]).map((f) => f.path).sort(),
    ).toEqual(['assets/x.png', 'template.typ']);
  });

  it('US-007 AC-3b: compile is not sent before the worker has answered ready', async () => {
    const {compiler, workers} = setup(
      () =>
        new ScriptedWorker((message, worker) => {
          if (message['type'] === 'init') {
            setTimeout(
              () => worker.emit({type: 'ready', id: message['id']}),
              30,
            );
          } else {
            worker.emit({
              type: 'compiled',
              id: message['id'],
              pdf: PDF.buffer.slice(0),
            });
          }
        }),
    );
    const pending = compiler.compile(REQUEST);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(workers[0]?.received.map((m) => m['type'])).toEqual(['init']);
    await pending;
    expect(workers[0]?.received.map((m) => m['type'])).toEqual([
      'init',
      'compile',
    ]);
  });

  it('US-007 AC-3b: the compiler WASM is read once per compile, on that compile', async () => {
    const {compiler, wasmReads} = setup();
    await compiler.compile(REQUEST);
    expect(wasmReads()).toBe(1);
    await compiler.compile(REQUEST);
    expect(wasmReads()).toBe(2);
  });
});

describe('US-007 AC-3b: ids', () => {
  it('US-007 AC-3b: an answer with another id is ignored, the real answer still counts', async () => {
    const {compiler} = setup(
      () =>
        new ScriptedWorker((message, worker) => {
          if (message['type'] === 'init') {
            worker.emit({type: 'ready', id: message['id']});
            return;
          }
          worker.emit({
            type: 'compile-error',
            id: 'stale',
            message: '/old.typ:1:1: error: stale',
          });
          worker.emit({type: 'compiled', id: 'stale', pdf: new ArrayBuffer(1)});
          worker.emit({
            type: 'compiled',
            id: message['id'],
            pdf: PDF.buffer.slice(0),
          });
        }),
    );
    const result = await compiler.compile(REQUEST);
    expect(result).toEqual({ok: true, pdf: PDF});
  });

  it('US-007 AC-3b: two compiles use different ids', async () => {
    const {compiler, workers} = setup();
    await compiler.compile(REQUEST);
    await compiler.compile(REQUEST);
    expect(workers[0]?.received[0]?.['id']).not.toBe(
      workers[1]?.received[0]?.['id'],
    );
  });
});

describe('US-007 AC-4 and AC-3b: results', () => {
  it('US-007 AC-4: success gives the PDF bytes', async () => {
    const {compiler} = setup();
    expect(await compiler.compile(REQUEST)).toEqual({ok: true, pdf: PDF});
  });

  it('US-007 AC-4: a compile error gives the notice text of the story', async () => {
    const {compiler} = setup(
      () =>
        new ScriptedWorker((message, worker) => {
          worker.emit(
            message['type'] === 'init'
              ? {type: 'ready', id: message['id']}
              : {
                  type: 'compile-error',
                  id: message['id'],
                  message: '/test.typ:41:8: error: unknown variable: foo',
                },
          );
        }),
    );
    expect(await compiler.compile(REQUEST)).toEqual({
      ok: false,
      kind: 'typst',
      error: 'Typst error at test.typ:41:8: unknown variable: foo',
    });
  });

  it('US-007 AC-3b: a worker that reports failed gives Typst compiler failed: text', async () => {
    const {compiler} = setup(
      () =>
        new ScriptedWorker((message, worker) => {
          worker.emit({
            type: 'failed',
            id: message['id'],
            message: 'no memory',
          });
        }),
    );
    expect(await compiler.compile(REQUEST)).toEqual({
      ok: false,
      kind: 'worker',
      error: 'Typst compiler failed: no memory',
    });
  });

  it('US-007 AC-3b: a failure while initialising (before compile) also gives Typst compiler failed', async () => {
    const {compiler, workers} = setup(
      () =>
        new ScriptedWorker((message, worker) => {
          worker.emit({type: 'failed', id: message['id'], message: 'bad wasm'});
        }),
    );
    expect(await compiler.compile(REQUEST)).toMatchObject({
      ok: false,
      kind: 'worker',
      error: 'Typst compiler failed: bad wasm',
    });
    expect(workers[0]?.received.map((m) => m['type'])).toEqual(['init']);
  });

  it('US-007 AC-3b: a worker error event (crash) gives Typst compiler failed: message', async () => {
    const {compiler} = setup(
      () => new ScriptedWorker((_m, worker) => worker.fail('Uncaught: boom')),
    );
    expect(await compiler.compile(REQUEST)).toEqual({
      ok: false,
      kind: 'worker',
      error: 'Typst compiler failed: Uncaught: boom',
    });
  });

  it('US-007 AC-3b: a worker error event without a message still gives a result', async () => {
    const {compiler} = setup(
      () =>
        new ScriptedWorker((_m, worker) => {
          worker.onerror?.({});
        }),
    );
    expect(await compiler.compile(REQUEST)).toEqual({
      ok: false,
      kind: 'worker',
      error: 'Typst compiler failed: unknown error',
    });
  });

  it('US-007 AC-3b: a WASM that cannot be read gives Typst compiler failed and creates no worker', async () => {
    const workers: ScriptedWorker[] = [];
    const compiler = createTypstCompiler({
      createWorker: () => {
        const worker = goodWorker();
        workers.push(worker);
        return worker;
      },
      compilerWasm: async () => {
        throw new Error('decode failed');
      },
    });
    expect(await compiler.compile(REQUEST)).toEqual({
      ok: false,
      kind: 'worker',
      error: 'Typst compiler failed: decode failed',
    });
    expect(workers).toHaveLength(0);
  });

  it('US-007 AC-3b: a worker that cannot be started gives Typst compiler failed', async () => {
    const compiler = createTypstCompiler({
      createWorker: () => {
        throw new Error('Blob URL blocked');
      },
      compilerWasm: async () => WASM,
    });
    expect(await compiler.compile(REQUEST)).toEqual({
      ok: false,
      kind: 'worker',
      error: 'Typst compiler failed: Blob URL blocked',
    });
  });

  it('US-007 AC-3b: the first answer wins, a second answer after it changes nothing', async () => {
    const {compiler} = setup(
      () =>
        new ScriptedWorker((message, worker) => {
          if (message['type'] === 'init') {
            worker.emit({type: 'ready', id: message['id']});
            return;
          }
          worker.emit({
            type: 'compiled',
            id: message['id'],
            pdf: PDF.buffer.slice(0),
          });
          worker.emit({type: 'failed', id: message['id'], message: 'late'});
          worker.fail('later');
        }),
    );
    expect(await compiler.compile(REQUEST)).toEqual({ok: true, pdf: PDF});
  });
});

describe('US-007 AC-3b: the plugin is unloaded while a compile runs', () => {
  it('US-007 AC-3b: dispose terminates the running worker and the pending compile ends with Typst compiler failed', async () => {
    const {compiler, workers} = setup(
      () => new ScriptedWorker(() => undefined), // never answers
    );
    const pending = compiler.compile(REQUEST);
    await new Promise((resolve) => setTimeout(resolve, 5));
    compiler.dispose();
    expect(await pending).toEqual({
      ok: false,
      kind: 'worker',
      error: 'Typst compiler failed: the plugin was unloaded',
    });
    expect(workers[0]?.terminated).toBe(1);
  });

  it('US-007 AC-3b: dispose without a running compile does nothing', () => {
    const {compiler, workers} = setup();
    compiler.dispose();
    expect(workers).toHaveLength(0);
  });

  it('US-007 AC-3b: after dispose the compiler can compile again with a new worker', async () => {
    const {compiler, workers} = setup();
    compiler.dispose();
    expect(await compiler.compile(REQUEST)).toEqual({ok: true, pdf: PDF});
    expect(workers).toHaveLength(1);
  });
});
