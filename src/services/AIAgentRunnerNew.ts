/**
 * AI Agent 运行器
 * 使用LLMProviderManager运行AI Agent
 */

import { StreamUtils } from '../utils/streamUtils';
import { LLMProviderManager } from './LLMProviderManager';

export class AIAgentRunnerNew {
  isBusy = false;
  #abortController: AbortController | null = null;
  private readonly llmProviderManager: LLMProviderManager;

  constructor(llmProviderManager: LLMProviderManager) {
    this.llmProviderManager = llmProviderManager;
  }

  static defaultModelName() {
    return 'gpt-3.5-turbo';
  }

  async runAgent(
    payload: { message: string },
    onProgress?: (content: string, metadata: any) => void
  ) {
    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' };
    }

    // 检查是否有选中的provider
    if (!this.llmProviderManager.provider) {
      return { error: '请先配置并选择LLM provider' };
    }

    this.isBusy = true;
    this.#abortController = new AbortController();

    try {
      const agentResponse = await fetch(`${this.llmProviderManager.apiPrefixWithVersion}/agents/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.llmProviderManager.provider.apiKey ?? ''}`,
        },
        body: JSON.stringify({
          messages: [payload.message],
          model: this.llmProviderManager.provider.defaultModel || AIAgentRunnerNew.defaultModelName(),
        }),
        signal: this.#abortController.signal,
      });

      if (!agentResponse.ok) {
        throw new Error(`Agent请求失败: ${await agentResponse.text()}`, {
          cause: agentResponse,
        });
      }
      
      if (!agentResponse.body) throw new Error('No response body');

      const reader = agentResponse.body.getReader();
      const fullResponse = await new StreamUtils().readStream(
        reader,
        (content, metadata) => {
          if (metadata?.event_type === 'needs_decision') {
            onProgress?.('', {
              type: 'decision_required',
              ...metadata,
            });
          } else {
            onProgress?.(content, metadata);
          }
        }
      );

      return {
        data: fullResponse,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('AI Agent 已停止');
        return { error: 'AI Agent 已停止' };
      }
      throw error;
    } finally {
      this.isBusy = false;
      this.#abortController = null;
    }
  }

  async stopAgent() {
    if (this.isBusy && this.#abortController) {
      this.#abortController.abort();
      console.log('正在停止 AI Agent...');
      return true;
    }
    return false;
  }
}