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
      const adaptedOnProgress = onProgress
        ? (chunk: string, metadata?: any) => {
          onProgress(chunk)
        }
        : undefined

      const summary = await this.processWithAI(title, subtitles, adaptedOnProgress)
      return { title, data: summary }
    } finally {
      this.isBusy = false
    }
  }

  async processWithAI(
    title: string,
    text: string,
    onProgress?: (chunk: string, metadata?: any) => void
  ): Promise<{ think: string; content: string }> {
    const completePrompt = `${this.prompt}

视频标题：${title}
字幕内容：
${text}`

    let accumulatedContent = ''
    let finalThink = ''
    let attemptCount = 0
    const maxAttempts = 3

    while (attemptCount < maxAttempts) {
      attemptCount++
      const messages: { role: string; content: string }[] = [
        {
          role: 'user',
          content: completePrompt,
        },
      ]
      if (attemptCount > 1 && accumulatedContent) {
        messages.push({
          role: 'assistant',
          content: accumulatedContent,
        })
      }

      let receivedFinishReason: string | null = null
      let currentAttemptContent = ''

      const result = await this.llmProviderManager.callLLM(
        messages,
        {
          temperature: 0.7,
          stream: true,
          onProgress: (chunk: string, metadata?: any) => {
            if (chunk) {
              accumulatedContent += chunk
              currentAttemptContent += chunk
            }
            if (metadata?.finish_reason) {
              receivedFinishReason = metadata.finish_reason
            }
            if (onProgress) {
              onProgress(chunk, metadata)
            }
          },
        }
      )

      if ('error' in result) {
        throw new Error(result.error)
      }
      const data = result.data ?? { think: '', content: '' }
      if (data.think) {
        finalThink = data.think
      }
      if (receivedFinishReason === 'length' && attemptCount < maxAttempts) {
        console.log(`检测到finish_reason: "length"，尝试续传 (第${attemptCount}次)`)
        continue
      } else {
        console.log(`生成完成，finish_reason: ${receivedFinishReason || '正常结束'}`)
        return {
          think: finalThink,
          content: accumulatedContent,
        }
      }
    }
    console.log(`达到最大续传尝试次数 (${maxAttempts})，返回当前内容`)
    return {
      think: finalThink,
      content: accumulatedContent,
    }
  }
}