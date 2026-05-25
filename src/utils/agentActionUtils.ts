import { RequestPageEventType } from '../enums/PageEventType'
import { PageType } from '../enums/PageType'
import { AgentActionRequest, AgentActionResult } from '../types/agent'
import { PAGE_ACTION_TIMEOUT } from '../services/agentActions/constants'

export function sendAgentActionToInject(
    request: AgentActionRequest,
    pageType: PageType = PageType.CONTENT_SCRIPT
) {
    window.postMessage({
        source: pageType,
        type: RequestPageEventType.REQUEST_AGENT_PAGE_ACTION,
        payload: request,
    }, '*')
}

export function createAgentActionResponseHandler(
    actionId: string,
    resolve: (result: AgentActionResult) => void,
    reject: (error: Error) => void,
    timeoutMs: number = PAGE_ACTION_TIMEOUT
): { handler: (event: MessageEvent) => void; cleanup: () => void } {
    const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Agent action timed out: ${actionId}`))
    }, timeoutMs)

    const handler = (event: MessageEvent) => {
        if (
            event.source !== window ||
            event.data?.type !== RequestPageEventType.REQUEST_AGENT_PAGE_ACTION
        ) {
            return
        }

        const payload = event.data.payload
        if (payload?.actionId !== actionId) return

        cleanup()

        if (payload.success) {
            resolve({
                actionId: payload.actionId,
                success: true,
                data: payload.data,
            })
        } else {
            resolve({
                actionId: payload.actionId,
                success: false,
                error: payload.error || 'Unknown error',
            })
        }
    }

    const cleanup = () => {
        clearTimeout(timer)
        window.removeEventListener('message', handler)
    }

    window.addEventListener('message', handler)
    return { handler, cleanup }
}
