import { AgentActionType } from '../enums/AgentActionType'
import { AgentActionExecutor } from './AgentActionExecutor'
import Logger from '../utils/Logger'
import { StreamUtils } from '../utils/streamUtils'
import { LLMProviderManager } from './LLMProviderManager'

export interface AgentRunnerConfig {
    autoExecuteActions?: boolean
    actionResultEndpoint?: string
}

export class AIAgentRunner {
    private isBusy = false;
    #abortController: AbortController | null = null;
    private readonly llmProviderManager: LLMProviderManager
    private readonly agentActionExecutor = new AgentActionExecutor()
    private config: AgentRunnerConfig = {
        autoExecuteActions: true,
    }

    constructor(llmProviderManager: LLMProviderManager) {
        this.llmProviderManager = llmProviderManager
    }

    static defaultModelName(): string {
        return 'gpt-3.5-turbo'
    }

    setConfig(config: Partial<AgentRunnerConfig>): void {
        this.config = { ...this.config, ...config }
    }

    get availableActions(): AgentActionType[] {
        return this.agentActionExecutor.getActionList()
    }

    get running(): boolean {
        return this.isBusy
    }

    async getCapabilities(): Promise<Array<{ type: AgentActionType; description: string }>> {
        return this.availableActions.map(type => ({
            type,
            description: `Browser action: ${type}`,
        }))
    }

    async executeAction(action: AgentActionType, params: Record<string, any> = {}): Promise<any> {
        const actionId = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        return this.agentActionExecutor.execute({ actionId, action, params })
    }

    async runAgent(
        payload: { message: string },
        onProgress?: (content: string, metadata: any) => void
    ): Promise<{ data?: string; error?: string }> {
        if (this.isBusy) {
            return { error: '当前正在处理中，请稍后再试' }
        }

        if (!this.llmProviderManager.provider) {
            return { error: '请先配置并选择LLM provider' }
        }

        this.isBusy = true
        this.#abortController = new AbortController()

        try {
            const response = await this.sendAgentRequest(payload)
            const reader = this.getResponseReader(response)
            const fullResponse = await new StreamUtils().readStream(
                reader,
                this.createStreamHandler(payload, onProgress)
            )
            return { data: fullResponse }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                Logger.I('AI Agent 已停止')
                return { error: 'AI Agent 已停止' }
            }
            throw error
        } finally {
            this.isBusy = false
            this.#abortController = null
        }
    }

    private async sendAgentRequest(payload: { message: string }): Promise<Response> {
        const provider = this.llmProviderManager.provider!
        const endpoint = `${this.llmProviderManager.apiPrefixWithVersion}/agents/run`

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${provider.apiKey ?? ''}`,
            },
            body: JSON.stringify({
                messages: [payload.message],
                model: provider.defaultModel || AIAgentRunner.defaultModelName(),
            }),
            signal: this.#abortController!.signal,
        })

        if (!response.ok) {
            throw new Error(`Agent请求失败: ${await response.text()}`, { cause: response })
        }

        return response
    }

    private getResponseReader(response: Response): ReadableStreamDefaultReader<Uint8Array> {
        if (!response.body) throw new Error('No response body')
        return response.body.getReader()
    }

    private createStreamHandler(
        payload: { message: string },
        onProgress?: (content: string, metadata: any) => void
    ): (content: string, metadata: any) => Promise<void> {
        return async (content, metadata) => {
            if (metadata?.event_type === 'needs_decision') {
                const handled = await this.tryAutoExecuteAction(metadata, onProgress)
                if (!handled) {
                    onProgress?.('', { type: 'decision_required', ...metadata })
                }
            } else {
                onProgress?.(content, metadata)
            }
        }
    }

    private async tryAutoExecuteAction(
        metadata: any,
        onProgress?: (content: string, metadata: any) => void
    ): Promise<boolean> {
        if (!this.config.autoExecuteActions) return false

        const action = metadata.action || metadata.action_type
        const actionId = metadata.action_id || `auto-${Date.now()}`
        const params = metadata.action_params || metadata.params || {}

        if (!action) return false

        Logger.I(`[AIAgentRunner] Auto: ${action} (${actionId})`)

        const result = await this.agentActionExecutor.execute({
            actionId,
            action: action as AgentActionType,
            params,
        })

        onProgress?.('', {
            type: 'action_executed',
            action,
            actionId,
            result: result.success ? result.data : { error: result.error },
            success: result.success,
        })

        return true
    }

    async stopAgent(): Promise<boolean> {
        if (this.isBusy && this.#abortController) {
            this.#abortController.abort()
            Logger.I('正在停止 AI Agent...')
            return true
        }
        return false
    }
}
