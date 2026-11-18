import { BILIBILI_REFERER, DEFAULT_USER_AGENT } from '../config/bilibili.config'

/** 取流 CDN 通常按 Range 分段提供媒体；一次拉完整文件在海外节点会返回 567。 */
const DOWNLOAD_CHUNK_SIZE = 2 * 1024 * 1024

export class DownloadUtils {
  async downloadToBlob(
    url: string,
    host = BILIBILI_REFERER,
    onProgress?: (progress: { loaded: number; total: number }) => void
  ): Promise<Blob> {
    const chunks: Uint8Array[] = []
    let offset = 0
    let total = 0

    while (true) {
      // 取流 URL 已带签名，不需要 Cookie。用 credentials: 'omit' 而不是 'include'：
      // 海外 CDN 常返回 `Access-Control-Allow-Origin: *` 或空
      // `Access-Control-Allow-Credentials`，include 模式会被 CORS 拒绝。
      const res = await fetch(url, {
        credentials: 'omit',
        headers: {
          'Referer': host,
          'User-Agent': DEFAULT_USER_AGENT,
          // 播放器就是按 Range 取流的；不带 Range 的整文件请求在海外会被 CDN 拒绝。
          'Range': `bytes=${offset}-${offset + DOWNLOAD_CHUNK_SIZE - 1}`
        }
      })

      if (!res.ok) throw new Error(`下载失败: HTTP ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const part: Uint8Array[] = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        part.push(value)
        received += value.length
      }
      if (received === 0) break

      chunks.push(...part)
      offset += received

      // 忽略 Range 的服务器会直接返回整个文件（200），此时无需再分段。
      if (res.status === 200) {
        if (onProgress) onProgress({ loaded: offset, total: offset })
        break
      }

      const range = res.headers.get('content-range')
      const totalMatch = range && /\/(\d+)\s*$/.exec(range)
      if (totalMatch) total = parseInt(totalMatch[1], 10)
      if (onProgress) onProgress({ loaded: offset, total: total || offset })

      if (total && offset >= total) break
      if (received < DOWNLOAD_CHUNK_SIZE) break
    }

    return new Blob(chunks as any)
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
