/**
 * 状态检查服务
 * 使用LLMProviderManager进行API状态检查和模型列表缓存
 */

import Logger from '../utils/Logger'
import { LLMProviderManager } from './LLMProviderManager'

export class StatusCheckService {
  private pollingCheckTimer: number | null = null;
  private _lastModelListFetchTime: number = 0;
  private readonly MODEL_LIST_CACHE_DURATION = 5 * 60 * 1000;

  constructor(private readonly llmProviderManager: LLMProviderManager) { }

  isPopupOpen(): boolean {
    try {
      const views = chrome.extension.getViews?.({ type: 'popup' }) ?? ((chrome.extension as any).ViewType.POPUP === 'popup' ? new Array(1) : [])
      return views.length > 0
    } catch (error) {
      Logger.E('检测popup状态失败:', error)
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
      Logger.E('检测sidepanel状态失败:', error)
      return false
    }
  }

  startPollingStatusCheck(): void {
    this.pollingCheckTimer = setInterval(async () => {
      await this.checkAndControlApiStatusCheck()
    }, 10 * 1000) as unknown as number
  }

  stopPollingStatusCheck(): void {
    if (this.pollingCheckTimer !== null) {
      clearInterval(this.pollingCheckTimer)
      this.pollingCheckTimer = null
      Logger.D('停止状态检查定时器')
    }
  }

  async checkAndControlApiStatusCheck(): Promise<void> {
    const popupOpen = this.isPopupOpen()
    const sidepanelOpen = await this.isSidepanelOpen()
    const shouldCheckApi = popupOpen || sidepanelOpen

    if (shouldCheckApi) {
      if (!this.llmProviderManager.isApiStatusCheckRunning()) {
        this.llmProviderManager.initializeApiStatusCheck()
        Logger.D('启动API状态检查（popup或sidepanel已打开）')

        // API状态检查启动后，获取模型列表
        await this.fetchAndCacheModelList()
      }
    } else {
      if (this.llmProviderManager.isApiStatusCheckRunning()) {
        this.llmProviderManager.stopApiStatusCheck()
        Logger.D('停止API状态检查（popup和sidepanel都已关闭）')
      }
    }
  }

  private async fetchAndCacheModelList(): Promise<void> {
    const now = Date.now()
    // 检查缓存是否过期
    if (now - this._lastModelListFetchTime < this.MODEL_LIST_CACHE_DURATION) {
      return
    }

    try {
      await this.llmProviderManager.init()
      const models = await this.llmProviderManager.getAvailableModels()

      if (models.length > 0) {
        // 缓存模型列表到本地存储
        await chrome.storage.local.set({
          modelList: {
            models,
            lastUpdated: now,
            source: 'background_polling',
          },
        })
        this._lastModelListFetchTime = now
      }
    } catch (error) {
      Logger.E('后台获取模型列表失败:', error)
    }
  }
}