export class BilibiliApi {
  #host = '';
  constructor(host = 'https://api.bilibili.com') {
    this.#host = host;
  }

  async getCookies(): Promise<chrome.cookies.Cookie[]> {
    return await chrome.cookies.getAll({
      domain: this.#host.replace('https://api', ''),
    });
  }

  buildCookieHeader(cookies: chrome.cookies.Cookie[]): string {
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  buildHeader(cookies: string): HeadersInit {
    return { Cookie: cookies };
  }

  async fillHeader(headers?: HeadersInit): Promise<HeadersInit> {
    if (!headers) {
      const cookieHeader = this.buildCookieHeader(await this.getCookies());
      headers = this.buildHeader(cookieHeader);
    }
    return headers;
  }

  async getVideoInfo(bvid: string, headers?: HeadersInit): Promise<any> {
    headers = await this.fillHeader(headers);
    const url = `${this.#host}/x/web-interface/view?bvid=${bvid}`;
    return await fetch(url, { headers }).then((r) => r.json());
  }

  async getVideoDetailInfo(
    aid: string | number,
    cid: string | number,
    headers?: HeadersInit
  ): Promise<any> {
    headers = await this.fillHeader(headers);
    const url = `${this.#host}/x/player/wbi/v2?aid=${aid}&cid=${cid}`;
    return await fetch(url, { headers }).then((r) => r.json());
  }

  async getVideoSubtitle(
    aid: string | number,
    cid: string | number
  ): Promise<any[]> {
    const res = await this.getVideoDetailInfo(aid, cid);
    return res?.data?.subtitle?.subtitles || [];
  }

  async getSubtitleJson(url: string, headers?: HeadersInit): Promise<any> {
    headers = await this.fillHeader(headers);
    const subUrl = url.startsWith('http') ? url : 'https:' + url;
    return await fetch(subUrl, { headers }).then((r) => r.json());
  }
}
