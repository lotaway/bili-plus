import { PageType } from '../../enums/PageType'
import { RequestPageEventType } from '../../enums/PageEventType'
import { createHomeButtonInjector } from '../../utils/inject/ButtonInjector'
import { PageInfoSyncManager, HomePageInfo } from '../../utils/inject/PageInfoSyncManager'
import { createStudyAutomationService, HomePageActionPayload } from '../../services/StudyAutomation'
import Logger from '../../utils/Logger'

class HomePageInjectActivity {
    private buttonInjector = createHomeButtonInjector()
    private actionHandler = createStudyAutomationService()
    private syncManager: PageInfoSyncManager

    constructor() {
        this.syncManager = new PageInfoSyncManager(() => this.collectHomePageInfo())
    }

    init(): void {
        this.syncManager.start()
        this.buttonInjector.inject(() => this.handleButtonClick())
        window.addEventListener('message', this.handleWindowMessage.bind(this))
    }

    private handleButtonClick(): void {
        window.postMessage({
            source: PageType.HOME_PAGE_INJECT,
            type: RequestPageEventType.REQUEST_OPEN_SIDE_PANEL,
        })
    }

    private collectHomePageInfo(): HomePageInfo {
        const handler = this.actionHandler.getHandler('getHomePageInfo')
        if (!handler) {
            return { url: window.location.href, title: document.title, ready: false }
        }
        return handler() as HomePageInfo
    }

    @Logger.Mark("HomePageInject handleWindowMessage")
    async handleWindowMessage(event: MessageEvent): Promise<void> {
        if (!this.isValidMessage(event)) return

        const payload = this.extractPayload(event)
        Logger.I('[HomePageInject] Processing action:', payload.action, 'requestId:', payload.responseId)

        try {
            const result = await this.actionHandler.execute(payload.action, payload.params)
            this.sendActionResponse(payload.responseId, true, result)
        } catch (error) {
            this.handleActionError(payload.responseId, error)
        }
    }

    private isValidMessage(event: MessageEvent): boolean {
        if (event.source !== window) {
            Logger.D('[HomePageInject] Message source is not window, ignoring')
            return false
        }

        if (event.data?.type !== RequestPageEventType.REQUEST_HOME_PAGE_ACTION) {
            Logger.D('[HomePageInject] Message type is not REQUEST_HOME_PAGE_ACTION, ignoring')
            return false
        }

        if (event.data?.source !== PageType.CONTENT_SCRIPT) {
            Logger.D('[HomePageInject] Message source is not CONTENT_SCRIPT, ignoring')
            return false
        }

        return true
    }

    private extractPayload(event: MessageEvent): { action: string; params?: any; responseId: string } {
        const { action, params, requestId } = event.data.payload as HomePageActionPayload
        return {
            action,
            params,
            responseId: requestId || `auto-${Date.now()}`
        }
    }

    private handleActionError(responseId: string, error: any): void {
        const errorMessage = error instanceof Error ? error.message : String(error ?? 'Operation failed')
        Logger.E('[HomePageInject] Action execution failed:', errorMessage)
        this.sendActionResponse(responseId, false, undefined, errorMessage)
    }

    private sendActionResponse(
        requestId: string,
        success: boolean,
        data?: any,
        error?: string
    ): void {
        window.postMessage({
            source: PageType.HOME_PAGE_INJECT,
            type: RequestPageEventType.REQUEST_HOME_PAGE_ACTION,
            payload: { requestId, success, data, error },
        }, '*')
    }
}

Logger.D('Start home inject.js')
new HomePageInjectActivity().init()
Logger.D('End home inject.js')

