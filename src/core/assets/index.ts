// US-003: asset lookup and the content check. Pure: no Obsidian, Node, or I/O
// imports. The vault is given as a map from path to the first bytes of each
// file; the plugin copies exactly the files that `uses()` lists.

/** The image types Typst reads (US-003 AC-5), lower case, without the dot. */
export const SUPPORTED_IMAGE_EXTENSIONS: readonly string[] = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
];

/** What the emitter asks for (US-003 AC-8). */
export interface AssetRequest {
  /** `image` for `![alt](path)`, `embed` for `![[file]]`. */
  source: 'image' | 'embed';
  /** The path as the author wrote it (decoded for `image`). */
  target: string;
  /** 1-based source line, for the resolver's own use. */
  line: number;
}

/** What the resolver answers (US-003 AC-8). */
export type AssetResult =
  | {status: 'found'; path: string}
  | {status: 'ambiguous'; path: string; count: number}
  | {status: 'missing'}
  | {status: 'invalid'};

/** Answers the emitter's questions about image files. */
export interface AssetResolver {
  resolve(request: AssetRequest): AssetResult;
}

/** One file to copy: `from` in the vault, `to` below the export folder. */
export interface AssetUse {
  from: string;
  to: string;
}

/** The lower-case extension of the last path segment; '' if there is none. */
export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

const startsWith = (head: Uint8Array, bytes: readonly number[], at = 0) =>
  head.length >= at + bytes.length &&
  bytes.every((byte, i) => head[at + i] === byte);
const ascii = (text: string): number[] =>
  Array.from(text, (ch) => ch.charCodeAt(0));

/**
 * US-003 AC-5b: true when the first bytes of a file fit its extension (PNG,
 * JPEG, GIF, WebP, or SVG after an optional BOM and blanks). Pure.
 */
export function sniffImage(extension: string, head: Uint8Array): boolean {
  switch (extension.toLowerCase()) {
    case 'png':
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47]);
    case 'jpg':
    case 'jpeg':
      return startsWith(head, [0xff, 0xd8]);
    case 'gif':
      return startsWith(head, ascii('GIF8'));
    case 'webp':
      return (
        startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WEBP'), 8)
      );
    case 'svg': {
      let at = startsWith(head, [0xef, 0xbb, 0xbf]) ? 3 : 0;
      while (at < head.length && [0x20, 0x09, 0x0a, 0x0d].includes(head[at]!)) {
        at += 1;
      }
      return (
        startsWith(head, ascii('<svg'), at) ||
        startsWith(head, ascii('<?xml'), at)
      );
    }
    default:
      return false;
  }
}

const nfc = (text: string): string => text.normalize('NFC');
const dirOf = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** Joins and normalises `.` and `..`; null when the path leaves the root. */
function normalise(path: string): string | null {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.pop() === undefined) return null;
    } else {
      out.push(part);
    }
  }
  return out.join('/');
}

/** Options of {@link createAssetResolver}. */
export interface AssetResolverOptions {
  /** Vault path of the note being converted. */
  notePath: string;
  /** Every vault file by path, with at least its first 16 bytes. */
  files: ReadonlyMap<string, Uint8Array>;
  /**
   * US-022 AC-3, AC-10: false skips the byte check (`sniffImage`), so a file
   * that exists is found whatever its head, for a caller that has the vault's
   * file list but no bytes (the editor menu). Default true.
   */
  checkBytes?: boolean;
}

/**
 * US-003 AC-2c, AC-4, AC-4b, AC-5b, AC-8: looks files up, checks their first
 * bytes, and decides where each used file goes below the export folder.
 *
 * `uses()` lists every found file once, in the order of first use. The same
 * input in the same order gives the same destinations. Never reads or
 * modifies a file. US-022 AC-3, AC-10: with `checkBytes: false` no result is
 * `invalid`; the lookup is the same.
 */
export function createAssetResolver(
  options: AssetResolverOptions,
): AssetResolver & {uses(): AssetUse[]} {
  const noteDir = nfc(dirOf(options.notePath));
  const prefix = noteDir === '' ? '' : `${noteDir}/`;
  const heads = new Map<string, {from: string; head: Uint8Array}>();
  for (const [path, head] of options.files) {
    heads.set(nfc(path), {from: path, head});
  }
  const sorted = [...heads.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const uses: AssetUse[] = [];
  const byFrom = new Map<string, string>();
  const taken = new Set<string>();

  /** The destination of `path`, assigned on first use. */
  const destination = (path: string): string => {
    const known = byFrom.get(path);
    if (known !== undefined) return known;
    let to: string;
    if (path.startsWith(prefix)) {
      to = path.slice(prefix.length);
    } else {
      const name = nameOf(path);
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';
      to = `assets/_external/${name}`;
      for (let n = 2; taken.has(to.toLowerCase()); n++) {
        to = `assets/_external/${stem}-${n}${ext}`;
      }
    }
    taken.add(to.toLowerCase());
    byFrom.set(path, to);
    uses.push({from: heads.get(path)!.from, to});
    return to;
  };

  const checkBytes = options.checkBytes ?? true;
  const check = (path: string): boolean =>
    !checkBytes || sniffImage(extensionOf(path), heads.get(path)!.head);

  const standard = (target: string): AssetResult => {
    const wanted = nfc(target);
    const path = normalise(wanted.startsWith('/') ? wanted : prefix + wanted);
    if (path === null || !heads.has(path)) return {status: 'missing'};
    if (!check(path)) return {status: 'invalid'};
    return {status: 'found', path: destination(path)};
  };

  const embed = (target: string): AssetResult => {
    const wanted = nfc(target).replace(/^\/+/, '');
    const matches = sorted.filter(
      (path) => path === wanted || path.endsWith(`/${wanted}`),
    );
    const first = matches[0];
    if (first === undefined) return {status: 'missing'};
    const own = matches.find((path) => dirOf(path) === noteDir);
    const chosen = own ?? first;
    if (!check(chosen)) return {status: 'invalid'};
    const path = destination(chosen);
    return own === undefined && matches.length > 1
      ? {status: 'ambiguous', path, count: matches.length}
      : {status: 'found', path};
  };

  return {
    resolve: (request) =>
      request.source === 'image'
        ? standard(request.target)
        : embed(request.target),
    uses: () => uses.map((use) => ({...use})),
  };
}

export {
  IMAGE_SIZE_READ_BYTES,
  readImageSize,
  type ImageSize,
} from './image-size';
