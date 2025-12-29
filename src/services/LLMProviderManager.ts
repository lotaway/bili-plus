import {
  LLMProviderConfig,
  LLMProvidersConfig,
  ModelInfo,
  VersionInfo,
} from '../types/llm-provider'
import {
  getLLMProvidersConfig,
  getSelectedProvider,
  selectProvider,
} from './LLMProviderService'
import { LLM_Runner } from './LLM_Runner'

export class LLMProviderManager {
  private apiCheckTimeout: number | null = null;
  private currentProvider: LLMProviderConfig | null = null;
  private _versionInfo: VersionInfo | null = null;
  private _versionInfoFetched = false;
  private _modelList: ModelInfo[] = [];
  private _modelListFetched = false;
  private isBusy = false;
  private llmRunner: LLM_Runner | null = null;

  static defaultModelName() {
    return 'gpt-3.5-turbo'
  }

  get provider(): LLMProviderConfig | null {
    return this.currentProvider
  }

  get apiPrefixWithVersion(): string {
    if (!this.currentProvider) {
      throw new Error('没有选中的LLM provider')
    }
    const version = this._versionInfo?.api_version ?? 'v1'
    return `${this.currentProvider.endpoint}/${version}`
  }

  get versionInfo(): VersionInfo | null {
    return this._versionInfo
  }

  get modelList(): ModelInfo[] {
    return [...this._modelList]
  }

  async init(): Promise<{ isOk: boolean; error?: Error }> {
    try {
      await this.syncCurrentProvider()
      return { isOk: true }
    } catch (error) {
      console.error('LLMProviderManager初始化失败:', error)
      return {
        isOk: false,
        error: error instanceof Error ? error : new Error('初始化失败')
      }
    }
  }

  async syncCurrentProvider(): Promise<void> {
    const provider = await getSelectedProvider()
    this.currentProvider = provider
    await this.updateLLMRunner()

    if (provider) {
      console.log(`当前选中的LLM provider: ${provider.name} (${provider.id})`)
    } else {
      console.warn('没有可用的LLM provider，请先配置')
    }
  }

  private async updateLLMRunner(): Promise<void> {
    if (!this.currentProvider) {
      this.llmRunner = null
      return
    }

    const runnerConfig = {
      aiProvider: this.currentProvider.type,
      aiEndpoint: this.currentProvider.endpoint,
      aiKey: this.currentProvider.apiKey,
      aiModel: this.currentProvider.defaultModel,
    }

    if (!this.llmRunner) {
      this.llmRunner = new LLM_Runner()
    }

    await chrome.storage.sync.set(runnerConfig)
    await this.llmRunner.syncConfig()
  }

  async switchProvider(providerId: string): Promise<boolean> {
    const success = await selectProvider(providerId)
    if (success) {
      await this.syncCurrentProvider()
      this._versionInfoFetched = false
      this._modelListFetched = false
      this._versionInfo = null
      this._modelList = []
    }
    return success
  }

  initializeApiStatusCheck() {
    if (this.apiCheckTimeout) {
      clearTimeout(this.apiCheckTimeout)
    }
    this.scheduleApiCheck()
  }

  stopApiStatusCheck() {
    if (this.apiCheckTimeout) {
      clearTimeout(this.apiCheckTimeout)
      this.apiCheckTimeout = null
    }
  }

  isApiStatusCheckRunning(): boolean {
    return this.apiCheckTimeout !== null
  }

  private scheduleApiCheck() {
    this.apiCheckTimeout = setTimeout(() => {
      this.checkApiStatus()
    }, 60 * 1000) as unknown as number
  }

  private async checkApiStatus() {
    if (!this.currentProvider || !this.llmRunner) {
      console.warn('没有选中的LLM provider，跳过API状态检查')
      this.scheduleApiCheck()
      return
    }

    try {
      const result = await this.llmRunner.checkApiStatusNow()

      if ('error' in result) {
        console.error(`API状态检查失败 (${this.currentProvider.name}):`, result.error)
        await chrome.storage.local.set({
          apiStatus: {
            ok: false,
            lastChecked: new Date().toLocaleString(),
            message: `API检查失败: ${result.error}`
          }
        })
      } else {
        console.log(`API状态检查 (${this.currentProvider.name}): ${result.ok ? '正常' : '异常'}`)
        await chrome.storage.local.set({
          apiStatus: {
            ok: result.ok,
            lastChecked: new Date().toLocaleString(),
            message: result.message
          }
        })
      }
    } catch (error) {
      console.error(`API状态检查失败 (${this.currentProvider?.name || '未知'}):`, error)
      await chrome.storage.local.set({
        apiStatus: {
          ok: false,
          lastChecked: new Date().toLocaleString(),
          message: `API检查失败: ${error instanceof Error ? error.message : '未知错误'}`
        }
      })
    } finally {
      this.scheduleApiCheck()
    }
  }

  private async fetchVersionInfo() {
    if (!this.currentProvider?.endpoint) {
      return
    }

    try {
      const signal = AbortSignal.timeout(5000)
      const response = await fetch(`${this.currentProvider.endpoint}/api/version`, {
        method: 'GET',
        headers: this.defaultHeaders(false),
        signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const versionData = await response.json() as VersionInfo
      this._versionInfo = versionData
      this._versionInfoFetched = true
      console.log('版本信息获取成功:', versionData)
    } catch (error) {
      console.error('获取版本信息失败:', error)
    }
  }

  async fetchModelList(): Promise<ModelInfo[]> {
    if (!this.currentProvider || !this.llmRunner) {
      return []
    }

    try {
      const modelList = await this.llmRunner.fetchModelList()
      this._modelList = modelList
      this._modelListFetched = true
      return modelList
    } catch (error) {
      console.error('获取模型列表失败:', error)
      return []
    }
  }

  async validateModel(modelName: string): Promise<boolean> {
    const models = await this.getAvailableModels()
    return models.some(model => model.name === modelName)
  }

  defaultHeaders(includeAuth: boolean = true, contentType: string = 'application/json'): Record<string, string> {
    const headers: Record<string, string> = {}

    if (contentType) {
      headers['Content-Type'] = `${contentType}; charset=utf-8`
    }

    if (includeAuth && this.currentProvider?.apiKey) {
      headers['Authorization'] = `Bearer ${this.currentProvider.apiKey}`
    }

    return headers
  }

  get defaultRequestBody() {
    return {
      stream: true,
      enable_rag: false,
    }
  }

  async callLLM(
    messages: { role: string; content: string }[],
    options: {
      temperature?: number
      stream?: boolean
      onProgress?: (chunk: string) => void
    } = {}
  ) {
    if (!this.currentProvider || !this.llmRunner) {
      return { error: '请先配置并选择LLM provider' }
    }

    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' }
    }

    this.isBusy = true
    try {
      return await this.llmRunner.callLLM(messages, {
        temperature: options.temperature,
        stream: options.stream,
        onProgress: options.onProgress
      })
    } finally {
      this.isBusy = false
    }
  }

  async analyzeScreenshot(
    screenshotDataUrl: string,
    onProgress?: (chunk: string) => void
  ) {
    if (!this.currentProvider || !this.llmRunner) {
      return { error: '请先配置并选择LLM provider' }
    }

    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' }
    }

    this.isBusy = true
    try {
      return await this.llmRunner.analyzeScreenshot(screenshotDataUrl, onProgress)
    } finally {
      this.isBusy = false
    }
  }

  async saveDocument(importDocumentData: any) {
    console.log('保存文档:', importDocumentData)
    return { success: true }
  }

  async getConfig(): Promise<LLMProvidersConfig> {
    return await getLLMProvidersConfig()
  }

  async getAvailableModels(providerId?: string): Promise<ModelInfo[]> {
    if (providerId && this.currentProvider?.id !== providerId) {
      const success = await this.switchProvider(providerId)
      if (!success) {
        console.error(`无法切换到provider: ${providerId}`)
        return []
      }
    }

    if (!this._modelListFetched) {
      await this.fetchModelList()
    }
    return this.modelList
  }

  async fetchModelListForProvider(provider: LLMProviderConfig): Promise<ModelInfo[]> {
    if (!provider.endpoint) {
      console.error('Provider配置不完整，无法获取模型列表')
      return []
    }
    return await LLM_Runner.fetchModelListForEndpoint(provider.endpoint)
  }

  async saveConfig(config: LLMProvidersConfig): Promise<boolean> {
    try {
      await chrome.storage.sync.set({
        llmProviders: config.providers,
        currentLLMProviderId: config.selectedProviderId
      })

      await this.syncCurrentProvider()
      return true
    } catch (error) {
      console.error('保存配置失败:', error)
      return false
    }
  }

  async getCurrentProviderConfig(): Promise<LLMProviderConfig | null> {
    return this.currentProvider
  }
}