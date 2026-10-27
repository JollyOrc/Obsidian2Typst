// Modules that the build (build/build-plugin.mjs) fills with embedded text.
declare module 'embedded:compiler-wasm' {
  /** The compiler WASM as gzip + base64. */
  const text: string;
  export default text;
}
declare module 'embedded:renderer-wasm' {
  /** The page renderer WASM (US-012) as gzip + base64. */
  const text: string;
  export default text;
}
declare module 'embedded:worker-source' {
  /** The code of the compiler worker. */
  const text: string;
  export default text;
}
declare module 'embedded:default-fonts' {
  /** The default font files (assets/fonts) as gzip + base64, one text each. */
  const texts: string[];
  export default texts;
}
