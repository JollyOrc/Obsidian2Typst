// US-007 AC-12: the compiler WASM embedded in main.js, decoded on first use.
import compilerWasmText from 'embedded:compiler-wasm';
import rendererWasmText from 'embedded:renderer-wasm';
import {lazyWasm} from './wasm-codec';

/** The decoded compiler WASM; decodes on the first call only. */
export const embeddedCompilerWasm = lazyWasm(compilerWasmText);

/** US-012: the decoded page renderer WASM; decodes on the first call only. */
export const embeddedRendererWasm = lazyWasm(rendererWasmText);
