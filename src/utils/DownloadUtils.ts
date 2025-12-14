export class DownloadUtils {
  async downloadToBlob(url: string): Promise<Blob> {
    const res = await fetch(url, {
      credentials: "include"
    })

    if (!res.ok) throw new Error("下载失败")

    return await res.blob()
  }

  saveBlob(blob: Blob, filename: string) {
    const a = document.createElement("a")
    const url = URL.createObjectURL(blob)
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  downloadWithChromeAPI(url: string, filename: string): Promise<void> {
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
