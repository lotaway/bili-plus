import { StreamUtils } from '../utils/streamUtils'
import { LLM_Runner } from './LLM_Runner'

export class AIAgentRunner {
  isBusy = false;
  #abortController: AbortController | null = null;
  private readonly llmRunner: LLM_Runner

  constructor(llmRunner: LLM_Runner) {
    this.llmRunner = llmRunner
  }

  static defaultModelName() {
    return 'gpt-3.5-turbo'
  }

  async runAgent(
    payload: { message: string },
    onProgress?: (content: string, metadata: any) => void
  ) {
    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' }
    }
    const result = await this.llmRunner.syncConfig()
    if (result.error) {
      return { error: result.error }
    }

    this.isBusy = true
    this.#abortController = new AbortController()

    try {
      const agentResponse = await fetch(`${this.llmRunner.apiPrefixWithVersion}/agents/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.llmRunner.config.aiKey ?? ''}`,
        },
        body: JSON.stringify({
          messages: [payload.message],
          model: this.llmRunner.config.aiModel || AIAgentRunner.defaultModelName(),
        }),
        signal: this.#abortController.signal,
      })

      if (!agentResponse.ok) {
        throw new Error(`Agent请求失败: ${await agentResponse.text()}`, {
          cause: agentResponse,
        })
      }
      // onProgress?.('正在尝试读取流。。。', null);
      if (!agentResponse.body) throw new Error('No response body')

      const reader = agentResponse.body.getReader()
      const fullResponse = await new StreamUtils().readStream(
        reader,
        (content, metadata) => {
          // Handle human-in-loop cases
          if (metadata?.event_type === 'needs_decision') {
            // Send decision request to frontend
            onProgress?.('', {
              type: 'decision_required',
              ...metadata,
            })
          } else {
            // Normal progress update
            onProgress?.(content, metadata)
          }
        }
      )

      return {
        data: fullResponse,
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('AI Agent 已停止')
        return { error: 'AI Agent 已停止' }
      }
      throw error
    } finally {
      this.isBusy = false
      this.#abortController = null
    }
  }

  async stopAgent() {
    if (this.isBusy && this.#abortController) {
      this.#abortController.abort()
      console.log('正在停止 AI Agent...')
      return true
    }
    return false
  }
}
