import { DocumentType } from '../enums/DownloadType'
import { LLMContentType } from '../enums/LLMContentType'
import { StreamUtils } from '../utils/streamUtils'
import { FileUtils } from '../utils/FileUtils'
import { SubtitleFetcher } from './SubtitleFetcher'
import { AIGenerationAnalyzer } from './AIGeneratioinAnalyzer'
import { ModelInfo, VersionInfo } from '../types/llm-provider'
import type { LLMProviderManager } from './LLMProviderManager'

interface Config {
  aiProvider: string
  aiEndpoint: string
  aiKey: string
  aiModel: string
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
  private _modelList: ModelInfo[] = []
  private _modelListFetched = false

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
    }, 60 * 1000) as unknown as number
  }

  private async checkApiStatus() {
    try {
      const result = await this.checkApiStatusNow()
      if ('error' in result) {
        console.error('API状态检查失败:', result.error)
      }
    } finally {
      this.scheduleApiCheck()
    }
  }

  async checkApiStatusNow(): Promise<{ ok: boolean, message: string } | { error: string }> {
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
        headers: this.defaultHeaders(false),
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
      return { ok: isApiOk, message: isApiOk ? 'API服务正常' : 'API服务异常' }
    } catch (error) {
      console.error('API状态检查失败:', error)
      await chrome.storage.local.set({
        apiStatus: {
          ok: false,
          lastChecked: new Date().toLocaleString(),
          message: `API检查失败: ${error instanceof Error ? error.message : '未知错误'}`
        }
      })
      return { error: error instanceof Error ? error.message : '未知错误' }
    }
  }

  private async fetchVersionInfo() {
    if (!this.config?.aiEndpoint) {
      return
    }
    const signal = AbortSignal.timeout(5000)
    const response = await fetch(`${this.config.aiEndpoint}/api/version`, {
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
  }

  async fetchModelList(): Promise<ModelInfo[]> {
    if (!this.config?.aiEndpoint) {
      return []
    }

    try {
      const signal = AbortSignal.timeout(5000)
      const response = await fetch(`${this.config.aiEndpoint}/api/tags`, {
        method: 'GET',
        headers: this.defaultHeaders(false),
        signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const modelList = await response.json() as ModelInfo[]
      this._modelList = modelList
      this._modelListFetched = true
      return modelList
    } catch (error) {
      console.error('获取模型列表失败:', error)
      return []
    }
  }

  get modelList(): ModelInfo[] {
    return [...this._modelList]
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    if (!this._modelListFetched) {
      await this.fetchModelList()
    }
    return this.modelList
  }

  async validateModel(modelName: string): Promise<boolean> {
    const models = await this.getAvailableModels()
    return models.some(model => model.name === modelName)
  }

  static async fetchModelListForEndpoint(endpoint: string): Promise<ModelInfo[]> {
    if (!endpoint) {
      console.error('Endpoint不能为空')
      return []
    }

    try {
      const signal = AbortSignal.timeout(5000)
      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const modelList = await response.json() as ModelInfo[]
      return modelList
    } catch (error) {
      console.error('获取模型列表失败:', error)
      return []
    }
  }

  get defaultRequestBody() {
    return {
      stream: true,
      enable_rag: false,
    }
  }

  defaultHeaders(includeAuth: boolean = true, contentType: string = 'application/json'): Record<string, string> {
    const headers: Record<string, string> = {}

    if (contentType) {
      headers['Content-Type'] = `${contentType}; charset=utf-8`
    }

    if (includeAuth && this.config?.aiKey) {
      headers['Authorization'] = `Bearer ${this.config.aiKey}`
    }

    return headers
  }

  async callLLM(
    messages: { role: string; content: string }[],
    options: {
      temperature?: number
      stream?: boolean
      onProgress?: (chunk: string, metadata?: any) => void
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
      // @TODO REMOVE BEFORE RELEASE
      // const mock = true
      // if (mock) {
      //   const fullResponse = "<think>llm provider改成混合llama.cpp作为gguf模型加载和推理后端（插件没有正常输出生成内容需要排查问题）</think>```markdown把飞行摇杆和踏板变成辅助工作按钮，还可区别浅按和深按，如果可行，加入摇杆给脚控制。Window测试ComfyUI 图片替换视频人物节点效果（按照视频流程完成下载和测试）```"
      //   const chunks = fullResponse.split('')
      //   for (const content of chunks) {
      //     await new Promise(resolve => setTimeout(resolve, 30))
      //     options?.onProgress?.(content)
      //   }
      //   const data = new AIGenerationAnalyzer(fullResponse).analyze()
      //   return { data }
      // }
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
        headers: this.defaultHeaders(),
        body: JSON.stringify(bodyData),
        signal,
      })

      if (!response.body) return { error: 'No response body' }
      const reader = response.body!.getReader()

      const fullResponse = await new StreamUtils().readStream(
        reader,
        (content, metadata) => {
          if (content && options.onProgress) {
            options.onProgress(content, metadata)
          } else if (metadata && options.onProgress) {
            options.onProgress('', metadata)
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
        headers: this.defaultHeaders(),
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
        headers: this.defaultHeaders(true),
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
    onProgress?: (chunk: string, metadata?: any) => void
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
      // const uploadResult = await this.uploadFile(screenshotDataUrl)
      // if ('error' in uploadResult) {
      //   return { error: uploadResult.error }
      // }
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
            content: [
              {
                type: LLMContentType.TEXT,
                text: screenshotPrompt,
              },
              {
                type: LLMContentType.IMAGE_URL,
                image_url: screenshotDataUrl,
              }
            ]
          }
        ],
        // files: [uploadResult.id],
        temperature: 0.7,
        enable_rag: false,
      }
      const response = await fetch(`${this.apiPrefixWithVersion}/chat/completions`, {
        method: 'POST',
        headers: this.defaultHeaders(),
        body: JSON.stringify(bodyData),
        signal,
      })

      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()

      const fullResponse = await new StreamUtils().readStream(
        reader,
        (content, metadata) => {
          if (content && onProgress) {
            onProgress(content, metadata)
          } else if (metadata && onProgress) {
            onProgress('', metadata)
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
  private llmProvider: LLMProviderManager
  isBusy = false

  constructor(llmProvider: LLMProviderManager) {
    this.llmProvider = llmProvider
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

    const result = await this.llmProvider.callLLM(
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
    if ('error' in result) {
      throw new Error(result.error)
    }
    return result.data ?? { think: '', content: '' }
  }
}
