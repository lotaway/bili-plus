import { SubtitleFetcher } from '../../services/SubtitleFetcher';
import { AISubtitleHandler } from '../../services/AISubtitleHandler';
import { AIAgentRunner } from '../../services/AIAgentRunner';

class DownloadManager {
  #subtitleFetcher = new SubtitleFetcher();
  #aiSubtitleHandler = new AISubtitleHandler();
  #aiAgentRunner = new AIAgentRunner();
  #pollingCheckTimer: number | null = null;

  constructor() {
    this.setupEventListeners();
    this.initializeStorageCleanup();
    this.startPollingStatusCheck();
  }

  async initializeStorageCleanup() {
    try {
      await this.#subtitleFetcher.cleanupOldStorage();
      const syncBytes = await new Promise<number>((resolve) => {
        chrome.storage.sync.getBytesInUse(null, resolve);
      });
      console.log('Sync storage usage:', syncBytes, 'bytes');

      if (syncBytes > 90000) {
        await this.cleanupSyncStorage();
      }
    } catch (error) {
      console.error('Storage cleanup initialization failed:', error);
    }
  }

  async cleanupSyncStorage() {
    try {
      const allData = await chrome.storage.sync.get(null);
      const keysToRemove: string[] = [];
      for (const [key, value] of Object.entries(allData)) {
        if (value && typeof value === 'object' && (value as any).timestamp) {
          const age = Date.now() - (value as any).timestamp;
          if (age > 7 * 24 * 60 * 60 * 1000) {
            keysToRemove.push(key);
          }
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.sync.remove(keysToRemove);
        console.log(`清理了 ${keysToRemove.length} 个过期的sync存储项`);
      }
    } catch (error) {
      console.error('清理sync存储时出错:', error);
    }
  }

  // 检测popup是否打开
  isPopupOpen(): boolean {
    try {
      const views = chrome.extension.getViews({ type: 'popup' });
      return views.length > 0;
    } catch (error) {
      console.error('检测popup状态失败:', error);
      return false;
    }
  }

  // 检测sidepanel是否打开
  async isSidepanelOpen(): Promise<boolean> {
    try {
      if (chrome.sidePanel) {
        const panel = await chrome.sidePanel.getOptions({});
        return panel.enabled || false;
      }
      return false;
    } catch (error) {
      console.error('检测sidepanel状态失败:', error);
      return false;
    }
  }

  // 启动状态检查定时器
  startPollingStatusCheck(): void {
    // 每10秒检查一次页面状态并控制API检查
    this.#pollingCheckTimer = setInterval(async () => {
      await this.checkAndControlApiStatusCheck();
    }, 10000);
  }

  // 检查页面状态并控制API状态检查
  async checkAndControlApiStatusCheck(): Promise<void> {
    const popupOpen = this.isPopupOpen();
    const sidepanelOpen = await this.isSidepanelOpen();
    const shouldCheckApi = popupOpen || sidepanelOpen;

    if (shouldCheckApi) {
      // 如果页面打开且API检查未启动，则启动
      if (!this.#aiSubtitleHandler.isApiStatusCheckRunning()) {
        this.#aiSubtitleHandler.initializeApiStatusCheck();
        console.log('启动API状态检查（popup或sidepanel已打开）');
      }
    } else {
      // 如果页面关闭且API检查正在运行，则停止
      if (this.#aiSubtitleHandler.isApiStatusCheckRunning()) {
        this.#aiSubtitleHandler.stopApiStatusCheck();
        console.log('停止API状态检查（popup和sidepanel都已关闭）');
      }
    }
  }

  setupEventListeners() {
    chrome.downloads.onChanged.addListener(this.onDownloadChanged.bind(this));
    chrome.downloads.onCreated.addListener(this.onDownloadCreated.bind(this));
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // 监听扩展视图变化（popup打开/关闭）
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'popup') {
        port.onDisconnect.addListener(async () => {
          // popup关闭时立即检查状态
          await this.checkAndControlApiStatusCheck();
        });
      }
    });
  }

  onDownloadChanged(args: chrome.downloads.DownloadDelta) {
    console.debug(`Download changed: ${JSON.stringify(args)}`);
  }

  onDownloadCreated(args: chrome.downloads.DownloadItem) {
    console.debug(`Download created: ${JSON.stringify(args)}`);
  }

  checkVideoInfo() {
    if (!this.#subtitleFetcher.cid || !this.#subtitleFetcher.aid) {
      let msg = '视频信息获取失败，请刷新页面重试';
      if (!this.#subtitleFetcher.isInit) {
        msg = 'content.js maybe not trigger';
      }
      return {
        isOk: false,
        error: msg,
      };
    }
    return {
      isOk: true,
    };
  }

  handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    switch (message.type) {
      case 'fetchSubtitles': {
        const preResult = this.checkVideoInfo();
        if (preResult?.error) {
          sendResponse(preResult);
          return true;
        }
        this.#subtitleFetcher
          .fetchSubtitlesHandler(message.payload)
          .then((subtitleResult) => {
            sendResponse({
              data: subtitleResult,
              bvid: this.#subtitleFetcher.bvid,
              cid: this.#subtitleFetcher.cid,
            });
          })
          .catch((error) => {
            console.error(error);
            sendResponse({
              error:
                error instanceof Error ? error.message : JSON.stringify(error),
            });
          });
        return true;
      }
      case 'summarize': {
        const preResult = this.checkVideoInfo();
        if (preResult?.error) {
          sendResponse(preResult);
          return true;
        }
        const bvid = this.#subtitleFetcher.bvid;
        const cid = this.#subtitleFetcher.cid;
        const EVENT_TYPE = 'summarize:keepAlive';
        this.#aiSubtitleHandler
          .summarizeSubtitlesHandler(this.#subtitleFetcher, (chunk) => {
            if (sender.id) {
                chrome.runtime.sendMessage(sender.id, {
                type: EVENT_TYPE,
                data: {
                    content: chunk,
                    bvid,
                    cid,
                    done: false,
                },
                });
            }
          })
          .then((summaryResult) => {
            if (sender.id) {
                chrome.runtime.sendMessage(sender.id, {
                type: EVENT_TYPE,
                data: {
                    ...summaryResult,
                    bvid,
                    cid,
                    done: true,
                },
                });
            }
            sendResponse({ done: true });
          })
          .catch((error) => {
            console.error(error);
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
                },
                });
            }
            sendResponse({ done: true });
          });
        return true;
      }
      case 'VideoInfoUpdate':
        this.#subtitleFetcher.init(message.payload);
        break;
      case 'openSidePanel':
        if (sender.tab?.windowId) {
            chrome.sidePanel.open({ windowId: sender.tab.windowId });
        }
        break;
      case 'startAssistant': {
        const EVENT_TYPE = 'assistant:keepAlive';
        this.#aiAgentRunner
          .runAgent(message.payload, (content, metadata) => {
            if (sender.id) {
                chrome.runtime.sendMessage(sender.id, {
                type: EVENT_TYPE,
                data: {
                    content: content,
                    metadata: metadata,
                    done: false,
                },
                });
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
                });
            }
            sendResponse({ done: true });
          })
          .catch((error) => {
            console.error(error);
            if (sender.id) {
                chrome.runtime.sendMessage(sender.id, {
                type: EVENT_TYPE,
                data: {
                    error:
                    error instanceof Error
                        ? error.message
                        : JSON.stringify(error),
                },
                });
            }
            sendResponse({ done: true });
          });
        return true;
      }

      case 'stopAssistant': {
        this.#aiAgentRunner.stopAgent().then((stopped) => {
            sendResponse({
                stopped: stopped,
                message: stopped ? 'AI智能体已停止' : '没有正在运行的AI智能体',
            });
        });
        return true;
      }

      default:
        break;
    }
  }
}

new DownloadManager();
