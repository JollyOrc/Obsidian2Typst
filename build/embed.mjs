// US-007 AC-12: build-time helpers that put the compiler into main.js.
import {gzipSync} from 'node:zlib';

/** gzip (level 9) of `bytes`, as base64 without line breaks. */
export function gzipBase64(bytes) {
  return gzipSync(bytes, {level: 9}).toString('base64');
}
