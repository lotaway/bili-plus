import md5 from '../utils/md5'
import {
  MIXIN_KEY_ENC_TAB,
  NAV_URL,
  WBI_FILTER_CHARS,
  WBI_KEYS_TTL_MS,
} from '../config/bilibili.config'

// [exp](https://github.com/xifangczy/cat-catch)
export interface WbiSignResult {
  w_rid: string
  wts: number
  /** 已过滤特殊字符并附带 w_rid/wts 的最终参数，调用方必须用这个构建 URL */
  params: Record<string, string>
}

export interface IWbiSigner {
  sign(params: Record<string, string>): Promise<WbiSignResult>
}

function extractKey(url: string): string {
  const idx = url.lastIndexOf('/')
  const name = idx >= 0 ? url.slice(idx + 1) : url
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(0, dot) : name
}

function mixKey(imgKey: string, subKey: string): string {
  const raw = imgKey + subKey
  let result = ''
  // 官方算法拼接 64 个字符后只取前 32 位
  for (const i of MIXIN_KEY_ENC_TAB.slice(0, 32)) {
    result += raw[i] ?? ''
  }
  return result
}

/** 按 WBI 规范剔除参数值中的特殊字符 */
function filterValue(value: string): string {
  let result = ''
  for (const char of value) {
    if (!WBI_FILTER_CHARS.includes(char)) result += char
  }
  return result
}

/** 排序 + URL 编码后拼接查询串，用于计算签名 */
function buildSortedQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')
}

interface WbiKeys {
  imgKey: string
  subKey: string
  fetchedAt: number
}

export class WbiSigner implements IWbiSigner {
  private cachedKeys: WbiKeys | null = null
  private fetching: boolean = false
  private pending: Array<{ resolve: (keys: WbiKeys) => void; reject: (err: Error) => void }> = []

  private async fetchKeys(): Promise<WbiKeys> {
    const resp = await fetch(NAV_URL, { credentials: 'include' })
    if (!resp.ok) throw new Error(`获取 WBI key 失败: HTTP ${resp.status}`)
    const body = await resp.json()
    // 未登录时 nav 返回 -101，但 wbi_img 仍然有效，不能因此放弃签名
    const img = body.data?.wbi_img
    if (!img?.img_url || !img?.sub_url) {
      throw new Error(`WBI keys not found in nav response (code: ${body.code})`)
    }
    return {
      imgKey: extractKey(img.img_url),
      subKey: extractKey(img.sub_url),
      fetchedAt: Date.now(),
    }
  }

  private async getKeys(): Promise<WbiKeys> {
    if (this.cachedKeys && Date.now() - this.cachedKeys.fetchedAt < WBI_KEYS_TTL_MS) {
      return this.cachedKeys
    }
    if (this.fetching) {
      return new Promise<WbiKeys>((resolve, reject) => {
        this.pending.push({ resolve, reject })
      })
    }
    this.fetching = true
    try {
      const keys = await this.fetchKeys()
      this.cachedKeys = keys
      this.pending.forEach(p => p.resolve(keys))
      return keys
    } catch (err) {
      this.pending.forEach(p => p.reject(err instanceof Error ? err : new Error(String(err))))
      throw err
    } finally {
      this.pending = []
      this.fetching = false
    }
  }

  invalidateCache(): void {
    this.cachedKeys = null
  }

  async sign(params: Record<string, string>): Promise<WbiSignResult> {
    const keys = await this.getKeys()
    const mixinKey = mixKey(keys.imgKey, keys.subKey)
    const wts = Math.floor(Date.now() / 1000)

    // 签名与最终 URL 必须使用同一份参数，否则 w_rid 校验失败
    const filtered: Record<string, string> = {}
    for (const [key, value] of Object.entries(params)) {
      filtered[key] = filterValue(value)
    }
    filtered.wts = wts.toString()

    const query = buildSortedQuery(filtered)
    const w_rid = md5(query + mixinKey)
    return { w_rid, wts, params: { ...filtered, w_rid } }
  }
}
