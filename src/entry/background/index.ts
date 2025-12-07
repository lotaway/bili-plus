import { SubtitleFetcher } from '../../services/SubtitleFetcher'
import { AISubtitleHandler, LLM_Runner } from '../../services/LLM_Runner'
import { AIAgentRunner } from '../../services/AIAgentRunner'
import { MessageType } from '../../enums/MessageType'
import { SummarizeErrorResponse, SummarizeSuccessResponse } from '../../types/summarize'
import { VideoData } from '../../types/video'

class DownloadManager {
  private readonly subtitleFetcher = new SubtitleFetcher();
  private readonly llmRunner = new LLM_Runner();
  private readonly aiSubtitleHandler = new AISubtitleHandler(this.llmRunner);
  private readonly aiAgentRunner = new AIAgentRunner(this.llmRunner);
  #pollingCheckTimer: number | null = null;
  private readonly registedContentJss = new Map<string, boolean>()
  private readonly registerMaxSize = 10

  constructor() {
    this.setupEventListeners()
    this.startPollingStatusCheck()
  }

  async init() {
    await this.llmRunner.init()
    await this.initializeStorageCleanup()
  }

  async initializeStorageCleanup() {
    try {
      await this.subtitleFetcher.cleanupOldStorage()
      const syncBytes = await new Promise<number>((resolve) => {
        chrome.storage.sync.getBytesInUse(null, resolve)
      })
      console.log('Sync storage usage:', syncBytes, 'bytes')

      if (syncBytes > 90000) {
        await this.cleanupSyncStorage()
      }
    } catch (error) {
      console.error('Storage cleanup initialization failed:', error)
    }
  }

  async cleanupSyncStorage() {
    try {
      const allData = await chrome.storage.sync.get(null)
      const keysToRemove: string[] = []
      for (const [key, value] of Object.entries(allData)) {
        if (value && typeof value === 'object' && (value as any).timestamp) {
          const age = Date.now() - (value as any).timestamp
          if (age > 7 * 24 * 60 * 60 * 1000) {
            keysToRemove.push(key)
          }
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.sync.remove(keysToRemove)
        console.log(`清理了 ${keysToRemove.length} 个过期的sync存储项`)
      }
    } catch (error) {
      console.error('清理sync存储时出错:', error)
    }
  }

  isPopupOpen(): boolean {
    try {
      const views = chrome.extension.getViews?.({ type: 'popup' }) ?? ((chrome.extension as any).ViewType.POPUP === 'popup' ? new Array(1) : [])
      return views.length > 0
    } catch (error) {
      console.error('检测popup状态失败:', error)
      return false
    }
  }

  async isSidepanelOpen(): Promise<boolean> {
    try {
      if (chrome.sidePanel) {
        const panel = await chrome.sidePanel.getOptions({})
        return panel.enabled || false
      }
      return false
    } catch (error) {
      console.error('检测sidepanel状态失败:', error)
      return false
    }
  }

  startPollingStatusCheck(): void {
    this.#pollingCheckTimer = setInterval(async () => {
      await this.checkAndControlApiStatusCheck()
    }, 10 * 1000)
  }

  stopPollingStatusCheck(): void {
    if (this.#pollingCheckTimer !== null) {
      clearInterval(this.#pollingCheckTimer)
      this.#pollingCheckTimer = null
      console.debug('停止状态检查定时器')
    }
  }

  async checkAndControlApiStatusCheck(): Promise<void> {
    const popupOpen = this.isPopupOpen()
    const sidepanelOpen = await this.isSidepanelOpen()
    const shouldCheckApi = popupOpen || sidepanelOpen

    if (shouldCheckApi) {
      if (!this.llmRunner.isApiStatusCheckRunning()) {
        this.llmRunner.initializeApiStatusCheck()
        console.debug('启动API状态检查（popup或sidepanel已打开）')
      }
    } else {
      if (this.llmRunner.isApiStatusCheckRunning()) {
        this.llmRunner.stopApiStatusCheck()
        console.debug('停止API状态检查（popup和sidepanel都已关闭）')
      }
    }
  }

  setupEventListeners() {
    chrome.downloads.onChanged.addListener(this.onDownloadChanged.bind(this))
    chrome.downloads.onCreated.addListener(this.onDownloadCreated.bind(this))
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'popup') {
        port.onDisconnect.addListener(async () => {
          await this.checkAndControlApiStatusCheck()
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

  checkVideoInfo() {
    if (!this.subtitleFetcher.cid || !this.subtitleFetcher.aid) {
      let msg = 'Can not get video info, maybe not the target page'
      if (!this.subtitleFetcher.isInit) {
        msg = 'video_page_inject.js maybe not trigger, please try refresh the page'
      }
      return {
        isOk: false,
        error: msg,
      }
    }
    return {
      isOk: true,
    }
  }

  handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    switch (message.type) {
      case MessageType.REQUEST_FETCH_SUBTITLE: {
        const preResult = this.checkVideoInfo()
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
      case MessageType.REGISTER_CONTENT_JS:
        if (this.registedContentJss.size > this.registerMaxSize - 1) {
          this.registedContentJss.delete(this.registedContentJss.keys().next().value as string)
        }
        this.registedContentJss.set(sender.id as string, true)
        break
      case MessageType.REQUEST_SUMMARIZE: {
        const isRegisted = this.registedContentJss.get(sender.id as string)
        if (!isRegisted) {
          sendResponse({
            error: 'content.js maybe not registed, please try refresh the page',
          })
          return true
        }
        const preResult = this.checkVideoInfo()
        if (preResult?.error) {
          sendResponse(preResult)
          return true
        }
        const bvid = this.subtitleFetcher.bvid
        const cid = this.subtitleFetcher.cid
        const EVENT_TYPE = MessageType.SUMMARIZE_RESPONSE_STREAM
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
            this.llmRunner.saveDocument(
              summaryResult.title,
              bvid,
              cid,
              this.subtitleFetcher.getVideoDetailPageUrl().toString(),
              summaryResult.data,
              'md'
            )
              .then(() =>
                console.log('总结内容已保存到数据库'))
              .catch(saveError => {
                console.error('保存总结内容失败:', saveError)
              })

            if (sender.id) {
              chrome.runtime.sendMessage(sender.id, {
                type: EVENT_TYPE,
                data: {
                  content: summaryResult.data,
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
                  error:
                    error instanceof Error
                      ? error.message
                      : JSON.stringify(error),
                  bvid,
                  cid,
                } as SummarizeErrorResponse,
              })
            }
            sendResponse({ done: true })
          })
        return true
      }
      case MessageType.VIDEO_INFO_UPDATE:
        this.subtitleFetcher.init(message.payload as VideoData)
        break
      case MessageType.OPEN_SIDE_PANEL:
        if (sender.tab?.windowId) {
          chrome.sidePanel.open({ windowId: sender.tab.windowId })
        }
        break
      case MessageType.REQUEST_START_ASSISTANT: {
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
                    error instanceof Error
                      ? error.message
                      : JSON.stringify(error),
                },
              })
            }
            sendResponse({ done: true })
          })
        return true
      }

      case MessageType.REQUEST_STOP_ASSISTANT: {
        this.aiAgentRunner.stopAgent().then((stopped) => {
          sendResponse({
            stopped: stopped,
            message: stopped ? 'AI智能体已停止' : '没有正在运行的AI智能体',
          })
        })
        return true
      }

      default:
        break
    }
  }
}

new DownloadManager().init()