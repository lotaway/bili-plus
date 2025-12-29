/**
 * AI 字幕处理器
 * 使用LLMProviderManager处理字幕总结
 */

import { SubtitleFetcher } from './SubtitleFetcher'
import { LLMProviderManager } from './LLMProviderManager'

export class AISubtitleHandler {
  private llmProviderManager: LLMProviderManager
  isBusy = false;

  constructor(llmProviderManager: LLMProviderManager) {
    this.llmProviderManager = llmProviderManager
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
  ): Promise<{ title: string; data: { think: string; content: string } } | { error: string }> {
    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' }
    }

    const subJson = await fetcher.getSubtitlesText()
    if (subJson.error) return subJson

    const subtitles = fetcher.bilisub2text(subJson)
    const title = await fetcher.getTitle().catch(() => '')

    this.isBusy = true
    try {
      const summary = await this.processWithAI(title, subtitles, onProgress)
      return { title, data: summary }
    } finally {
      this.isBusy = false
    }
  }

  async processWithAI(
    title: string,
    text: string,
    onProgress?: (chunk: string) => void
  ): Promise<{ think: string; content: string }> {
    const completePrompt = `${this.prompt}

视频标题：${title}
字幕内容：
${text}`

    const result = await this.llmProviderManager.callLLM(
      [
        {
          role: 'user',
          content: completePrompt,
        },
      ],
      {
        temperature: 0.7,
        stream: true,
        onProgress,
      }
    )

    if ('error' in result) {
      throw new Error(result.error)
    }

    return result.data ?? { think: '', content: '' }
  }
}