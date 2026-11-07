export const RELEASE_FILES: readonly string[];
export function checkRelease(
  root: string,
  options?: {testBuild?: boolean},
): {version: string; minAppVersion: string};
export function makeZip(entries: {name: string; data: Uint8Array}[]): Buffer;
export function assembleRelease(options: {
  from: string;
  out: string;
  version: string;
}): {zip: string; sums: Record<string, string>};
