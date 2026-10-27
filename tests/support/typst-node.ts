// Test support: the bundled Typst compiler in Node, offline, without fonts
// (TICKET-007). Never touches the network: default fonts are not fetched.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {TypstSnippet} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import {loadFonts} from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';

const modules = join(process.cwd(), 'node_modules', '@myriaddreamin');
const compilerWasm = () =>
  readFileSync(
    join(modules, 'typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'),
  );
const rendererWasm = () =>
  readFileSync(
    join(modules, 'typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm'),
  );

/** Typst helper that turns content into a readable string. */
const PRELUDE = `#let plain(c) = {
  if type(c) == str { c }
  else if c.func() == link { "<link " + repr(c.dest) + ">" + plain(c.body) + "</link>" }
  else if repr(c.func()) == "smartquote" { if c.double { "\\"" } else { "'" } }
  else if c.func() == enum.item { "<n" + repr(c.number) + ">" + plain(c.body) + "</>" }
  else if c.has("text") { c.text }
  else if c.has("children") { c.children.map(plain).join() }
  else if c.has("body") { "<" + repr(c.func()) + ">" + plain(c.body) + "</>" }
  else if repr(c.func()) == "space" { " " }
  else if repr(c.func()) == "linebreak" { "\\n" }
  else { "<" + repr(c.func()) + ">" }
}
`;

export interface CompileDiagnostic {
  severity: string;
  message: string;
}

let snippet: TypstSnippet | undefined;
let counter = 0;

async function compiler() {
  if (snippet === undefined) {
    snippet = new TypstSnippet();
    snippet.setCompilerInitOptions({
      getModule: () => compilerWasm(),
      beforeBuild: [loadFonts([], {assets: false})],
    });
    snippet.setRendererInitOptions({getModule: () => rendererWasm()});
  }
  return snippet;
}

/** Files the document may read, by path below the project root. */
export type Files = Readonly<Record<string, Uint8Array>>;

/**
 * Compiles `source` as a document; returns the diagnostics (empty = valid).
 * `files` are made available to `image(...)` for the length of the call.
 */
export async function diagnose(
  source: string,
  files: Files = {},
): Promise<CompileDiagnostic[]> {
  const typst = await compiler();
  const path = `/case-${counter++}.typ`;
  await typst.addSource(path, source);
  const mapped = Object.keys(files).map((name) => `/${name}`);
  for (const [name, data] of Object.entries(files)) {
    await typst.mapShadow(`/${name}`, data);
  }
  try {
    return await compile(typst, path);
  } finally {
    for (const name of mapped) await typst.unmapShadow(name);
  }
}

async function compile(
  typst: TypstSnippet,
  path: string,
): Promise<CompileDiagnostic[]> {
  const cc = await typst.getCompiler();
  // The typings demand an incremental-server field that the call does not use.
  const options = {
    mainFilePath: path,
    format: 'vector',
    diagnostics: 'full',
  } as unknown as Parameters<typeof cc.compile>[0];
  const result = await cc.compile(options);
  return (result.diagnostics ?? []) as unknown as CompileDiagnostic[];
}

/** Decodes the escapes of a Typst string representation. */
export function decodeTypstString(repr: string): string {
  return repr.replace(
    /\\(u\{([0-9a-fA-F]+)\}|.)/gs,
    (_match, rest: string, hex: string | undefined) => {
      if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
      if (rest === 'n') return '\n';
      if (rest === 'r') return '\r';
      if (rest === 't') return '\t';
      return rest;
    },
  );
}

/**
 * Compiles `[markup]` and returns what Typst reads from it as plain text.
 * Elements are shown as `<name>…</>`, so a heading or list that was not
 * meant to be one is visible. Throws on a compile error in `markup`.
 *
 * The compiler returns the value only through the message of a deliberately
 * failing assertion (`@@` is never equal); that message is parsed here.
 */
export async function plainText(
  markup: string,
  files: Files = {},
): Promise<string> {
  const diagnostics = await diagnose(
    `${PRELUDE}#assert.eq(plain([${markup}]), "@@")\n`,
    files,
  );
  const first = diagnostics.find((d) => d.severity === 'error');
  if (first === undefined) throw new Error('assertion unexpectedly passed');
  const match =
    /^equality assertion failed: value "(.*)" was not equal to "@@"$/s.exec(
      first.message,
    );
  if (match === null) {
    throw new Error(
      `compile error in ${JSON.stringify(markup)}: ${first.message}`,
    );
  }
  return decodeTypstString(match[1] as string);
}
