import { DocumentType } from '../enums/DownloadType'
import { StreamUtils } from '../utils/streamUtils'
import { FileUtils } from '../utils/FileUtils'
import { SubtitleFetcher } from './SubtitleFetcher'
import { AIGenerationAnalyzer } from './AIGeneratioinAnalyzer'

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

interface ImportDocumentData {
  title: string
  bvid: string
  cid: number
  source: string
  content: string
  contentType?: DocumentType
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

  get defaultRequestBody() {
    return {
      stream: true,
      enable_rag: true,
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
    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' }
    }
    const result = await this.syncConfig()
    if (result.error) {
      return { error: result.error.message }
    }
    this.isBusy = true
    try {
      const bodyData = {
        ...this.defaultRequestBody,
        model: this.config.aiModel ?? LLM_Runner.defaultModelName(),
        messages,
        temperature: options.temperature ?? 0.7,
        stream: options.stream,
      }
      const signal = AbortSignal.timeout(5 * 60 * 1000)
      const response = await fetch(`${this.apiPrefixWithVersion}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.aiKey ?? ''}`,
        },
        body: JSON.stringify(bodyData),
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
      const data = new AIGenerationAnalyzer(fullResponse).analyze()
      return { data }
    } finally {
      this.isBusy = false
    }
  }

  async saveDocument(importDocumentData: ImportDocumentData) {
    importDocumentData.contentType = importDocumentData.contentType ?? DocumentType.MARKDOWN
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
      const response = await fetch(`${this.apiPrefixWithVersion}/rag/document/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.aiKey ?? ''}`,
        },
        body: JSON.stringify(importDocumentData),
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

  async uploadFile(fileData: string, filename?: string): Promise<{ id: string, filename: string, message: string } | { error: string }> {
    try {
      const result = await this.syncConfig()
      if (result.error) {
        return { error: result.error.message }
      }
      const response = await fetch(fileData)
      const blob = await response.blob()
      const formData = new FormData()
      let finalFilename = filename
      if (!finalFilename) {
        const mimeType = FileUtils.extractMimeTypeFromDataUrl(fileData)
        const extension = FileUtils.getFileExtensionFromMimeType(mimeType)
        finalFilename = `${Date.now()}${extension}`
      }

      formData.append('file', blob, finalFilename)
      const uploadResponse = await fetch(`${this.apiPrefixWithVersion}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.aiKey ?? ''}`,
        },
        body: formData,
      })
      if (!uploadResponse.ok) {
        throw new Error(`文件上传失败: ${uploadResponse.status}`)
      }
      const uploadData = await uploadResponse.json()
      return uploadData
    } catch (error) {
      console.error('文件上传失败:', error)
      return { error: error instanceof Error ? error.message : '未知错误' }
    }
  }

  async analyzeScreenshot(
    screenshotDataUrl: string,
    onProgress?: (chunk: string) => void
  ): Promise<{ data: { think: string, content: string } } | { error: string }> {
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
      const uploadResult = await this.uploadFile(screenshotDataUrl)
      if ('error' in uploadResult) {
        return { error: uploadResult.error }
      }
      const screenshotPrompt = `请分析这张截图的内容，描述截图中的界面元素、文字内容、布局结构等信息。
      如果截图包含视频播放界面，请描述视频的标题、进度条、控制按钮等元素。
      如果截图包含网页内容，请描述网页的主要内容和结构。
      请用清晰的结构化格式输出分析结果。`
      const bodyData = {
        ...this.defaultRequestBody,
        model: this.config.aiModel ?? LLM_Runner.defaultModelName(),
        messages: [
          {
            role: 'user',
            content: screenshotPrompt
          }
        ],
        files: [uploadResult.id],
        temperature: 0.7,
        enable_rag: false,
      }
      const response = await fetch(`${this.apiPrefixWithVersion}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.aiKey ?? ''}`,
        },
        body: JSON.stringify(bodyData),
        signal,
      })

      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()

      const fullResponse = await new StreamUtils().readStream(
        reader,
        (content, _metadata) => {
          if (content && onProgress) {
            onProgress(content)
          }
        }
      )
      const data = new AIGenerationAnalyzer(fullResponse).analyze()
      return { data }
    } catch (error) {
      console.error('截图分析失败:', error)
      return { error: error instanceof Error ? error.message : '未知错误' }
    } finally {
      this.isBusy = false
    }
  }
}

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
  ): Promise<{ title: string, data: { think: string, content: string } } | { error: string }> {
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
      throw new Error(result.error)
    }
    return result.data ?? { think: '', content: '' }
  }
}
