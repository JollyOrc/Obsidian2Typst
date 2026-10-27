// Test support for US-010: font files for tests. `renameFamily` makes a copy of
// a font with another family name (same length, written everywhere the name is
// stored as ASCII or UTF-16BE), so that a test has a family that no bundled
// font has. The tables keep their old checksums; the compiler does not check
// them.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

/** The bytes of a bundled font file of `assets/fonts`. */
export const bundledFontFile = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(process.cwd(), 'assets/fonts', name)));

const utf16 = (text: string): number[] =>
  Array.from(text).flatMap((ch) => [0, ch.charCodeAt(0)]);
const ascii = (text: string): number[] =>
  Array.from(text, (ch) => ch.charCodeAt(0));

function replaceAll(
  bytes: Uint8Array,
  from: readonly number[],
  to: readonly number[],
): void {
  for (let i = 0; i + from.length <= bytes.length; i++) {
    if (from.every((b, k) => bytes[i + k] === b)) {
      bytes.set(to, i);
      i += from.length - 1;
    }
  }
}

/** A copy of `bytes` whose family name `from` is `to` (same length). */
export function renameFamily(
  bytes: Uint8Array,
  from: string,
  to: string,
): Uint8Array {
  if (from.length !== to.length) {
    throw new Error('The new family name must have the same length');
  }
  const copy = bytes.slice();
  replaceAll(copy, utf16(from), utf16(to));
  replaceAll(copy, ascii(from), ascii(to));
  return copy;
}

/** The family name that tests give to the renamed DejaVu Sans Mono. */
export const VAULT_FAMILY = 'VaultTest Mono 1';

/** A font with family {@link VAULT_FAMILY}: DejaVu Sans Mono, renamed. */
export const vaultTestFont = (): Uint8Array =>
  renameFamily(
    bundledFontFile('DejaVuSansMono.ttf'),
    'DejaVu Sans Mono',
    VAULT_FAMILY,
  );
