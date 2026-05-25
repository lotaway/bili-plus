import { MessageType } from '../../enums/MessageType'
import { PageType } from '../../enums/PageType'
import { RequestPageEventType } from '../../enums/PageEventType'
import { AgentActionRequest } from '../../types/agent'
import Logger from '../../utils/Logger'

export class ContentAgentActionBridge {
    private readonly sourceLabel: string

    constructor(sourceLabel: string) {
        this.sourceLabel = sourceLabel
    }

    setup(): void {
        chrome.runtime.onMessage.addListener(this.handleChromeMessage.bind(this))
        window.addEventListener('message', this.handleWindowMessage.bind(this))
        Logger.I(`[${this.sourceLabel}] Agent action bridge ready`)
    }

    private handleChromeMessage(
        message: any,
        _sender: chrome.runtime.MessageSender,
        _sendResponse: (response?: any) => void
    ): boolean | void {
        if (message.type !== MessageType.AGENT_ACTION_REQUEST) return false

        const request = message.data as AgentActionRequest
        Logger.I(`[${this.sourceLabel}] Forward to inject: ${request.action}`)
        window.postMessage({
            source: PageType.CONTENT_SCRIPT,
            type: RequestPageEventType.REQUEST_AGENT_PAGE_ACTION,
            payload: request,
        }, '*')
        return true
    }

    private handleWindowMessage(event: MessageEvent): void {
        if (event.source !== window) return
        if (event.data?.type !== RequestPageEventType.REQUEST_AGENT_PAGE_ACTION) return

        const payload = event.data.payload
        if (!payload?.actionId) return

        Logger.I(`[${this.sourceLabel}] Result from inject: ${payload.actionId}`)
        chrome.runtime.sendMessage({
            type: MessageType.AGENT_ACTION_RESULT,
            data: payload,
        }).catch((err: Error) => Logger.E(`[${this.sourceLabel}] Forward result failed`, err))
    }
}
