function leftRotate(x: number, c: number): number {
  return (x << c) | (x >>> (32 - c))
}

function toHex(n: number): string {
  return n.toString(16).padStart(8, '0')
}

function padMessage(bytes: Uint8Array): Uint8Array {
  const bitLen = bytes.length * 8
  const padLen = 64 - ((bytes.length + 8) % 64)
  const totalLen = bytes.length + padLen + 8
  const padded = new Uint8Array(totalLen)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength)
  view.setUint32(totalLen - 8, bitLen >>> 0, true)
  return padded
}

function md5F(x: number, y: number, z: number): number { return (x & y) | (~x & z) }
function md5G(x: number, y: number, z: number): number { return (x & z) | (y & ~z) }
function md5H(x: number, y: number, z: number): number { return x ^ y ^ z }
function md5I(x: number, y: number, z: number): number { return y ^ (x | ~z) }

const S: number[] = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const T: number[] = (() => {
  const arr: number[] = []
  for (let i = 0; i < 64; i++) {
    arr[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)
  }
  return arr
})()

function getWord(block: Uint8Array, offset: number): number {
  return block[offset] | (block[offset + 1] << 8) | (block[offset + 2] << 16) | (block[offset + 3] << 24)
}

function processBlock(block: Uint8Array, h: number[]): number[] {
  const w: number[] = []
  for (let i = 0; i < 16; i++) w[i] = getWord(block, i * 4)

  let a = h[0], b = h[1], c = h[2], d = h[3]

  for (let i = 0; i < 64; i++) {
    let f: number, g: number
    if (i < 16) { f = md5F(b, c, d); g = i }
    else if (i < 32) { f = md5G(b, c, d); g = (5 * i + 1) % 16 }
    else if (i < 48) { f = md5H(b, c, d); g = (3 * i + 5) % 16 }
    else { f = md5I(b, c, d); g = (7 * i) % 16 }

    const temp = d
    d = c
    c = b
    b = (b + leftRotate(a + f + T[i] + w[g], S[i])) >>> 0
    a = temp
  }

  return [
    (h[0] + a) >>> 0,
    (h[1] + b) >>> 0,
    (h[2] + c) >>> 0,
    (h[3] + d) >>> 0,
  ]
}

function md5(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const padded = padMessage(bytes)
  let h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]

  for (let i = 0; i < padded.length; i += 64) {
    const block = padded.subarray(i, i + 64)
    h = processBlock(block, h)
  }

  return toHex(h[0]) + toHex(h[1]) + toHex(h[2]) + toHex(h[3])
}

export default md5
