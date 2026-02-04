import { SubtitleFetcher } from '../../services/SubtitleFetcher'
import { LLMProviderManager } from '../../services/LLMProviderManager'
import { AISubtitleHandler } from '../../services/AISubtitleHandler'
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
import Logger from '../../utils/Logger'

class BackstageActivity {
  private readonly bilibiliApi = new BilibiliApi()
  private readonly subtitleFetcher = new SubtitleFetcher(this.bilibiliApi);
  private readonly llmProviderManager = new LLMProviderManager();
  private readonly aiSubtitleHandler = new AISubtitleHandler(this.llmProviderManager);
  private readonly aiAgentRunner = new AIAgentRunner(this.llmProviderManager);
  private readonly storageCleanupService = new StorageCleanupService();
  private readonly statusCheckService = new StatusCheckService(this.llmProviderManager);
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
    await this.llmProviderManager.init()
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

  @Logger.Mark()
  onDownloadChanged(args: chrome.downloads.DownloadDelta) {
  }

  @Logger.Mark()
  onDownloadCreated(args: chrome.downloads.DownloadItem) {
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
        Logger.E('Failed to fetch subtitle:', error)
        sendResponse({
          error: error instanceof Error ? error.message : JSON.stringify(error),
        })
      })
  }

  handleRegisterContentJs(sender: chrome.runtime.MessageSender): boolean | void {
    const id = sender.tab?.id?.toString() || sender.id
    if (!id) return

    if (this.registedContentJss.size > this.registerMaxSize - 1) {
      this.registedContentJss.delete(this.registedContentJss.keys().next().value as string)
    }
    this.registedContentJss.set(id, true)
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
        Logger.E('Failed to start assistant:', error)
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

  async handleDownloadVideo(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    const { bvid, cid, downloadType = DownloadType.VIDEO_ONLY, useChromeAPI = false } = message.payload
    if (!bvid || !cid) {
      sendResponse({ error: 'Missing BVID or CID parameter' })
      return
    }

    try {
      const { videoUrl, audioUrl, title } = await this.bilibiliApi.fetchPlayUrls(bvid, parseInt(cid))

      const createProgressCallback = (fileType: string) => (progress: { loaded: number; total: number }) => {
        if (sender.id) {
          chrome.runtime.sendMessage(sender.id, {
            type: MessageType.DOWNLOAD_PROGRESS_UPDATE,
            data: {
              bvid,
              cid,
              fileType,
              loaded: progress.loaded,
              total: progress.total,
              timestamp: Date.now()
            }
          })
        }
      }

      switch (downloadType) {
        case DownloadType.AUDIO_ONLY:
          if (useChromeAPI) {
            await this.downloadUtils.downloadWithChromeAPI(audioUrl, `${title}.audio.m4a`, createProgressCallback('audio'))
          } else {
            const audioBlob = await this.downloadUtils.downloadToBlob(audioUrl, undefined, createProgressCallback('audio'))
            this.downloadUtils.saveBlob(audioBlob, `${title}.audio.m4a`)
          }
          break

        case DownloadType.VIDEO_ONLY:
          if (useChromeAPI) {
            await this.downloadUtils.downloadWithChromeAPI(videoUrl, `${title}.video.mp4`, createProgressCallback('video'))
          } else {
            const videoBlob = await this.downloadUtils.downloadToBlob(videoUrl, undefined, createProgressCallback('video'))
            this.downloadUtils.saveBlob(videoBlob, `${title}.video.mp4`)
          }
          break

        case DownloadType.VIDEO_AUDIO:
          if (useChromeAPI) {
            await Promise.all([
              this.downloadUtils.downloadWithChromeAPI(videoUrl, `${title}.video.mp4`, createProgressCallback('video')),
              this.downloadUtils.downloadWithChromeAPI(audioUrl, `${title}.audio.m4a`, createProgressCallback('audio'))
            ])
          } else {
            const [videoBlob, audioBlob] = await Promise.all([
              this.downloadUtils.downloadToBlob(videoUrl, undefined, createProgressCallback('video')),
              this.downloadUtils.downloadToBlob(audioUrl, undefined, createProgressCallback('audio'))
            ])
            this.downloadUtils.saveBlob(videoBlob, `${title}.video.mp4`)
            this.downloadUtils.saveBlob(audioBlob, `${title}.audio.m4a`)
          }
          break

        case DownloadType.MERGED:
          try {
            const [videoBlob, audioBlob] = await Promise.all([
              this.downloadUtils.downloadToBlob(videoUrl, undefined, createProgressCallback('video')),
              this.downloadUtils.downloadToBlob(audioUrl, undefined, createProgressCallback('audio'))
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
            Logger.E('Merge failed, falling back to separate downloads:', mergeError)
            if (useChromeAPI) {
              await Promise.all([
                this.downloadUtils.downloadWithChromeAPI(videoUrl, `${title}.video.mp4`, createProgressCallback('video')),
                this.downloadUtils.downloadWithChromeAPI(audioUrl, `${title}.audio.m4a`, createProgressCallback('audio'))
              ])
            } else {
              const [videoBlob, audioBlob] = await Promise.all([
                this.downloadUtils.downloadToBlob(videoUrl, undefined, createProgressCallback('video')),
                this.downloadUtils.downloadToBlob(audioUrl, undefined, createProgressCallback('audio'))
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
          throw new Error(`Unsupported download type: ${downloadType}`)
      }

      sendResponse({ success: true, message: '下载完成' })
    } catch (error) {
      sendResponse({ error: error instanceof Error ? error.message : '下载失败' })
    }
  }

  private async mergeVideoAudioWithFFmpeg(videoBlob: Blob, audioBlob: Blob): Promise<Blob> {
    try {
      Logger.I('Starting FFmpeg video and audio merge...')
      const mergedBlob = await this.ffmpegUtils.mergeVideoAudio(videoBlob, audioBlob)
      Logger.I('FFmpeg merge completed')
      return mergedBlob
    } catch (error) {
      Logger.E('FFmpeg merge failed:', error)
      throw new Error(`Video merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    switch (message.type) {
      case MessageType.REQUEST_FETCH_SUBTITLE:
        return this.handleRequestFetchSubtitle(message, sender, sendResponse)
      case MessageType.REGISTER_CONTENT_JS:
        return this.handleRegisterContentJs(sender)
      case MessageType.REQUEST_SUMMARIZE_SUBTITLE:
        this.handleRequestSummarizeSubtitle(message, sender, sendResponse)
        return true
      case MessageType.REQUEST_SUMMARIZE_SCREENSHOT:
        return this.handleRequestSummarizeScreenshot(message, sender, sendResponse)
      case MessageType.VIDEO_INFO_UPDATE:
        return this.handleVideoInfoUpdate(message)
      case MessageType.OPEN_SIDE_PANEL:
        return this.handleOpenSidePanel(sender)
      case MessageType.REQUEST_START_ASSISTANT:
        this.handleRequestStartAssistant(message, sender, sendResponse)
        return true
      case MessageType.REQUEST_STOP_ASSISTANT:
        return this.handleRequestStopAssistant(sendResponse)
      case MessageType.REQUEST_VIDEO_INFO:
        return this.handleRequestVideoInfo(sendResponse)
      case MessageType.REQUEST_DOWNLOAD_VIDEO_IN_BG:
        this.handleRequestDownloadVideo(message, sendResponse)
        return true
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
        Logger.E('Failed to fetch subtitle:', error)
        sendResponse({
          error:
            error instanceof Error ? error.message : JSON.stringify(error),
        })
      })
    return true
  }

  private async handleRequestSummarizeSubtitle(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): Promise<boolean | void> {
    const id = sender.tab?.id?.toString() || sender.id
    const isRegisted = id ? this.registedContentJss.get(id) : false

    if (!isRegisted && !sender.tab) {
      sendResponse({
        error: 'content.js maybe not registed, please try refresh the page',
      })
      return true
    }

    const { link, bvid: payloadBvid, cid: payloadCid } = message.payload || {}

    try {
      if (link) {
        await this.subtitleFetcher.initByUrl(link)
      } else if (payloadBvid && payloadCid) {
        await this.subtitleFetcher.init({ bvid: payloadBvid, cid: payloadCid } as any)
      }
    } catch (err) {
      Logger.E('Failed to initialize fetcher for summarize:', err)
      sendResponse({ error: 'Failed to initialize video info' })
      return true
    }

    const bvid = this.subtitleFetcher.bvid
    const cid = this.subtitleFetcher.cid
    const EVENT_TYPE = MessageType.SUMMARIZE_SUBTITLE_RESPONSE_STREAM

    this.aiSubtitleHandler
      .summarizeSubtitlesHandler(this.subtitleFetcher, (chunk) => {
        chrome.runtime.sendMessage({
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
        if (summaryResult.data.content)
          this.llmProviderManager.saveDocument({
            title: summaryResult.title,
            bvid,
            cid,
            source: this.subtitleFetcher.getVideoDetailPageUrl().toString(),
            content: summaryResult.data.content,
          })
            .then(() =>
              Logger.D('总结内容已保存到数据库'))
            .catch(saveError => {
              Logger.E('保存总结内容失败:', saveError)
            })

        return chrome.runtime.sendMessage({
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
      .then(() => sendResponse({ success: true, done: true }))
      .catch((error) => {
        Logger.E('Failed to summarize subtitle:', error)
        chrome.runtime.sendMessage({
          type: EVENT_TYPE,
          data: {
            error:
              error instanceof Error ? error.message : JSON.stringify(error),
            bvid,
            cid,
          } as SummarizeErrorResponse,
        })
        sendResponse({ success: false, done: true })
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
    this.llmProviderManager.analyzeScreenshot(screenshotDataUrl, (chunk) => {
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
        //   title: 'Screenshot Analysis',
        //   bvid: 'screenshot',
        //   cid: Date.now(),
        //   source: 'screenshot_analysis',
        //   content: analysisResult.data.content,
        // })
        //   .then(() =>
        //     Logger.I('Screenshot analysis content saved to database'))
        //   .catch(saveError => {
        //     Logger.E('Failed to save screenshot analysis content:', saveError)
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
        Logger.E('Failed to summarize screenshot:', error)
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

  private async handleRequestStartAssistant(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): Promise<boolean | void> {
    const EVENT_TYPE = MessageType.ASSISTANT_RESPONSE_STREAM
    let fullContent = ''
    const tabId = sender.tab?.id

    this.llmProviderManager
      .callLLM([{ role: 'user', content: message.payload.prompt || message.payload.message || '' }], {
        stream: true,
        onProgress: (content, metadata) => {
          fullContent += content
          const response = {
            type: EVENT_TYPE,
            data: {
              content: content,
              metadata: metadata,
              done: false,
            },
          }
          chrome.runtime.sendMessage(response)
          if (tabId) {
            chrome.tabs.sendMessage(tabId, response)
          }
        }
      })
      .then((result) => {
        const resultData = result && 'data' in result ? (result.data as any) : {}
        const response = {
          type: EVENT_TYPE,
          data: {
            ...resultData,
            content: '', // Do not duplicate content in the final message
            done: true,
          },
        }
        chrome.runtime.sendMessage(response)
        if (tabId) {
          chrome.tabs.sendMessage(tabId, response)
        }
        sendResponse({ done: true })
      })
      .catch((error) => {
        Logger.E('Failed to start assistant:', error)
        const response = {
          type: EVENT_TYPE,
          data: {
            error: error instanceof Error ? error.message : JSON.stringify(error),
          },
        }
        chrome.runtime.sendMessage(response)
        if (tabId) {
          chrome.tabs.sendMessage(tabId, response)
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
      sendResponse({ error: 'Missing BVID or CID parameter' })
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

new BackstageActivity().init()
