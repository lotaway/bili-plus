import { PageType } from '../../enums/PageType'
import { VideoData } from '../../types/video'
import { RequestPageEventType } from '../../enums/PageEventType'
import { BilibiliApi } from '../../services/BilibiliApi'
import { DownloadUtils } from '../../utils/DownloadUtils'
import { DownloadType } from '../../enums/DownloadType'
import { FFmpegUtils } from '../../utils/FFmpegUtils'

let isWindowActivate = true

export { }

class VideoPageInjectActivity {
  private ffmpegUtils?: FFmpegUtils

  init() {
    this.syncVideoInfo()
    const timer = setInterval(() => {
      this.syncVideoInfo()
    }, 5 * 1000)
    document.addEventListener('visibilitychange', () => {
      isWindowActivate = document.visibilityState === 'visible'
      this.syncVideoInfo()
    })
    window.addEventListener('unload', () => {
      clearInterval(timer)
    })
    this.initButtonInjection()
    window.addEventListener('message', this.handleWindowMessage.bind(this))
  }

  initButtonInjection() {
    this.injectGenerateButton()
    const observer = new MutationObserver(() => {
      this.injectGenerateButton()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  injectGenerateButton() {
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
        type: RequestPageEventType.REQUEST_OPEN_SIDE_PANEL,
      })
    })

    document.body.appendChild(btn)
  }

  async handleWindowMessage(event: MessageEvent) {
    if (event.source !== window) {
      return
    }
    switch (event.data?.type) {
      case RequestPageEventType.REQUEST_DOWNLOAD_VIDEO_IN_PAGE:
        return this.handleREquestVideoDownloadInPage(event)
    }
  }

  async handleREquestVideoDownloadInPage(event: MessageEvent) {
    if (event.data?.source !== PageType.CONTENT_SCRIPT || event.data?.type !== RequestPageEventType.REQUEST_DOWNLOAD_VIDEO_IN_PAGE) {
      return
    }
    const { bvid, cid, downloadType } = event.data.payload
    try {
      const result = await this.startVideoDownload(bvid, cid, downloadType)

      window.postMessage({
        source: PageType.VIDEO_PAGE_INJECT,
        type: RequestPageEventType.REQUEST_DOWNLOAD_VIDEO_IN_PAGE,
        payload: result
      }, '*')
    } catch (error) {
      window.postMessage({
        source: PageType.VIDEO_PAGE_INJECT,
        type: RequestPageEventType.REQUEST_DOWNLOAD_VIDEO_IN_PAGE,
        payload: {
          error: error instanceof Error ? error.message : String(error ?? '下载失败')
        }
      }, '*')
    }
  }

  async startVideoDownload(bvid: string, cid: string, downloadType: string) {
    const videoData = (window as any).__INITIAL_STATE__?.videoData
    if (!videoData) {
      throw new Error('无法获取视频信息')
    }
    const api = new BilibiliApi()
    const playUrlInfo = await api.fetchPlayUrls(bvid, parseInt(cid))
    const VIDEO_FILE_NAME = `${videoData.title}.video.mp4`
    const AUDIO_FILE_NAME = `${videoData.title}.audio.m4a`
    switch (downloadType) {
      case DownloadType.VIDEO_AUDIO:
        await Promise.all([
          this.downloadFile(playUrlInfo.videoUrl, VIDEO_FILE_NAME),
          this.downloadFile(playUrlInfo.audioUrl, AUDIO_FILE_NAME),
        ])
        return { success: true, message: '视频和音频下载完成' }
      case DownloadType.AUDIO_ONLY:
        await this.downloadFile(playUrlInfo.audioUrl, AUDIO_FILE_NAME)
        return { success: true, message: '音频下载完成' }
      case DownloadType.VIDEO_ONLY:
        await this.downloadFile(playUrlInfo.videoUrl, VIDEO_FILE_NAME)
        return { success: true, message: '视频下载完成' }
      case DownloadType.MERGED:
        const utils = new DownloadUtils()
        const videoBlob = await utils.downloadToBlob(playUrlInfo.videoUrl)
        const audioBlob = await utils.downloadToBlob(playUrlInfo.audioUrl)
        const mergeBlob = await this.mergeVideoAudioWithFFmpeg(videoBlob, audioBlob)
        await utils.saveBlob(mergeBlob, VIDEO_FILE_NAME)
        return { success: true, message: '视频和音频合并完成' }
      default:
        throw new Error(`不支持的下载类型: ${downloadType}`)
    }
  }

  async downloadFile(url: string, filename: string) {
    const utils = new DownloadUtils()
    const blob = await utils.downloadToBlob(url)
    utils.saveBlob(blob, filename)
  }

  initFFmpeg() {
    if (this.ffmpegUtils)
      return this.ffmpegUtils
    this.ffmpegUtils = new FFmpegUtils()
    return this.ffmpegUtils
  }

  async mergeVideoAudioWithFFmpeg(videoBlob: Blob, audioBlob: Blob): Promise<Blob> {
    try {
      console.debug('开始使用FFmpeg合并视频和音频...')
      const mergedBlob = await this.initFFmpeg().mergeVideoAudio(videoBlob, audioBlob)
      console.debug('FFmpeg合并完成')
      return mergedBlob
    } catch (error) {
      console.error('FFmpeg合并失败:', error)
      throw new Error(`视频合并失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  syncVideoInfo(needCheck = true) {
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
      type: RequestPageEventType.VIDEO_INFO_INIT,
      payload: match,
    })
  }

}

console.debug('Start video inject.js')
new VideoPageInjectActivity().init()
console.debug('End video inject.js')