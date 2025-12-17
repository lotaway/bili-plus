export class DownloadUtils {
  async downloadToBlob(url: string, host = 'https://www.bilibili.com/'): Promise<Blob> {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        'Referer': host,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!res.ok) throw new Error(`下载失败: HTTP ${res.status}`)

    return await res.blob()
  }

  saveBlob(blob: Blob, filename: string) {
    const a = document.createElement("a")
    const url = URL.createObjectURL(blob)
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async downloadWithChromeAPI(url: string, filename: string): Promise<void> {
    if (url.includes('bilibili.com') || url.includes('bilivideo.com')) {
      try {
        const blob = await this.downloadToBlob(url)
        const blobUrl = URL.createObjectURL(blob)

        return new Promise<void>((resolve, reject) => {
          chrome.downloads.download({
            url: blobUrl,
            filename: filename,
            saveAs: false
          }, (downloadId) => {
            URL.revokeObjectURL(blobUrl)
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve()
            }
          })
        })
      } catch (error) {
        throw new Error(`B站视频下载失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }

    // 对于普通 URL，直接使用 Chrome 下载 API
    return new Promise<void>((resolve, reject) => {
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  }
}
