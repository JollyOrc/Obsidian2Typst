// US-007 AC-12: the compiler WASM is embedded as gzip + base64 and decoded on
// first use only.

/** Decodes gzip + base64 text to the original bytes. */
export async function decodeWasm(text: string): Promise<Uint8Array> {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
    throw new Error('The embedded compiler is not valid base64');
  }
  const binary = atob(text);
  const packed = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) packed[i] = binary.charCodeAt(i);
  const stream = new Blob([packed])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * A function that decodes `text` on its first call and returns the same bytes
 * afterwards. A failed decode is tried again on the next call.
 */
export function lazyWasm(
  text: string,
  decode: (text: string) => Promise<Uint8Array> = decodeWasm,
): () => Promise<Uint8Array> {
  let pending: Promise<Uint8Array> | null = null;
  return () => {
    if (pending === null) {
      pending = decode(text);
      pending.catch(() => {
        pending = null;
      });
    }
    return pending;
  };
}
