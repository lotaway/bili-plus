import { BilibiliApi } from '../../services/BilibiliApi'

const bilibiliApi = new BilibiliApi()

export async function downloadToBlob(url: string): Promise<Blob> {
  const res = await fetch(url, {
    credentials: "include"
  })

  if (!res.ok) throw new Error("下载失败")

  return await res.blob()
}

export function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a")
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadWithChromeAPI(url: string, filename: string) {
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

export async function downloadBiliVideo(bvid: string, cid: number, useChromeAPI = false): Promise<void> {
  const { videoUrl, audioUrl, title } = await bilibiliApi.fetchPlayUrls(bvid, cid)

  if (useChromeAPI) {
    await Promise.all([
      downloadWithChromeAPI(videoUrl, `${title}.video.mp4`),
      downloadWithChromeAPI(audioUrl, `${title}.audio.m4a`)
    ])
  } else {
    const [videoBlob, audioBlob] = await Promise.all([
      downloadToBlob(videoUrl),
      downloadToBlob(audioUrl)
    ])

    saveBlob(videoBlob, `${title}.video.mp4`)
    saveBlob(audioBlob, `${title}.audio.m4a`)
  }
}

export function parseVideoInfoFromUrl(): { bvid: string; cid: string } | null {
  const url = new URL(window.location.href)
  
  const bvidMatch = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)
  if (!bvidMatch) return null
  
  const bvid = bvidMatch[1]
  
  const cidParam = url.searchParams.get('p') || '1'
  
  return {
    bvid,
    cid: cidParam
  }
}
