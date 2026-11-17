import { VideoDetailResponse } from '../types/video'
import { selectAudioStream, selectVideoStream } from './StreamSelector'
import { IWbiSigner } from './WbiSigner'
import {
  BILIBILI_API_HOST,
  BILIBILI_WEBSITE_HOST,
  BUVID3_COOKIE_NAME,
  FINGER_SPI_URL,
  PLAYURL_DEFAULT_FOURK,
  PLAYURL_DEFAULT_FNVAL,
  PLAYURL_DEFAULT_PLATFORM,
  PLAYURL_DEFAULT_QUALITY,
  PLAYURL_FALLBACK_QUALITY,
  VideoFormat,
  VideoQuality,
  Platform,
} from '../config/bilibili.config'

export type PlayUrlResult = {
  videoUrl: string
  audioUrl: string
  title: string
}

// 兼容旧引用，常量实际定义在 config 文件中
export { VideoFormat, VideoQuality, Platform }

export type PlayUrlResponse = {
  code: number
  message: string
  ttl: number
  data: {
    from: string
    result: string
    message: string
    quality: number
    format: string
    timelength: number
    accept_format: string
    accept_description: string[]
    accept_quality: number[]
    video_codecid?: number
    seek_param?: string
    seek_type?: string
    durl?: Array<{
      order: number
      length: number
      size: number
      ahead: string
      vhead: string
      url: string
      backup_url: string[]
    }>
    dash?: {
      duration: number
      minBufferTime: number
      min_buffer_time: number
      video: Array<{
        id: number
        baseUrl: string
        backupUrl: string[]
        bandwidth: number
        mimeType: string
        mime_type: string
        codecs: string
        width: number
        height: number
        frameRate: string
        frame_rate: string
        sar: string
        startWithSap: number
        start_with_sap: number
        SegmentBase: {
          Initialization: string
          indexRange: string
        }
        segment_base: {
          initialization: string
          index_range: string
        }
        codecid: number
      }>
      audio: Array<{
        id: number
        baseUrl: string
        backupUrl: string[]
        bandwidth: number
        mimeType: string
        mime_type: string
        codecs: string
        startWithSap: number
        start_with_sap: number
        SegmentBase: {
          Initialization: string
          indexRange: string
        }
        segment_base: {
          initialization: string
          index_range: string
        }
        codecid: number
      }>
      dolby?: {
        type: number
        audio: Array<{
          id: number
          baseUrl: string
          backupUrl: string[]
          bandwidth: number
          mimeType: string
          mime_type: string
          codecs: string
          startWithSap: number
          start_with_sap: number
          SegmentBase: {
            Initialization: string
            indexRange: string
          }
          segment_base: {
            initialization: string
            index_range: string
          }
          codecid: number
        }>
      }
      flac?: {
        audio: Array<{
          id: number
          baseUrl: string
          backupUrl: string[]
          bandwidth: number
          mimeType: string
          mime_type: string
          codecs: string
          startWithSap: number
          start_with_sap: number
          SegmentBase: {
            Initialization: string
            indexRange: string
          }
          segment_base: {
            initialization: string
            index_range: string
          }
          codecid: number
        }>
      }
    }
    support_formats: Array<{
      quality: number
      format: string
      new_description: string
      display_desc: string
      superscript: string
      codecs: string | null
      can_watch_qn_reason: number
      limit_watch_reason: number
      report: Record<string, unknown>
    }>
    high_format?: any
    last_play_time?: number
    last_play_cid?: number
    view_info?: any
    play_conf?: {
      is_new_description: boolean
    }
    cur_language?: string
    cur_production_type?: number
  }
}

export class BilibiliApi {
  private readonly host: string
  private readonly wbiSigner?: IWbiSigner

  constructor(host = BILIBILI_API_HOST, wbiSigner?: IWbiSigner) {
    this.host = host
    this.wbiSigner = wbiSigner
  }

  get websiteHost(): string {
    return BILIBILI_WEBSITE_HOST
  }

  getVideoDetailPageUrl(bvid: string, p?: number): URL {
    const url = new URL(`/video/${bvid}`, this.websiteHost)
    if (!p) {
      return url
    }
    url.searchParams.set('p', p.toString())
    return url
  }

  /** 扩展后台能拿到完整 Cookie（含 httpOnly 的 SESSDATA）；页面上下文拿不到，交给浏览器自动携带 */
  private get isExtensionContext(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.cookies?.getAll
  }

  async getCookies(): Promise<chrome.cookies.Cookie[]> {
    if (this.isExtensionContext) {
      return await chrome.cookies.getAll({
        domain: '.bilibili.com',
      })
    }
    // 页面上下文中 document.cookie 读不到 httpOnly 的 SESSDATA，
    // 返回空数组，避免手写不完整的 Cookie 头反而覆盖浏览器自动携带的完整 Cookie。
    return []
  }

  buildCookieHeader(cookies: chrome.cookies.Cookie[]): string {
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  }

  buildHeader(cookies: string): HeadersInit {
    return { Cookie: cookies }
  }

  async fillHeader(headers?: HeadersInit): Promise<HeadersInit> {
    if (headers) return headers
    const cookies = await this.getCookies()
    if (cookies.length === 0) return {}
    return this.buildHeader(this.buildCookieHeader(cookies))
  }

  /** B 站风控要求取流请求带 buvid3，缺失时从 finger/spi 获取并写回 Cookie */
  private async ensureBuvid3(): Promise<void> {
    const cookies = await this.getCookies()
    if (cookies.some(c => c.name.toLowerCase() === BUVID3_COOKIE_NAME)) return

    try {
      const resp = await fetch(FINGER_SPI_URL, { credentials: 'include' })
      if (!resp.ok) return
      const body = await resp.json()
      const buvid: string = body?.data?.b_3 ?? ''
      if (!buvid) return

      if (this.isExtensionContext) {
        await chrome.cookies.set({
          url: `${BILIBILI_WEBSITE_HOST}/`,
          domain: '.bilibili.com',
          path: '/',
          name: BUVID3_COOKIE_NAME,
          value: buvid,
        })
      } else if (typeof document !== 'undefined') {
        document.cookie = `${BUVID3_COOKIE_NAME}=${buvid}; domain=.bilibili.com; path=/`
      }
    } catch {
      // buvid3 获取失败不阻断主流程，后续请求仍可能成功
    }
  }

  /** 签名失败直接抛出，避免静默降级成无签名请求导致难排查的 -403 */
  private async signWbiParams(params: Record<string, string>): Promise<Record<string, string>> {
    if (!this.wbiSigner) return params
    const result = await this.wbiSigner.sign(params)
    return result.params
  }

  async getVideoInfo(bvid: string, headers?: HeadersInit): Promise<any> {
    headers = await this.fillHeader(headers)
    const url = `${this.host}/x/web-interface/view?bvid=${bvid}`
    return await fetch(url, { headers, credentials: 'include' }).then((r) => r.json())
  }

  async getVideoDetailInfo(
    aid: string | number,
    cid: string | number,
    headers?: HeadersInit
  ): Promise<VideoDetailResponse> {
    await this.ensureBuvid3()
    headers = await this.fillHeader(headers)
    const params = await this.signWbiParams({ aid: aid.toString(), cid: cid.toString() })
    const url = `${this.host}/x/player/wbi/v2?${new URLSearchParams(params).toString()}`
    return await fetch(url, { headers, credentials: 'include' }).then((r) => r.json())
  }

  async getVideoSubtitle(
    aid: string | number,
    cid: string | number
  ): Promise<any[]> {
    const res = await this.getVideoDetailInfo(aid, cid)
    return res?.data?.subtitle?.subtitles || []
  }

  async getSubtitleJson(url: string, headers?: HeadersInit): Promise<any> {
    headers = await this.fillHeader(headers)
    const subUrl = url.startsWith('http') ? url : 'https:' + url
    return await fetch(subUrl, { headers, credentials: 'include' }).then((r) => r.json())
  }

  private async requestPlayUrl(
    params: {
      bvid: string
      cid: number
      qn: number
      fnval: number
      fourk: number
      platform: string
    },
    headers: HeadersInit
  ): Promise<PlayUrlResponse> {
    const signed = await this.signWbiParams({
      bvid: params.bvid,
      cid: params.cid.toString(),
      qn: params.qn.toString(),
      fnval: params.fnval.toString(),
      fourk: params.fourk.toString(),
      fnver: '0',
      platform: params.platform,
      otype: 'json',
    })
    const url = `${this.host}/x/player/wbi/playurl?${new URLSearchParams(signed).toString()}`
    const resp = await fetch(url, { headers, credentials: 'include' })

    if (resp.status === 412) {
      throw new Error('B 站风控拦截了取流请求（HTTP 412），请稍后重试或检查登录状态与 buvid3')
    }
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
    }
    return await resp.json() as PlayUrlResponse
  }

  private parsePlayUrlResponse(data: PlayUrlResponse, bvid: string): PlayUrlResult | null {
    if (data.code !== 0) return null

    const dash = data.data?.dash
    if (dash) {
      if (!Array.isArray(dash.video) || dash.video.length === 0) return null
      if (!Array.isArray(dash.audio) || dash.audio.length === 0) return null
      const videoStream = selectVideoStream(dash.video as any)
      const audioStream = selectAudioStream(dash.audio as any)
      return {
        videoUrl: videoStream.baseUrl,
        audioUrl: audioStream.baseUrl,
        title: data.data.accept_description?.[0] ?? bvid,
      }
    }

    if (Array.isArray(data.data?.durl) && data.data.durl.length > 0) {
      const d = data.data.durl[0]
      return {
        videoUrl: d.url,
        audioUrl: '', // MP4 格式音频视频合并
        title: data.data.accept_description?.[0] ?? bvid,
      }
    }

    return null
  }

  // [DOC](https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/video/videostream_url.md)
  async fetchPlayUrls(
    bvid: string,
    cid: number,
    options: {
      quality?: number
      fnval?: number
      fourk?: number
      platform?: string
      headers?: HeadersInit
    } = {}
  ): Promise<PlayUrlResult> {
    if (!bvid || !cid) {
      throw new Error("bvid 和 cid 参数不能为空")
    }
    const {
      quality = PLAYURL_DEFAULT_QUALITY,
      fnval = PLAYURL_DEFAULT_FNVAL,
      fourk = PLAYURL_DEFAULT_FOURK,
      platform = PLAYURL_DEFAULT_PLATFORM,
    } = options

    await this.ensureBuvid3()
    const headers = await this.fillHeader(options.headers)

    // 依次降级：目标清晰度 DASH -> qn=80 DASH -> qn=80 MP4
    const attempts = [
      { qn: quality, fnval },
      { qn: PLAYURL_FALLBACK_QUALITY, fnval },
      { qn: PLAYURL_FALLBACK_QUALITY, fnval: VideoFormat.MP4 },
    ]

    let lastError = '未知错误'
    for (const attempt of attempts) {
      const data = await this.requestPlayUrl({ bvid, cid, ...attempt, fourk, platform }, headers)
      if (data.code !== 0) {
        lastError = `API 错误 ${data.code}: ${data.message}`
        continue
      }
      const result = this.parsePlayUrlResponse(data, bvid)
      if (result) return result
      lastError = '响应中未包含有效的视频流数据'
    }

    throw new Error(lastError)
  }
}
