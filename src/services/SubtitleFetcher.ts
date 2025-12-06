import { BilibiliApi } from './BilibiliApi'
import { VideoData, Page } from '../types/video'
import { DownloadType } from '../enums/DownloadType'

interface VideoInfo {
  isInit: boolean
  aid: number | null
  cid: number | null
  bvid: string | null
  p: number | null
}

export class SubtitleFetcher {
  private videoInfo: VideoInfo = {
    isInit: false,
    aid: null,
    cid: null,
    bvid: null,
    p: null,
  }
  private readonly api = new BilibiliApi()
  MAX_STORED_VIDEOS = 50

  get isInit() {
    return this.videoInfo.isInit
  }

  get aid() {
    return this.videoInfo.aid
  }

  get cid() {
    return this.videoInfo.cid as number
  }

  get bvid() {
    return Number.parseInt(this.videoInfo.bvid ?? String(Math.random() * 10000))
  }

  get p() {
    return this.videoInfo.p ?? 1
  }

  getVideoDetailPageUrl() {
    return this.api.getVideoDetailPageUrl(this.bvid, this.p)
  }

  async getTitle(): Promise<string> {
    if (!this.videoInfo.bvid) return ''
    const data = (await chrome.storage.local.get([this.videoInfo.bvid]))[
      this.videoInfo.bvid
    ]
    if (!data) {
      return ''
    }
    const pages: Page[] = data?.pages ?? []
    if (pages.length <= 1) {
      return data?.title ?? ''
    }
    const page = pages.find((p) => p.cid === this.videoInfo.cid)
    return `${data?.title ?? ''}-${page?.part ?? ''}`
  }

  async cleanupOldStorage() {
    try {
      const allData = await chrome.storage.local.get(null)
      const videoKeys = Object.keys(allData).filter(
        (key) => key.startsWith('BV') || /^\d+$/.test(key)
      )

      if (videoKeys.length > this.MAX_STORED_VIDEOS) {
        const keysToRemove = videoKeys.slice(
          0,
          videoKeys.length - this.MAX_STORED_VIDEOS
        )
        await chrome.storage.local.remove(keysToRemove)
        console.log(`清理了 ${keysToRemove.length} 个过期的视频存储`)
      }
    } catch (error) {
      console.error('清理存储时出错:', error)
    }
  }

  async init(data: VideoData) {
    this.videoInfo.aid = data.aid ?? null
    this.videoInfo.cid =
      (data.p && data.pages ? data.pages[data.p - 1]?.cid : data.cid) ?? null
    this.videoInfo.bvid = data.bvid ?? null
    this.videoInfo.p = data.p ?? null
    this.videoInfo.isInit = !!(this.videoInfo.cid && this.videoInfo.aid)
    if (this.videoInfo.bvid) {
      await this.cleanupOldStorage()
      chrome.storage.local.set({
        [this.videoInfo.bvid]: {
          ...data,
          timestamp: Date.now(),
        },
      })
    }
  }

  async getSubtitlesText(headers?: HeadersInit): Promise<any> {
    if (!this.videoInfo.aid || !this.videoInfo.cid) {
      return { error: 'Video info not initialized' }
    }
    headers = await this.api.fillHeader(headers)
    const subtitles = await this.api.getVideoSubtitle(
      this.videoInfo.aid,
      this.videoInfo.cid
    )
    const pref = subtitles.find((s: any) =>
      ['zh-CN', 'zh', 'ai-zh'].includes(s.lan)
    )
    if (!pref) return { error: '无可用字幕' }
    return await this.api.getSubtitleJson(pref.subtitle_url, headers)
  }

  async fetchSubtitlesHandler(payload: { mode?: DownloadType }) {
    payload.mode = payload.mode ?? DownloadType.SRT
    const { mode } = payload
    const subJson = await this.getSubtitlesText()
    if (subJson.error) return subJson

    switch (mode) {
      case DownloadType.MARKDOWN:
        return this.bilisub2text(subJson)
      case DownloadType.SRT:
      default:
        return this.bilisub2srt(subJson)
    }
  }

  float2hhmmss(num: number) {
    const int_ = Number.parseInt(String(num))
    const frac = Number.parseInt(String((num - int_) * 1000))
    const hr = Math.floor(int_ / 3600)
    const min = Math.floor((int_ % 3600) / 60)
    const sec = int_ % 60
    return `${hr}:${String(min).padStart(2, '0')}:${String(sec).padStart(
      2,
      '0'
    )},${String(frac).padStart(3, '0')}`
  }

  bilisub2text(j: any) {
    return j.body.map((s: any) => s.content).join('\n')
  }

  bilisub2srt(j: any) {
    return j.body
      .map(
        (s: any, i: number) =>
          `${i + 1}\n${this.float2hhmmss(s.from)} --> ${this.float2hhmmss(
            s.to
          )}\n${s.content}`
      )
      .join('\n\n')
  }
}
