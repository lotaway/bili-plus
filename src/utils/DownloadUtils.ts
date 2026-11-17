import { BILIBILI_REFERER, DEFAULT_USER_AGENT } from '../config/bilibili.config'

export class DownloadUtils {
  async downloadToBlob(
    url: string,
    host = BILIBILI_REFERER,
    onProgress?: (progress: { loaded: number; total: number }) => void
  ): Promise<Blob> {
    // credentials: 'include' 让浏览器自动携带目标域 Cookie（含 httpOnly 的 SESSDATA）
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        'Referer': host,
        'User-Agent': DEFAULT_USER_AGENT,
      }
    })

    if (!res.ok) throw new Error(`下载失败: HTTP ${res.status}`)

    const reader = res.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const contentLength = parseInt(res.headers.get('content-length') || '0')
    let receivedLength = 0
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      chunks.push(value)
      receivedLength += value.length

      if (onProgress) {
        onProgress({
          loaded: receivedLength,
          total: contentLength
        })
      }
    }

    const blob = new Blob(chunks as any)
    return blob
  }

  async saveBlob(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob)

    // background service worker 中没有 document，改用 chrome.downloads 落盘
    if (typeof document === 'undefined') {
      try {
        await new Promise<void>((resolve, reject) => {
          chrome.downloads.download({
            url,
            filename,
            saveAs: false
          }, () => {
            const error = chrome.runtime.lastError
            if (error) reject(new Error(error.message))
            else resolve()
          })
        })
      } finally {
        URL.revokeObjectURL(url)
      }
      return
    }

    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async downloadWithChromeAPI(
    url: string,
    filename: string,
    onProgress?: (progress: { loaded: number; total: number }) => void
  ): Promise<void> {
    if (url.includes('bilibili.com') || url.includes('bilivideo.com')) {
      try {
        const blob = await this.downloadToBlob(url, undefined, onProgress)
        const blobUrl = URL.createObjectURL(blob)

        return new Promise<void>((resolve, reject) => {
          chrome.downloads.download({
            url: blobUrl,
            filename: filename,
            saveAs: false
          }, () => {
            URL.revokeObjectURL(blobUrl)
            const error = chrome.runtime.lastError
            if (error) {
              reject(new Error(error.message))
            } else {
              resolve()
            }
          })
        })
      } catch (error) {
        throw new Error(`B站视频下载失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }

    return new Promise<void>((resolve, reject) => {
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      }, () => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
        } else {
          resolve()
        }
      })
    })
  }
}
