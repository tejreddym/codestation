/** Local MD5 for legacy checksums. Loaded only when MD5 is selected. */
export function md5(input: Uint8Array): string {
  const wordCount = Math.ceil((input.length + 9) / 64) * 16;
  const words = new Uint32Array(wordCount);
  for (let index = 0; index < input.length; index++) {
    words[index >>> 2] |= input[index] << ((index & 3) * 8);
  }
  words[input.length >>> 2] |= 0x80 << ((input.length & 3) * 8);
  const bitLength = input.length * 8;
  words[wordCount - 2] = bitLength >>> 0;
  words[wordCount - 1] = Math.floor(bitLength / 0x100000000);
  const constants = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000));
  const shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  try {
    for (let offset = 0; offset < words.length; offset += 16) {
      let aa = a, bb = b, cc = c, dd = d;
      for (let index = 0; index < 64; index++) {
        let f: number, g: number;
        if (index < 16) { f = (bb & cc) | (~bb & dd); g = index; }
        else if (index < 32) { f = (dd & bb) | (~dd & cc); g = (5 * index + 1) % 16; }
        else if (index < 48) { f = bb ^ cc ^ dd; g = (3 * index + 5) % 16; }
        else { f = cc ^ (bb | ~dd); g = (7 * index) % 16; }
        const value = (aa + f + constants[index] + words[offset + g]) | 0;
        const shift = shifts[Math.floor(index / 16) * 4 + index % 4];
        const next = dd;
        dd = cc;
        cc = bb;
        bb = (bb + ((value << shift) | (value >>> (32 - shift)))) | 0;
        aa = next;
      }
      a = (a + aa) | 0; b = (b + bb) | 0; c = (c + cc) | 0; d = (d + dd) | 0;
    }
    return [a, b, c, d].map(value => [0, 8, 16, 24]
      .map(shift => ((value >>> shift) & 255).toString(16).padStart(2, "0")).join("")).join("");
  } finally {
    words.fill(0);
  }
}
