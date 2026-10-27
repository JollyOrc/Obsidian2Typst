// US-007 AC-3, AC-3b, AC-4: the compile service. One worker per compile; it is
// terminated when the compile ends, and when the plugin is unloaded.
import type {FaceInfo} from '../../core/fonts';
import {
  formatCompileError,
  type CompileRequest,
  type CompileResult,
} from '../../core/compile';

/** The part of a Web Worker the service uses. */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: {data: unknown}) => void) | null;
  onerror: ((event: {message?: string}) => void) | null;
}

/** US-012: the outcome of a vector compile (what the page renderer reads). */
export type VectorResult =
  {ok: true; vector: Uint8Array} | Extract<CompileResult, {ok: false}>;

/** US-012 AC-8: a running vector compile that can be ended. */
export interface CompileJob {
  result: Promise<VectorResult>;
  /** Ends the worker at once; `result` then gives a failure. */
  cancel(): void;
}

/** Compiles a request to a PDF. */
export interface TypstCompiler {
  compile(request: CompileRequest): Promise<CompileResult>;

  /**
   * US-010 AC-3: the faces of font files, one entry per file; null for a file
   * that is no font. Rejects with `Typst compiler failed: …`.
   */
  fontInfo(fonts: readonly Uint8Array[]): Promise<(FaceInfo[] | null)[]>;
  /** Ends a running compile (the plugin is unloaded). */
  dispose(): void;
}

/** US-012: the vector compile the preview uses (the export never does). */
export interface VectorCompiler {
  /** The same compile to the vector format of the page renderer. */
  compileVector(request: CompileRequest): Promise<VectorResult>;
  /** US-012 AC-8: `compileVector` that can be cancelled. */
  startVector(request: CompileRequest): CompileJob;
}

export interface TypstCompilerOptions {
  createWorker: () => WorkerLike;
  /** The compiler WASM; read on every compile (the caller caches it). */
  compilerWasm: () => Promise<Uint8Array>;
}

const failureText = (text: string): string => `Typst compiler failed: ${text}`;

const failure = (text: string): CompileResult => ({
  ok: false,
  kind: 'worker',
  error: failureText(text),
});

/** An independent copy of `bytes` as an ArrayBuffer. */
const copy = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

let counter = 0;

/** US-007 AC-3b: the compile service over `createWorker`. */
export function createTypstCompiler(
  options: TypstCompilerOptions,
): TypstCompiler & VectorCompiler {
  const aborts = new Set<() => void>();

  /** One worker, one compile; `cancel` ends the worker at once. */
  function run<K extends 'pdf' | 'vector'>(
    request: CompileRequest,
    kind: K,
  ): {
    result: Promise<K extends 'pdf' ? CompileResult : VectorResult>;
    cancel(): void;
  } {
    type Result = CompileResult | VectorResult;
    const id = `compile-${++counter}`;
    let worker: WorkerLike | null = null;
    let settle: (result: Result) => void = () => undefined;
    const done = new Promise<Result>((resolve) => {
      settle = resolve;
    });
    let answered = false;
    const finish = (result: Result): void => {
      if (answered) return;
      answered = true;
      settle(result);
    };
    let ended = false;
    const end = (): void => {
      if (ended) return;
      ended = true;
      worker?.terminate();
    };
    const cancel = (reason: string) => (): void => {
      finish(failure(reason));
      end();
    };
    const abort = cancel('the plugin was unloaded');
    aborts.add(abort);

    const work = async (): Promise<Result> => {
      try {
        const wasm = await options.compilerWasm();
        if (answered) return await done;
        worker = options.createWorker();
        worker.onerror = (event) =>
          finish(failure(event.message ?? 'unknown error'));
        const current = worker;
        worker.onmessage = ({data}) => {
          const message = data as {
            type?: string;
            id?: string;
            message?: string;
            pdf?: ArrayBuffer;
            vector?: ArrayBuffer;
          };
          if (message.id !== id) return;
          if (message.type === 'ready') {
            current.postMessage({
              type: kind === 'pdf' ? 'compile' : 'compile-vector',
              id,
              file: request.file,
              source: request.source,
              files: Object.entries(request.files).map(([path, bytes]) => ({
                path,
                buf: copy(bytes),
              })),
            });
          } else if (message.type === 'compiled') {
            finish({ok: true, pdf: new Uint8Array(message.pdf as ArrayBuffer)});
          } else if (message.type === 'vector-compiled') {
            finish({
              ok: true,
              vector: new Uint8Array(message.vector as ArrayBuffer),
            });
          } else if (message.type === 'compile-error') {
            finish({
              ok: false,
              kind: 'typst',
              error: formatCompileError(message.message ?? ''),
            });
          } else if (message.type === 'failed') {
            finish(failure(message.message ?? 'unknown error'));
          }
        };
        worker.postMessage({
          type: 'init',
          id,
          compilerWasm: copy(wasm),
          fonts: request.fonts.map(copy),
        });
        return await done;
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      } finally {
        aborts.delete(abort);
        end();
      }
    };
    return {
      result: work() as Promise<K extends 'pdf' ? CompileResult : VectorResult>,
      cancel: cancel('the compile was cancelled'),
    };
  }

  return {
    dispose(): void {
      for (const abort of [...aborts]) abort();
    },

    async fontInfo(
      fonts: readonly Uint8Array[],
    ): Promise<(FaceInfo[] | null)[]> {
      if (fonts.length === 0) return [];
      const id = `font-info-${++counter}`;
      let worker: WorkerLike | null = null;
      try {
        const wasm = await options.compilerWasm();
        return await new Promise<(FaceInfo[] | null)[]>((resolve, reject) => {
          worker = options.createWorker();
          const current = worker;
          current.onerror = (event) =>
            reject(new Error(failureText(event.message ?? 'unknown error')));
          current.onmessage = ({data}) => {
            const message = data as {
              type?: string;
              id?: string;
              message?: string;
              faces?: (FaceInfo[] | null)[];
            };
            if (message.id !== id) return;
            if (message.type === 'ready') {
              current.postMessage({
                type: 'font-info',
                id,
                fonts: fonts.map(copy),
              });
            } else if (message.type === 'font-info-result') {
              resolve(message.faces ?? []);
            } else if (message.type === 'failed') {
              reject(
                new Error(failureText(message.message ?? 'unknown error')),
              );
            }
          };
          current.postMessage({
            type: 'init',
            id,
            compilerWasm: copy(wasm),
            fonts: [],
          });
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith('Typst compiler failed: ')
        ) {
          throw error;
        }
        const text = error instanceof Error ? error.message : String(error);
        throw new Error(failureText(text), {cause: error});
      } finally {
        (worker as WorkerLike | null)?.terminate();
      }
    },

    compile(request: CompileRequest): Promise<CompileResult> {
      return run(request, 'pdf').result;
    },

    compileVector(request: CompileRequest): Promise<VectorResult> {
      return run(request, 'vector').result;
    },

    startVector(request: CompileRequest): CompileJob {
      return run(request, 'vector');
    },
  };
}
