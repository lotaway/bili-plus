import { PageType } from '../../enums/PageType'
import { VideoData } from '../../types/video'
import { PageEventType } from '../../enums/PageEventType'
import { BilibiliApi } from '../../services/BilibiliApi'
import { DownloadUtils } from '../../utils/DownloadUtils'

let isWindowActivate = true

export { }

function main() {
  console.debug('Start video inject.js')
  syncVideoInfo()
  const timer = setInterval(() => {
    syncVideoInfo()
  }, 5 * 1000)
  document.addEventListener('visibilitychange', () => {
    isWindowActivate = document.visibilityState === 'visible'
    syncVideoInfo()
  })
  window.addEventListener('unload', () => {
    clearInterval(timer)
  })
  initButtonInjection()
  addDownloadListener()
  console.debug('End video inject.js')
}

function addDownloadListener() {
  window.addEventListener('message', async (event) => {
    if (
      event.source !== window ||
      event.data?.source !== PageType.CONTENT_SCRIPT ||
      event.data?.type !== PageEventType.REQUEST_DOWNLOAD_VIDEO
    ) {
      return
    }

    const { bvid, cid, downloadType } = event.data.payload

    try {
      const result = await handleVideoDownload(bvid, cid, downloadType)

      window.postMessage({
        source: PageType.VIDEO_PAGE_INJECT,
        type: PageEventType.REQUEST_DOWNLOAD_VIDEO,
        payload: result
      }, '*')
    } catch (error) {
      window.postMessage({
        source: PageType.VIDEO_PAGE_INJECT,
        type: PageEventType.REQUEST_DOWNLOAD_VIDEO,
        payload: {
          error: error instanceof Error ? error.message : '下载失败'
        }
      }, '*')
    }
  })
}

async function handleVideoDownload(bvid: string, cid: string, downloadType: string) {
  const videoData = (window as any).__INITIAL_STATE__?.videoData
  if (!videoData) {
    throw new Error('无法获取视频信息')
  }
  const api = new BilibiliApi()
  const playUrlInfo = await api.fetchPlayUrls(bvid, parseInt(cid))
  const downloadFile = async function (url: string, filename: string) {
    const utils = new DownloadUtils()
    const blob = await utils.downloadToBlob(url)
    utils.saveBlob(blob, filename)
  }
  switch (downloadType) {
    case 'VIDEO_AUDIO':
      await downloadFile(playUrlInfo.videoUrl, `${videoData.title}.video.mp4`)
      await downloadFile(playUrlInfo.audioUrl, `${videoData.title}.audio.m4a`)
      return { success: true, message: '视频和音频下载完成' }
    case 'AUDIO_ONLY':
      await downloadFile(playUrlInfo.audioUrl, `${videoData.title}.audio.m4a`)
      return { success: true, message: '音频下载完成' }
    case 'VIDEO_ONLY':
      await downloadFile(playUrlInfo.videoUrl, `${videoData.title}.video.mp4`)
      return { success: true, message: '视频下载完成' }
    default:
      throw new Error(`不支持的下载类型: ${downloadType}`)
  }
}

function syncVideoInfo(needCheck = true) {
  if (needCheck && !isWindowActivate) return
  const match: VideoData = (window as any).__INITIAL_STATE__?.videoData
  if (!match) {
    console.error('No video data found in window.__INITIAL_STATE__')
    return
  }
  let p = Number(
    new URLSearchParams(window.location.search).get('p') ?? 0
  )
  match.p = p
  window.postMessage({
    source: PageType.VIDEO_PAGE_INJECT,
    type: PageEventType.VIDEO_INFO_INIT,
    payload: match,
  })
}

function injectGenerateButton() {
  if (document.getElementById('bili-plus-generate-btn')) return

  const btn = document.createElement('button')
  btn.id = 'bili-plus-generate-btn'
  btn.textContent = '生成字幕/总结'
  btn.style.position = 'fixed'
  btn.style.bottom = '20px'
  btn.style.right = '20px'
  btn.style.zIndex = '9999'
  btn.style.padding = '8px 16px'
  btn.style.backgroundColor = '#fb7299'
  btn.style.color = 'white'
  btn.style.border = 'none'
  btn.style.borderRadius = '4px'
  btn.style.cursor = 'pointer'

  btn.addEventListener('click', () => {
    window.postMessage({
      source: PageType.VIDEO_PAGE_INJECT,
      type: PageEventType.REQUEST_OPEN_SIDE_PANEL,
    })
  })

  document.body.appendChild(btn)
}

function initButtonInjection() {
  injectGenerateButton()
  const observer = new MutationObserver(() => {
    injectGenerateButton()
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

main()
