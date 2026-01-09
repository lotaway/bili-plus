import Logger from '../../utils/Logger'
import { RequestPageEventType } from '../../enums/PageEventType'
import { PageType } from '../../enums/PageType'
import { LOG_PREFIX, STUDY_AUTOMATION_CONFIG } from './constants'

export class PageActionService {
    async sendAction(action: string, params?: Record<string, any>): Promise<any> {
        const requestId = this.generateRequestId()

        Logger.D(`${LOG_PREFIX} Sending page action request:`, { action, params, requestId })

        this.postActionMessage(action, params, requestId)

        return this.awaitResponse(requestId, action)
    }

    private generateRequestId(): string {
        return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    private postActionMessage(action: string, params: Record<string, any> | undefined, requestId: string): void {
        window.postMessage({
            source: PageType.CONTENT_SCRIPT,
            type: RequestPageEventType.REQUEST_HOME_PAGE_ACTION,
            payload: { action, params, requestId }
        }, '*')
    }

    private awaitResponse(requestId: string, action: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const timeout = this.createTimeout(requestId, action, reject)
            const responseHandler = this.createResponseHandler(requestId, timeout, resolve, reject)

            window.addEventListener('message', responseHandler)
        })
    }

    private createTimeout(requestId: string, action: string, reject: (error: Error) => void): NodeJS.Timeout {
        return setTimeout(() => {
            Logger.E(`${LOG_PREFIX} Request timeout:`, { action, requestId })
            reject(new Error('Request timeout'))
        }, STUDY_AUTOMATION_CONFIG.REQUEST_TIMEOUT)
    }

    private createResponseHandler(
        requestId: string,
        timeout: NodeJS.Timeout,
        resolve: (value: any) => void,
        reject: (error: Error) => void
    ): (event: MessageEvent) => void {
        const handler = (event: MessageEvent) => {
            Logger.D(`${LOG_PREFIX} Received message:`, event.data)

            if (!this.isValidResponse(event, requestId)) {
                return
            }

            clearTimeout(timeout)
            window.removeEventListener('message', handler)

            const payload = event.data.payload
            Logger.I(`${LOG_PREFIX} Page action response:`, payload)

            if (payload.success) {
                resolve(payload.data)
            } else {
                reject(new Error(payload.error || 'Operation failed'))
            }
        }

        return handler
    }

    private isValidResponse(event: MessageEvent, requestId: string): boolean {
        return (
            event.source === window &&
            event.data?.source === PageType.HOME_PAGE_INJECT &&
            event.data?.type === RequestPageEventType.REQUEST_HOME_PAGE_ACTION &&
            event.data?.payload?.requestId === requestId
        )
    }
}
