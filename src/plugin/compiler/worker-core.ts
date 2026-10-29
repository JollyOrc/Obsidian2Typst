// US-007 AC-3, AC-3b: the logic of the compiler worker as a plain function
// over `post`, so that the tests run it in Node with the real typst.ts and the
// worker entry only connects it to `self`. One core serves one export.
import {
  CompileFormatEnum,
  TypstFontBuilderDriver,
} from '@myriaddreamin/typst.ts/dist/esm/compiler.mjs';
import {TypstSnippet} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import {loadFonts} from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';
import {FIT_DECISION_LABEL} from '../../core/emit/fit-label';
import type {FaceInfo} from '../../core/fonts';

/** Sends a message to the plugin; `transfer` lists buffers that move. */
export type Post = (message: unknown, transfer?: Transferable[]) => void;

/** The messages the plugin sends; every one carries the request id. */
interface InitMessage {
  type: 'init';
  id: string;
  compilerWasm: ArrayBuffer;
  fonts: ArrayBuffer[];
}
interface CompileMessage {
  /** `compile-vector` (US-012): the format for the page renderer. */
  type: 'compile' | 'compile-vector';
  id: string;
  file: string;
  source: string;
  files: {path: string; buf: ArrayBuffer}[];
}

/** US-010 AC-3: asks for the faces of font files. */
interface FontInfoMessage {
  type: 'font-info';
  id: string;
  fonts: ArrayBuffer[];
}

/** One diagnostic of the compiler (`range` is `line:column-line:column`, from 0). */
interface Diagnostic {
  path: string;
  range: string;
  severity: string;
  message: string;
}

/**
 * A diagnostic as `<path>:<line>:<column>: <severity>: <text>`, lines and
 * columns from 1, the text cut at its first line (a package error carries a
 * stack trace). `formatCompileError` reads this form (US-007 AC-4).
 */
function diagnosticLine(d: Diagnostic): string {
  const start = /^(\d+):(\d+)/.exec(d.range);
  const where = start
    ? `${Number(start[1]) + 1}:${Number(start[2]) + 1}`
    : '1:1';
  const text = d.message.split('\n')[0] ?? '';
  return `${d.path}:${where}: ${d.severity}: ${text}`;
}

const text = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The part of the typst.ts compiler `readFitDecisions` uses. */
interface QueryCompiler {
  runWithWorld<T>(
    options: {mainFilePath: string},
    cb: (world: {
      compile(): Promise<unknown>;
      query(options: {selector: string; field?: string}): Promise<unknown>;
    }) => Promise<T>,
  ): Promise<T>;
}

/**
 * US-028 | AC-5: the values of the image fit decisions of the compiled main
 * file, in document order, with typst.ts `runWithWorld` and `query` (options
 * read from `compiler.d.mts`: `SnapshotOptions.mainFilePath`,
 * `QueryOptions.selector` and `field`; measured at G1 and by the TICKET-091
 * reader). The world compiles the document once more. A thrown query or a
 * result that is no list gives undefined: the export never fails on it.
 */
export async function readFitDecisions(
  compiler: QueryCompiler,
  mainFilePath: string,
): Promise<unknown[] | undefined> {
  try {
    const out = await compiler.runWithWorld({mainFilePath}, async (world) => {
      await world.compile();
      return world.query({selector: `<${FIT_DECISION_LABEL}>`, field: 'value'});
    });
    const values: unknown = typeof out === 'string' ? JSON.parse(out) : out;
    return Array.isArray(values) ? values : undefined;
  } catch {
    return undefined;
  }
}

/** The worker logic: `handle` takes the messages of the plugin, one at a time. */
export function createWorkerCore(post: Post): {
  handle(message: unknown): Promise<void>;
} {
  let typst: TypstSnippet | null = null;
  let wasmBytes: Uint8Array | null = null;

  const init = async (message: InitMessage): Promise<void> => {
    const snippet = new TypstSnippet();
    const wasm = new Uint8Array(message.compilerWasm);
    wasmBytes = wasm;
    snippet.setCompilerInitOptions({
      getModule: () => wasm,
      // assets: false = never fetch the default fonts (offline, US-007 AC-2).
      beforeBuild: [
        loadFonts(
          message.fonts.map((buffer) => new Uint8Array(buffer)),
          {assets: false},
        ),
      ],
    });
    snippet.setRendererInitOptions({getModule: () => new Uint8Array(0)});
    typst = snippet;
    post({type: 'ready', id: message.id});
  };

  const compile = async (message: CompileMessage): Promise<void> => {
    if (typst === null) throw new Error('compile before init');
    for (const {path, buf} of message.files) {
      await typst.mapShadow(`/${path}`, new Uint8Array(buf));
    }
    const main = `/${message.file}`;
    await typst.addSource(main, message.source);
    const compiler = await typst.getCompiler();
    // The typings demand an incremental-server field that the call does not use.
    const vector = message.type === 'compile-vector';
    const request = {
      mainFilePath: main,
      format: vector ? CompileFormatEnum.vector : CompileFormatEnum.pdf,
      diagnostics: 'full',
    } as unknown as Parameters<typeof compiler.compile>[0];
    const outcome = (await compiler.compile(request)) as {
      result?: Uint8Array;
      diagnostics?: Diagnostic[];
    };
    const pdf = outcome.result;
    if (pdf === undefined) {
      const lines = (outcome.diagnostics ?? []).map(diagnosticLine);
      if (lines.length === 0) {
        throw new Error(
          `the compiler returned no ${vector ? 'vector document' : 'PDF'}`,
        );
      }
      post({type: 'compile-error', id: message.id, message: lines.join('\n')});
      return;
    }
    const buffer = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength,
    ) as ArrayBuffer;
    // US-028 AC-5: only a document with image fit decisions is queried.
    const decisions = message.source.includes(FIT_DECISION_LABEL)
      ? await readFitDecisions(compiler as unknown as QueryCompiler, main)
      : undefined;
    const fit = decisions === undefined ? {} : {fitDecisions: decisions};
    if (vector) {
      post({type: 'vector-compiled', id: message.id, vector: buffer, ...fit}, [
        buffer,
      ]);
    } else {
      post({type: 'compiled', id: message.id, pdf: buffer, ...fit}, [buffer]);
    }
  };

  /** US-010 AC-3: the faces of each file; null for bytes that are no font. */
  const fontInfo = async (message: FontInfoMessage): Promise<void> => {
    if (wasmBytes === null) throw new Error('font-info before init');
    const wasm = wasmBytes;
    const driver = new TypstFontBuilderDriver();
    await driver.init({getModule: () => wasm});
    const faces: (FaceInfo[] | null)[] = [];
    for (const buffer of message.fonts) {
      try {
        const result = (await driver.getFontInfo(new Uint8Array(buffer))) as {
          info?: {family: string; coverage: number[]}[];
        };
        const list = (result.info ?? []).map((face) => ({
          family: face.family,
          coverage: Array.from(face.coverage),
        }));
        faces.push(list.length === 0 ? null : list);
      } catch {
        faces.push(null);
      }
    }
    post({type: 'font-info-result', id: message.id, faces});
  };

  return {
    async handle(raw: unknown): Promise<void> {
      const message = raw as {type?: string; id?: string};
      try {
        if (message.type === 'init') await init(raw as InitMessage);
        else if (
          message.type === 'compile' ||
          message.type === 'compile-vector'
        )
          await compile(raw as CompileMessage);
        else if (message.type === 'font-info')
          await fontInfo(raw as FontInfoMessage);
      } catch (error) {
        post({type: 'failed', id: message.id, message: text(error)});
      }
    },
  };
}
