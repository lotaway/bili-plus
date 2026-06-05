import md5 from '../utils/md5'

// [exp](https://github.com/xifangczy/cat-catch)
export interface WbiSignResult {
  w_rid: string
  wts: number
}

export interface IWbiSigner {
  sign(params: Record<string, string>): Promise<WbiSignResult>
}

const NAV_URL = 'https://api.bilibili.com/x/web-interface/nav'

const MIXIN_TABLE: number[] = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 37, 12, 52, 56, 7,
  42, 61, 37, 61, 57, 20, 60, 46, 16, 17, 55, 44, 24, 44, 30, 36,
  26, 25, 21, 54, 22, 51, 11, 38, 6, 59, 40, 57, 13, 1, 1, 18,
]

function extractKey(url: string): string {
  const idx = url.lastIndexOf('/')
  const name = idx >= 0 ? url.slice(idx + 1) : url
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(0, dot) : name
}

function mixKey(imgKey: string, subKey: string): string {
  const raw = imgKey + subKey
  let result = ''
  for (let i = 0; i < 32; i++) result += raw[MIXIN_TABLE[i]]
  return result
}

function buildSortedQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')
}

interface WbiKeys {
  imgKey: string
  subKey: string
}

export class WbiSigner implements IWbiSigner {
  private cachedKeys: WbiKeys | null = null
  private fetching: boolean = false
  private pending: Array<{ resolve: (keys: WbiKeys) => void; reject: (err: Error) => void }> = []

  private async fetchKeys(): Promise<WbiKeys> {
    const resp = await fetch(NAV_URL, { credentials: 'include' })
    const body = await resp.json()
    if (body.code !== 0) throw new Error(`WBI nav API error: ${body.code}`)
    const img = body.data?.wbi_img
    if (!img?.img_url || !img?.sub_url) throw new Error('WBI keys not found in nav response')
    return { imgKey: extractKey(img.img_url), subKey: extractKey(img.sub_url) }
  }

  private async getKeys(): Promise<WbiKeys> {
    if (this.cachedKeys) return this.cachedKeys
    if (this.fetching) {
      return new Promise<WbiKeys>((resolve, reject) => {
        this.pending.push({ resolve, reject })
      })
    }
    this.fetching = true
    try {
      const keys = await this.fetchKeys()
      this.cachedKeys = keys
      return keys
    } finally {
      this.fetching = false
      this.pending.forEach(p => p.resolve(this.cachedKeys!))
      this.pending = []
    }
  }

  invalidateCache(): void {
    this.cachedKeys = null
  }

  async sign(params: Record<string, string>): Promise<WbiSignResult> {
    const keys = await this.getKeys()
    const mixinKey = mixKey(keys.imgKey, keys.subKey)
    const wts = Math.floor(Date.now() / 1000)
    const all: Record<string, string> = { ...params, wts: wts.toString() }
    const query = buildSortedQuery(all)
    const w_rid = md5(query + mixinKey)
    return { w_rid, wts }
  }
}
