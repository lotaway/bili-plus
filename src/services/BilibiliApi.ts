import { VideoDetailResponse } from '../types/video'

export type PlayUrlResult = {
  videoUrl: string
  audioUrl: string
  title: string
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
    return await chrome.cookies.getAll({
      domain: this.host.replace('https://api', ''),
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

  async fetchPlayUrls(bvid: string, cid: number, quality = 80): Promise<PlayUrlResult> {
    const params = new URLSearchParams({
      bvid,
      cid: cid.toString(),
      fourk: "1",
      qn: quality.toString()
    })

    const url = `${this.host}/x/player/wbi/playurl?${params.toString()}`

    const resp = await fetch(url, {
      credentials: "include"
    })

    const data = await resp.json()

    if (data.code !== 0) throw new Error(data.message)

    const dash = data.data.dash
    if (!dash) throw new Error("非 DASH 视频")

    return {
      videoUrl: dash.video[0].baseUrl,
      audioUrl: dash.audio[0].baseUrl,
      title: data.data.accept_description?.[0] ?? bvid
    }
  }
}
