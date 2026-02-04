import { VideoDetailResponse } from '../types/video'
import { selectAudioStream, selectVideoStream } from './StreamSelector'

export type PlayUrlResult = {
  videoUrl: string
  audioUrl: string
  title: string
}

// 视频流格式常量
export const VideoFormat = {
  MP4: 1,        // MP4 格式
  DASH: 16,      // DASH 格式
  DASH_HDR: 80,  // DASH + HDR (16 | 64)
  DASH_DOLBY: 272, // DASH + 杜比音频 (16 | 256)
  DASH_DOLBY_VISION: 528, // DASH + 杜比视界 (16 | 512)
  DASH_4K: 144,  // DASH + 4K (16 | 128)
  DASH_8K: 1040, // DASH + 8K (16 | 1024)
  DASH_AV1: 2064, // DASH + AV1 (16 | 2048)
  ALL_DASH: 4048 // 所有可用 DASH 流
} as const

// 视频清晰度常量
export const VideoQuality = {
  LD_240P: 6,    // 240P 极速
  SD_360P: 16,   // 360P 流畅
  SD_480P: 32,   // 480P 清晰
  HD_720P: 64,   // 720P 高清
  HD_720P60: 74, // 720P 60帧
  FHD_1080P: 80, // 1080P 高清
  AI_ENHANCED: 100, // 智能修复
  FHD_1080P_PLUS: 112, // 1080P+ 高码率
  FHD_1080P60: 116, // 1080P 60帧
  UHD_4K: 120,   // 4K 超清
  HDR: 125,      // HDR 真彩色
  DOLBY_VISION: 126, // 杜比视界
  UHD_8K: 127,   // 8K 超高清
  HDR_VIVID: 129 // HDR Vivid
} as const

// 平台常量
export const Platform = {
  PC: 'pc',      // Web 端
  HTML5: 'html5' // 移动端 HTML5
} as const

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
  private readonly host: string = '';

  constructor(host = 'https://api.bilibili.com') {
    this.host = host
  }

  get websiteHost(): string {
    return "https://www.bilibili.com"
  }

  getVideoDetailPageUrl(bvid: string, p?: number): URL {
    const url = new URL(`/video/${bvid}`, this.websiteHost)
    if (!p) {
      return url
    }
    url.searchParams.set('p', p.toString())
    return url
  }

  async getCookies(): Promise<chrome.cookies.Cookie[]> {
    if (typeof chrome !== 'undefined' && chrome.cookies?.getAll) {
      return await chrome.cookies.getAll({
        domain: this.host.replace('https://api', ''),
      })
    }
    return document.cookie.split(";").map(item => {
      const [name, value] = item.trim().split("=")
      return {
        domain: this.host.replace('https://api', ''),
        name,
        value,
        path: '/',
        secure: true,
        httpOnly: false,
      } as chrome.cookies.Cookie
    })
  }

  buildCookieHeader(cookies: chrome.cookies.Cookie[]): string {
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  }

  buildHeader(cookies: string): HeadersInit {
    return { Cookie: cookies }
  }

  async fillHeader(headers?: HeadersInit): Promise<HeadersInit> {
    if (!headers) {
      const cookieHeader = this.buildCookieHeader(await this.getCookies())
      headers = this.buildHeader(cookieHeader)
    }
    return headers
  }

  async getVideoInfo(bvid: string, headers?: HeadersInit): Promise<any> {
    headers = await this.fillHeader(headers)
    const url = `${this.host}/x/web-interface/view?bvid=${bvid}`
    return await fetch(url, { headers }).then((r) => r.json())
  }

  async getVideoDetailInfo(
    aid: string | number,
    cid: string | number,
    headers?: HeadersInit
  ): Promise<VideoDetailResponse> {
    headers = await this.fillHeader(headers)
    const url = `${this.host}/x/player/wbi/v2?aid=${aid}&cid=${cid}`
    return await fetch(url, { headers }).then((r) => r.json())
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
    return await fetch(subUrl, { headers }).then((r) => r.json())
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
      quality = VideoQuality.FHD_1080P,
      fnval = VideoFormat.ALL_DASH,
      fourk = 0,
      platform = Platform.PC
    } = options

    const params = new URLSearchParams({
      bvid,
      cid: cid.toString(),
      qn: quality.toString(),
      fnval: fnval.toString(),
      fourk: fourk.toString(),
      fnver: '0',
      platform,
      otype: 'json'
    })

    const url = `${this.host}/x/player/wbi/playurl?${params.toString()}`
    const _headers = await this.fillHeader(options.headers)
    const resp = await fetch(url, { headers: _headers })

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
    }

    const data = await resp.json() as PlayUrlResponse

    if (data.code !== 0) {
      const fallbackParams = new URLSearchParams({
        bvid,
        cid: cid.toString(),
        qn: (options.quality ?? VideoQuality.FHD_1080P).toString(),
        fnval: VideoFormat.MP4.toString(),
        fourk: (options.fourk ?? 0).toString(),
        fnver: '0',
        platform: (options.platform ?? Platform.PC),
        otype: 'json'
      })
      const fallbackUrl = `${this.host}/x/player/wbi/playurl?${fallbackParams.toString()}`
      const fallbackResp = await fetch(fallbackUrl, { headers: _headers })
      const fallbackData = await fallbackResp.json() as PlayUrlResponse
      if (fallbackData.code === 0 && fallbackData.data.durl && fallbackData.data.durl.length > 0) {
        const d = fallbackData.data.durl[0]
        return { videoUrl: d.url, audioUrl: '', title: fallbackData.data.accept_description?.[0] ?? bvid }
      }
      throw new Error(`API 错误 ${data.code}: ${data.message}`)
    }

    if (data.data.dash) {
      const dash = data.data.dash
      if (!dash.video || dash.video.length === 0) {
        throw new Error("DASH 格式视频流数据为空")
      }
      if (!dash.audio || dash.audio.length === 0) {
        throw new Error("DASH 格式音频流数据为空")
      }
      const videoStream = selectVideoStream(dash.video as any)
      const audioStream = selectAudioStream(dash.audio as any)
      return {
        videoUrl: videoStream.baseUrl,
        audioUrl: audioStream.baseUrl,
        title: data.data.accept_description?.[0] ?? bvid
      }
    }
    if (data.data.durl && data.data.durl.length > 0) {
      const durl = data.data.durl[0]
      const videoUrl = durl.url
      return {
        videoUrl: videoUrl,
        audioUrl: '', // MP4 格式音频视频合并
        title: data.data.accept_description?.[0] ?? bvid
      }
    }

    throw new Error(`无法获取视频播放地址：响应中未包含有效的视频流数据。API 响应: ${JSON.stringify(data, null, 2)}`)
  }
}
