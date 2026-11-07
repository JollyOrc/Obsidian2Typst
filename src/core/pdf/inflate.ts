// US-034 AC-9: the FlateDecode filter of a PDF stream, as pure code (src/core
// may not import `node:zlib`, and the word-gap scan of #133 runs synchronously
// in the compile worker). A plain DEFLATE decoder (RFC 1951) after the zlib
// header (RFC 1950), on the lines of zlib's `puff.c`: canonical Huffman codes
// decoded bit by bit, stored, fixed and dynamic blocks. The Adler-32 check
// value is not verified. Checked against `node:zlib` in the unit tests and on
// every PDF the integration tests read.

/** The base and extra bits of the length codes 257 to 285. */
const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67,
  83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
  5, 5, 0,
];
/** The base and extra bits of the distance codes 0 to 29. */
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
  1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11,
  11, 12, 12, 13, 13,
];
/** The order the code-length code lengths are written in (dynamic blocks). */
const CLEN_ORDER = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

/** A canonical Huffman code: codes per length, symbols in code order. */
interface Huffman {
  count: Uint16Array;
  symbol: Uint16Array;
}

function huffman(lengths: ArrayLike<number>): Huffman {
  const count = new Uint16Array(16);
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i] as number;
    count[len] = (count[len] as number) + 1;
  }
  count[0] = 0;
  const offs = new Uint16Array(16);
  for (let len = 1; len < 16; len++)
    offs[len] = (offs[len - 1] as number) + (count[len - 1] as number);
  // offs[0] stays 0; count[0] is 0, so offs[1] is 0 as well.
  const symbol = new Uint16Array(lengths.length);
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i] as number;
    if (len !== 0) {
      symbol[offs[len] as number] = i;
      offs[len] = (offs[len] as number) + 1;
    }
  }
  return {count, symbol};
}

const FIXED_LENGTH = huffman(
  Array.from({length: 288}, (_, i) =>
    i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8,
  ),
);
const FIXED_DIST = huffman(new Array<number>(30).fill(5));

/**
 * The inflated bytes of a FlateDecode stream: zlib-wrapped (as PDF writes
 * it) or raw DEFLATE. Throws on a malformed or truncated stream.
 */
export function inflate(data: Uint8Array): Uint8Array {
  let pos = 0;
  const cmf = data[0] ?? 0;
  const flg = data[1] ?? 0;
  if ((cmf & 0x0f) === 8 && (cmf * 256 + flg) % 31 === 0) {
    if ((flg & 0x20) !== 0) throw new Error('inflate: preset dictionary');
    pos = 2;
  }
  let bitBuf = 0;
  let bitCount = 0;
  let out = new Uint8Array(Math.max(1024, data.length * 4));
  let size = 0;
  const room = (n: number): void => {
    if (size + n <= out.length) return;
    let next = out.length * 2;
    while (next < size + n) next *= 2;
    const grown = new Uint8Array(next);
    grown.set(out.subarray(0, size));
    out = grown;
  };
  const bits = (n: number): number => {
    while (bitCount < n) {
      if (pos >= data.length) throw new Error('inflate: unexpected end');
      bitBuf |= (data[pos++] as number) << bitCount;
      bitCount += 8;
    }
    const value = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCount -= n;
    return value;
  };
  const decode = (h: Huffman): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const count = h.count[len] as number;
      if (code - count < first) return h.symbol[index + code - first] as number;
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error('inflate: bad code');
  };
  const codes = (lengths: Huffman, dists: Huffman): void => {
    for (;;) {
      const sym = decode(lengths);
      if (sym < 256) {
        room(1);
        out[size++] = sym;
      } else if (sym === 256) {
        return;
      } else {
        const l = sym - 257;
        if (l >= 29) throw new Error('inflate: bad length');
        const len =
          (LENGTH_BASE[l] as number) + bits(LENGTH_EXTRA[l] as number);
        const d = decode(dists);
        if (d >= 30) throw new Error('inflate: bad distance');
        const dist = (DIST_BASE[d] as number) + bits(DIST_EXTRA[d] as number);
        if (dist > size) throw new Error('inflate: distance too far');
        room(len);
        for (let i = 0; i < len; i++) {
          out[size] = out[size - dist] as number;
          size++;
        }
      }
    }
  };
  let last = 0;
  while (last === 0) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitBuf = 0;
      bitCount = 0;
      if (pos + 4 > data.length) throw new Error('inflate: unexpected end');
      const len = (data[pos] as number) | ((data[pos + 1] as number) << 8);
      const nlen = (data[pos + 2] as number) | ((data[pos + 3] as number) << 8);
      if (len !== (~nlen & 0xffff))
        throw new Error('inflate: bad stored block');
      pos += 4;
      if (pos + len > data.length) throw new Error('inflate: unexpected end');
      room(len);
      out.set(data.subarray(pos, pos + len), size);
      size += len;
      pos += len;
    } else if (type === 1) {
      codes(FIXED_LENGTH, FIXED_DIST);
    } else if (type === 2) {
      const nlen = bits(5) + 257;
      const ndist = bits(5) + 1;
      const ncode = bits(4) + 4;
      const clen = new Array<number>(19).fill(0);
      for (let i = 0; i < ncode; i++) clen[CLEN_ORDER[i] as number] = bits(3);
      const lencode = huffman(clen);
      const lengths: number[] = [];
      while (lengths.length < nlen + ndist) {
        const sym = decode(lencode);
        if (sym < 16) {
          lengths.push(sym);
        } else {
          let value = 0;
          let repeat: number;
          if (sym === 16) {
            if (lengths.length === 0) throw new Error('inflate: bad repeat');
            value = lengths[lengths.length - 1] as number;
            repeat = 3 + bits(2);
          } else if (sym === 17) {
            repeat = 3 + bits(3);
          } else {
            repeat = 11 + bits(7);
          }
          if (lengths.length + repeat > nlen + ndist)
            throw new Error('inflate: too many lengths');
          for (let i = 0; i < repeat; i++) lengths.push(value);
        }
      }
      codes(huffman(lengths.slice(0, nlen)), huffman(lengths.slice(nlen)));
    } else {
      throw new Error('inflate: bad block type');
    }
  }
  return out.slice(0, size);
}
