// US-007 AC-13: the default fonts (Libertinus Serif, DejaVu Sans Mono) are
// embedded in main.js as gzip + base64, one text per font file, and decoded on
// first use only (as the compiler WASM, AC-12).
import {decodeWasm} from './wasm-codec';

/**
 * A function that decodes every text of `encoded` on its first call and
 * returns the same font files afterwards, in the order of `encoded`. A failed
 * decode is tried again on the next call.
 */
export function lazyFonts(
  encoded: readonly string[],
  decode: (text: string) => Promise<Uint8Array> = decodeWasm,
): () => Promise<Uint8Array[]> {
  let pending: Promise<Uint8Array[]> | null = null;
  return () => {
    if (pending === null) {
      pending = Promise.all(encoded.map((text) => decode(text)));
      pending.catch(() => {
        pending = null;
      });
    }
    return pending;
  };
}
