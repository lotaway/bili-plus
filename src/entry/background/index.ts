import { SubtitleFetcher } from '../../services/SubtitleFetcher'
import { AISubtitleHandler, LLM_Runner } from '../../services/LLM_Runner'
import { AIAgentRunner } from '../../services/AIAgentRunner'
import { StorageCleanupService } from '../../services/StorageCleanupService'
import { StatusCheckService } from '../../services/StatusCheckService'
import { DownloadUtils } from '../../utils/DownloadUtils'
import { VideoInfoUtils } from '../../utils/VideoInfoUtils'
import { MessageType } from '../../enums/MessageType'
import { SummarizeErrorResponse, SummarizeSuccessResponse } from '../../types/summarize'
import { VideoData } from '../../types/video'
import { BilibiliApi } from '../../services/BilibiliApi'
import { DownloadType } from '../../enums/DownloadType'
import { FFmpegUtils } from '../../utils/FFmpegUtils'

class DownloadManager {
  private readonly bilibiliApi = new BilibiliApi()
  private readonly subtitleFetcher = new SubtitleFetcher(this.bilibiliApi);
  private readonly llmRunner = new LLM_Runner();
  private readonly aiSubtitleHandler = new AISubtitleHandler(this.llmRunner);
  private readonly aiAgentRunner = new AIAgentRunner(this.llmRunner);
  private readonly storageCleanupService = new StorageCleanupService();
  private readonly statusCheckService = new StatusCheckService(this.llmRunner);
  private readonly downloadUtils = new DownloadUtils();
  private readonly videoInfoUtils = new VideoInfoUtils(this.subtitleFetcher);
  private readonly ffmpegUtils = new FFmpegUtils();
  private readonly registedContentJss = new Map<string, boolean>()
  private readonly registerMaxSize = 10

  constructor() {
    this.setupEventListeners()
    this.statusCheckService.startPollingStatusCheck()
  }

  async init() {
    await this.llmRunner.init()
    await this.storageCleanupService.initializeStorageCleanup()
  }

  setupEventListeners() {
    chrome.downloads.onChanged.addListener(this.onDownloadChanged.bind(this))
    chrome.downloads.onCreated.addListener(this.onDownloadCreated.bind(this))
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'popup') {
        port.onDisconnect.addListener(async () => {
          await this.statusCheckService.checkAndControlApiStatusCheck()
        })
      }
    })
  }

  onDownloadChanged(args: chrome.downloads.DownloadDelta) {
    // console.debug(`Download changed: ${JSON.stringify(args)}`)
  }

  onDownloadCreated(args: chrome.downloads.DownloadItem) {
    // console.debug(`Download created: ${JSON.stringify(args)}`)
  }

  async handleFetchSubtitle(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    const preResult = this.videoInfoUtils.checkVideoInfo()
    if (preResult?.error) {
      sendResponse(preResult)
      return
    }

    this.subtitleFetcher
      .fetchSubtitlesHandler(message.payload)
      .then((subtitleResult) => {
        sendResponse({
          data: subtitleResult,
          bvid: this.subtitleFetcher.bvid,
          cid: this.subtitleFetcher.cid,
        })
      })
      .catch((error) => {
        console.error(error)
        sendResponse({
          error: error instanceof Error ? error.message : JSON.stringify(error),
        })
      })
  }

  handleRegisterContentJs(sender: chrome.runtime.MessageSender): boolean | void {
    if (this.registedContentJss.size > this.registerMaxSize - 1) {
      this.registedContentJss.delete(this.registedContentJss.keys().next().value as string)
    }
    this.registedContentJss.set(sender.id as string, true)
  }

  async handleSummarize(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    const isRegisted = this.registedContentJss.get(sender.id as string)
    if (!isRegisted) {
      sendResponse({
        error: 'content.js maybe not registed, please try refresh the page',
      })
      return
    }

    const preResult = this.videoInfoUtils.checkVideoInfo()
    if (preResult?.error) {
      sendResponse(preResult)
      return
    }

    const bvid = this.subtitleFetcher.bvid
    const cid = this.subtitleFetcher.cid
    const EVENT_TYPE = MessageType.SUMMARIZE_SUBTITLE_RESPONSE_STREAM

    this.aiSubtitleHandler
      .summarizeSubtitlesHandler(this.subtitleFetcher, (chunk) => {
        if (!sender.id) return
        chrome.runtime.sendMessage(sender.id, {
          type: EVENT_TYPE,
          data: {
            content: chunk,
            bvid,
            cid,
            done: false,
          } as SummarizeSuccessResponse,
        })
      })
      .then((summaryResult) => {
        if ('error' in summaryResult) {
          throw new Error(summaryResult.error)
        }

        this.llmRunner.saveDocument({
          title: summaryResult.title,
          bvid,
          cid,
          source: this.subtitleFetcher.getVideoDetailPageUrl().toString(),
          content: summaryResult.data.content,
        })
          .then(() => console.log('总结内容已保存到数据库'))
          .catch(saveError => console.error('保存总结内容失败:', saveError))

        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              think: summaryResult.data.think,
              content: summaryResult.data.content,
              bvid,
              cid,
              done: true,
            } as SummarizeSuccessResponse,
          })
        }
        sendResponse({ done: true })
      })
      .catch((error) => {
        console.error(error)
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              error: error instanceof Error ? error.message : JSON.stringify(error),
              bvid,
              cid,
            } as SummarizeErrorResponse,
          })
        }
        sendResponse({ done: true })
      })
  }

  async handleSummarizeScreenshot(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    const isRegisted = this.registedContentJss.get(sender.id as string)
    if (!isRegisted) {
      sendResponse({
        error: 'content.js maybe not registed, please try refresh the page',
      })
      return
    }

    const screenshotDataUrl = message.payload?.screenshot
    if (!screenshotDataUrl) {
      sendResponse({
        error: '截图数据为空，请重试',
      })
      return
    }

    const EVENT_TYPE = MessageType.SUMMARIZE_SCREENSHOT_RESPONSE_STREAM
    this.llmRunner.analyzeScreenshot(screenshotDataUrl, (chunk) => {
      if (!sender.id) return
      chrome.runtime.sendMessage(sender.id, {
        type: EVENT_TYPE,
        data: {
          content: chunk,
          done: false,
        } as SummarizeSuccessResponse,
      })
    })
      .then((analysisResult) => {
        if ('error' in analysisResult) {
          throw new Error(analysisResult.error)
        }

        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              think: analysisResult.data.think,
              content: analysisResult.data.content,
              done: true,
            } as SummarizeSuccessResponse,
          })
        }
        sendResponse({ done: true })
      })
      .catch((error) => {
        console.error(error)
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              error: error instanceof Error ? error.message : JSON.stringify(error),
            } as SummarizeErrorResponse,
          })
        }
        sendResponse({ done: true })
      })
  }

  handleVideoInfoUpdate(message: any): boolean | void {
    this.subtitleFetcher.init(message.payload as VideoData)
  }

  handleOpenSidePanel(sender: chrome.runtime.MessageSender): boolean | void {
    if (sender.tab?.windowId) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId })
    }
  }

  async handleStartAssistant(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    const EVENT_TYPE = MessageType.ASSISTANT_RESPONSE_STREAM
    this.aiAgentRunner
      .runAgent(message.payload, (content, metadata) => {
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              content: content,
              metadata: metadata,
              done: false,
            },
          })
        }
      })
      .then((summaryResult) => {
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              ...summaryResult,
              done: true,
            },
          })
        }
        sendResponse({ done: true })
      })
      .catch((error) => {
        console.error(error)
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              error: error instanceof Error ? error.message : JSON.stringify(error),
            },
          })
        }
        sendResponse({ done: true })
      })
  }

  async handleStopAssistant(sendResponse: (response?: any) => void) {
    this.aiAgentRunner.stopAgent().then((stopped) => {
      sendResponse({
        stopped: stopped,
        message: stopped ? 'AI智能体已停止' : '没有正在运行的AI智能体',
      })
    })
  }

  async handleVideoInfo(sendResponse: (response?: any) => void) {
    const videoInfo = this.videoInfoUtils.checkVideoInfo()
    if (videoInfo.isOk) {
      sendResponse({
        bvid: this.subtitleFetcher.bvid,
        cid: this.subtitleFetcher.cid,
        aid: this.subtitleFetcher.aid,
        title: await this.subtitleFetcher.getTitle(),
      })
    } else {
      sendResponse({ error: videoInfo.error })
    }
  }

  async handleDownloadVideo(message: any, sendResponse: (response?: any) => void) {
    const { bvid, cid, downloadType = DownloadType.VIDEO_ONLY, useChromeAPI = false } = message.payload
    if (!bvid || !cid) {
      sendResponse({ error: '缺少BVID或CID参数' })
      return
    }

    try {
      const { videoUrl, audioUrl, title } = await this.bilibiliApi.fetchPlayUrls(bvid, parseInt(cid))

      switch (downloadType) {
        case DownloadType.AUDIO_ONLY:
          if (useChromeAPI) {
            await this.downloadUtils.downloadWithChromeAPI(audioUrl, `${title}.audio.m4a`)
          } else {
            const audioBlob = await this.downloadUtils.downloadToBlob(audioUrl)
            this.downloadUtils.saveBlob(audioBlob, `${title}.audio.m4a`)
          }
          break

        case DownloadType.VIDEO_ONLY:
          if (useChromeAPI) {
            await this.downloadUtils.downloadWithChromeAPI(videoUrl, `${title}.video.mp4`)
          } else {
            const videoBlob = await this.downloadUtils.downloadToBlob(videoUrl)
            this.downloadUtils.saveBlob(videoBlob, `${title}.video.mp4`)
          }
          break

        case DownloadType.VIDEO_AUDIO:
          if (useChromeAPI) {
            await Promise.all([
              this.downloadUtils.downloadWithChromeAPI(videoUrl, `${title}.video.mp4`),
              this.downloadUtils.downloadWithChromeAPI(audioUrl, `${title}.audio.m4a`)
            ])
          } else {
            const [videoBlob, audioBlob] = await Promise.all([
              this.downloadUtils.downloadToBlob(videoUrl),
              this.downloadUtils.downloadToBlob(audioUrl)
            ])
            this.downloadUtils.saveBlob(videoBlob, `${title}.video.mp4`)
            this.downloadUtils.saveBlob(audioBlob, `${title}.audio.m4a`)
          }
          break

        case DownloadType.MERGED:
          try {
            const [videoBlob, audioBlob] = await Promise.all([
              this.downloadUtils.downloadToBlob(videoUrl),
              this.downloadUtils.downloadToBlob(audioUrl)
            ])
            const mergedBlob = await this.mergeVideoAudioWithFFmpeg(videoBlob, audioBlob)
            if (useChromeAPI) {
              const mergedUrl = URL.createObjectURL(mergedBlob)
              await this.downloadUtils.downloadWithChromeAPI(mergedUrl, `${title}.mp4`)
              URL.revokeObjectURL(mergedUrl)
            } else {
              this.downloadUtils.saveBlob(mergedBlob, `${title}.mp4`)
            }
          } catch (mergeError) {
            console.error('合并失败，回退到分别下载:', mergeError)
            if (useChromeAPI) {
              await Promise.all([
                this.downloadUtils.downloadWithChromeAPI(videoUrl, `${title}.video.mp4`),
                this.downloadUtils.downloadWithChromeAPI(audioUrl, `${title}.audio.m4a`)
              ])
            } else {
              const [videoBlob, audioBlob] = await Promise.all([
                this.downloadUtils.downloadToBlob(videoUrl),
                this.downloadUtils.downloadToBlob(audioUrl)
              ])
              this.downloadUtils.saveBlob(videoBlob, `${title}.video.mp4`)
              this.downloadUtils.saveBlob(audioBlob, `${title}.audio.m4a`)
            }
            sendResponse({
              success: true,
              message: '合并失败，已分别下载视频和音频文件。请手动使用ffmpeg合并。'
            })
            return
          }
          break

        default:
          throw new Error(`不支持的下载类型: ${downloadType}`)
      }

      sendResponse({ success: true, message: '下载完成' })
    } catch (error) {
      sendResponse({ error: error instanceof Error ? error.message : '下载失败' })
    }
  }

  private async mergeVideoAudioWithFFmpeg(videoBlob: Blob, audioBlob: Blob): Promise<Blob> {
    try {
      console.log('开始使用FFmpeg合并视频和音频...')
      const mergedBlob = await this.ffmpegUtils.mergeVideoAudio(videoBlob, audioBlob)
      console.log('FFmpeg合并完成')
      return mergedBlob
    } catch (error) {
      console.error('FFmpeg合并失败:', error)
      throw new Error(`视频合并失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    switch (message.type) {
      case MessageType.REQUEST_FETCH_SUBTITLE:
        return this.handleRequestFetchSubtitle(message, sender, sendResponse)
      case MessageType.REGISTER_CONTENT_JS:
        return this.handleRegisterContentJs(sender)
      case MessageType.REQUEST_SUMMARIZE_SUBTITLE:
        return this.handleRequestSummarizeSubtitle(message, sender, sendResponse)
      case MessageType.REQUEST_SUMMARIZE_SCREENSHOT:
        return this.handleRequestSummarizeScreenshot(message, sender, sendResponse)
      case MessageType.VIDEO_INFO_UPDATE:
        return this.handleVideoInfoUpdate(message)
      case MessageType.OPEN_SIDE_PANEL:
        return this.handleOpenSidePanel(sender)
      case MessageType.REQUEST_START_ASSISTANT:
        return this.handleRequestStartAssistant(message, sender, sendResponse)
      case MessageType.REQUEST_STOP_ASSISTANT:
        return this.handleRequestStopAssistant(sendResponse)
      case MessageType.REQUEST_VIDEO_INFO:
        return this.handleRequestVideoInfo(sendResponse)
      case MessageType.REQUEST_DOWNLOAD_VIDEO_IN_BG:
        return this.handleRequestDownloadVideo(message, sendResponse)
      default:
        break
    }
  }

  private handleRequestFetchSubtitle(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean | void {
    const preResult = this.videoInfoUtils.checkVideoInfo()
    if (preResult?.error) {
      sendResponse(preResult)
      return true
    }
    this.subtitleFetcher
      .fetchSubtitlesHandler(message.payload)
      .then((subtitleResult) => {
        sendResponse({
          data: subtitleResult,
          bvid: this.subtitleFetcher.bvid,
          cid: this.subtitleFetcher.cid,
        })
      })
      .catch((error) => {
        console.error(error)
        sendResponse({
          error:
            error instanceof Error ? error.message : JSON.stringify(error),
        })
      })
    return true
  }

  private handleRequestSummarizeSubtitle(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean | void {
    const isRegisted = this.registedContentJss.get(sender.id as string)
    if (!isRegisted) {
      sendResponse({
        error: 'content.js maybe not registed, please try refresh the page',
      })
      return true
    }
    const preResult = this.videoInfoUtils.checkVideoInfo()
    if (preResult?.error) {
      sendResponse(preResult)
      return true
    }
    const bvid = this.subtitleFetcher.bvid
    const cid = this.subtitleFetcher.cid
    const EVENT_TYPE = MessageType.SUMMARIZE_SUBTITLE_RESPONSE_STREAM
    this.aiSubtitleHandler
      .summarizeSubtitlesHandler(this.subtitleFetcher, (chunk) => {
        if (!sender.id) {
          return
        }
        chrome.runtime.sendMessage(sender.id, {
          type: EVENT_TYPE,
          data: {
            content: chunk,
            bvid,
            cid,
            done: false,
          } as SummarizeSuccessResponse,
        })
      })
      .then((summaryResult) => {
        if ('error' in summaryResult) {
          throw new Error(summaryResult.error)
        }
        this.llmRunner.saveDocument({
          title: summaryResult.title,
          bvid,
          cid,
          source: this.subtitleFetcher.getVideoDetailPageUrl().toString(),
          content: summaryResult.data.content,
        })
          .then(() =>
            console.log('总结内容已保存到数据库'))
          .catch(saveError => {
            console.error('保存总结内容失败:', saveError)
          })

        if (!sender.id) {
          return null
        }
        return chrome.runtime.sendMessage(sender.id, {
          type: EVENT_TYPE,
          data: {
            think: summaryResult.data.think,
            content: summaryResult.data.content,
            bvid,
            cid,
            done: true,
          } as SummarizeSuccessResponse,
        })
      })
      .then(() => sendResponse({ done: true }))
      .catch((error) => {
        console.error(error)
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              error:
                error instanceof Error ? error.message : JSON.stringify(error),
              bvid,
              cid,
            } as SummarizeErrorResponse,
          })
        }
        sendResponse({ done: true })
      })
    return true
  }

  private handleRequestSummarizeScreenshot(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean | void {
    const isRegisted = this.registedContentJss.get(sender.id as string)
    if (!isRegisted) {
      sendResponse({
        error: 'content.js maybe not registed, please try refresh the page',
      })
      return true
    }

    const screenshotDataUrl = message.payload?.screenshot
    if (!screenshotDataUrl) {
      sendResponse({
        error: '截图数据为空，请重试',
      })
      return true
    }

    const EVENT_TYPE = MessageType.SUMMARIZE_SCREENSHOT_RESPONSE_STREAM
    this.llmRunner.analyzeScreenshot(screenshotDataUrl, (chunk) => {
      if (!sender.id) {
        return
      }
      chrome.runtime.sendMessage(sender.id, {
        type: EVENT_TYPE,
        data: {
          content: chunk,
          done: false,
        } as SummarizeSuccessResponse,
      })
    })
      .then((analysisResult) => {
        if ('error' in analysisResult) {
          throw new Error(analysisResult.error)
        }
        // this.llmRunner.saveDocument({
        //   title: '界面截图分析',
        //   bvid: 'screenshot',
        //   cid: Date.now(),
        //   source: 'screenshot_analysis',
        //   content: analysisResult.data.content,
        // })
        //   .then(() =>
        //     console.log('截图分析内容已保存到数据库'))
        //   .catch(saveError => {
        //     console.error('保存截图分析内容失败:', saveError)
        //   })

        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              think: analysisResult.data.think,
              content: analysisResult.data.content,
              done: true,
            } as SummarizeSuccessResponse,
          })
        }
        sendResponse({ done: true })
      })
      .catch((error) => {
        console.error(error)
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              error:
                error instanceof Error ? error.message : JSON.stringify(error),
            } as SummarizeErrorResponse,
          })
        }
        sendResponse({ done: true })
      })
    return true
  }

  private handleRequestStartAssistant(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean | void {
    const EVENT_TYPE = MessageType.ASSISTANT_RESPONSE_STREAM
    this.aiAgentRunner
      .runAgent(message.payload, (content, metadata) => {
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              content: content,
              metadata: metadata,
              done: false,
            },
          })
        }
      })
      .then((summaryResult) => {
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              ...summaryResult,
              done: true,
            },
          })
        }
        sendResponse({ done: true })
      })
      .catch((error) => {
        console.error(error)
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: EVENT_TYPE,
            data: {
              error:
                error instanceof Error ? error.message : JSON.stringify(error),
            },
          })
        }
        sendResponse({ done: true })
      })
    return true
  }

  private handleRequestStopAssistant(sendResponse: (response?: any) => void): boolean | void {
    this.aiAgentRunner.stopAgent().then((stopped) => {
      sendResponse({
        stopped: stopped,
        message: stopped ? 'AI智能体已停止' : '没有正在运行的AI智能体',
      })
    })
    return true
  }

  private handleRequestVideoInfo(sendResponse: (response?: any) => void): boolean | void {
    const videoInfo = this.videoInfoUtils.checkVideoInfo()
    if (videoInfo.isOk) {
      this.subtitleFetcher.getTitle().then(title => {
        sendResponse({
          bvid: this.subtitleFetcher.bvid,
          cid: this.subtitleFetcher.cid,
          aid: this.subtitleFetcher.aid,
          title,
        })
      }).catch(error => {
        sendResponse({ error: new Error(`Get title failed: ${error}`) })
      })
    } else {
      sendResponse({ error: videoInfo.error })
    }
    return true
  }

  private handleRequestDownloadVideo(message: any, sendResponse: (response?: any) => void): boolean | void {
    const { bvid, cid } = message.payload
    if (!bvid || !cid) {
      sendResponse({ error: '缺少BVID或CID参数' })
      return true
    }
    this.bilibiliApi.fetchPlayUrls(bvid, parseInt(cid))
      .then(data => {
        const { videoUrl, audioUrl, title } = data
        return Promise.all([
          this.downloadUtils.downloadWithChromeAPI(videoUrl, `${title}.video.mp4`),
          this.downloadUtils.downloadWithChromeAPI(audioUrl, `${title}.audio.m4a`)
        ])
      })
      .then(() => {
        sendResponse({ success: true, message: '下载完成' })
      })
      .catch(error => {
        sendResponse({ error: error instanceof Error ? error.message : '下载失败' })
      })
    return true
  }
}

new DownloadManager().init()
