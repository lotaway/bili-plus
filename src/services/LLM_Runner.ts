import { StreamUtils } from '../utils/streamUtils'

interface Config {
  aiProvider: string
  aiEndpoint: string
  aiKey: string
  aiModel: string
}

interface VersionInfo {
  model_name: string
  version: string
  object: string
  owned_by: string
  api_version: string
}

export class LLM_Runner {
  isBusy = false
  private apiCheckTimeout: number | null = null
  private _config: Config | null = null
  private _versionInfo: VersionInfo = {
    model_name: "unknown",
    version: "1.0.0",
    object: "model",
    owned_by: "lotaway",
    api_version: "v1"
  }
  private _versionInfoFetched = false

  static defaultModelName() {
    return 'gpt-3.5-turbo'
  }

  get config() {
    return Object.freeze(this._config) as Readonly<Config>
  }

  get versionInfo() {
    return this._versionInfo as Readonly<VersionInfo>
  }

  get apiVersion() {
    return this.versionInfo.api_version
  }

  get apiPrefixWithVersion() {
    return `${this.config.aiEndpoint}/${this.apiVersion ?? "v1"}`
  }

  async init() {
    return await this.syncConfig()
  }

  async syncConfig() {
    this._config = await chrome.storage.sync.get([
      'aiProvider',
      'aiEndpoint',
      'aiKey',
      'aiModel',
    ]) as Config
    if (!this._config) {
      return { error: new Error('请先配置AI服务') }
    }
    return {
      isOk: true,
    }
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
    }, 60 * 1000)
  }

  private async checkApiStatus() {
    try {
      const signal = AbortSignal.timeout(5000)
      const result = await this.syncConfig()
      if (result.error) {
        return { error: result.error.message }
      }
      if (!this._versionInfoFetched) {
        await this.fetchVersionInfo()
      }
      const response = await fetch(`${this.config.aiEndpoint}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      const isApiOk = data?.ok === true
      await chrome.storage.local.set({
        apiStatus: {
          ok: isApiOk,
          lastChecked: new Date().toLocaleString(),
          message: isApiOk ? 'API服务正常' : 'API服务异常'
        }
      })
      console.log(`API状态检查: ${isApiOk ? '正常' : '异常'}`)
    } catch (error) {
      console.error('API状态检查失败:', error)
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
    if (!this.config?.aiEndpoint) {
      return
    }
    const signal = AbortSignal.timeout(5000)
    const response = await fetch(`${this.config.aiEndpoint}/api/version`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const versionData = await response.json() as VersionInfo
    this._versionInfo = versionData
    this._versionInfoFetched = true
    console.log('版本信息获取成功:', versionData)
  }

  async callLLM(
    messages: { role: string; content: string }[],
    options: {
      temperature?: number
      stream?: boolean
      onProgress?: (chunk: string) => void
    } = {}
  ) {
    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' }
    }
    const result = await this.syncConfig()
    if (result.error) {
      return { error: result.error.message }
    }
    this.isBusy = true
    try {
      const signal = AbortSignal.timeout(5 * 60 * 1000)
      const response = await fetch(`${this.apiPrefixWithVersion}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.aiKey ?? ''}`,
        },
        body: JSON.stringify({
          model: this.config.aiModel ?? LLM_Runner.defaultModelName(),
          messages,
          temperature: options.temperature ?? 0.7,
          stream: options.stream ?? true,
        }),
        signal,
      })

      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()

      const fullResponse = await new StreamUtils().readStream(
        reader,
        (content, _metadata) => {
          if (content && options.onProgress) {
            options.onProgress(content)
          }
        }
      )

      return { data: fullResponse }
    } finally {
      this.isBusy = false
    }
  }

  async saveDocument(
    title: string,
    source: string,
    content: string,
    contentType: string = 'md'
  ) {
    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' }
    }
    const result = await this.syncConfig()
    if (result.error) {
      return { error: result.error.message }
    }
    this.isBusy = true
    try {
      const signal = AbortSignal.timeout(30 * 1000)
      const response = await fetch(`${this.config.aiEndpoint}/rag/document/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.aiKey ?? ''}`,
        },
        body: JSON.stringify({
          title,
          source,
          content,
          contentType,
        }),
        signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data }
    } catch (error) {
      console.error('文档存储失败:', error)
      return { error: error instanceof Error ? error.message : '未知错误' }
    } finally {
      this.isBusy = false
    }
  }
}

import { SubtitleFetcher } from './SubtitleFetcher'

export class AISubtitleHandler {
  private llmRunner: LLM_Runner
  isBusy = false

  constructor(llmRunner: LLM_Runner) {
    this.llmRunner = llmRunner
  }

  get prompt() {
    return `你是一个学霸，能很好地发掘视频提供的知识，请将以下视频字幕内容进行总结和提炼：
1. 去除所有礼貌用语、空泛介绍、玩笑话、广告、评价和不客观的观点
2. 保留对核心问题的介绍、解析、可行方式、步骤和示例
3. 可以轻度补充缺失的内容
4. 输出为结构清晰的Markdown格式`
  }

  async summarizeSubtitlesHandler(
    fetcher: SubtitleFetcher,
    onProgress?: (chunk: string) => void
  ): Promise<{ title: string, data: string } | { error: string }> {
    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' }
    }
    const subJson = await fetcher.getSubtitlesText()
    if (subJson.error) return subJson

    const subtitles = fetcher.bilisub2text(subJson)
    const title = await fetcher.getTitle().catch(() => '')
    this.isBusy = true
    try {
      const summary = await this.processWithAI(
        title,
        subtitles,
        onProgress
      )
      return { title, data: summary }
    } finally {
      this.isBusy = false
    }
  }

  async processWithAI(
    title: string,
    text: string,
    onProgress?: (chunk: string) => void
  ) {
    const completePrompt = `${this.prompt}

视频标题：${title}
字幕内容：
${text}`

    const result = await this.llmRunner.callLLM(
      [
        {
          role: 'user',
          content: completePrompt,
        },
      ],
      {
        temperature: 0.7,
        stream: true,
        onProgress
      }
    )
    if (result.error) {
      return result.error
    }
    return result.data ?? ""
  }
}
