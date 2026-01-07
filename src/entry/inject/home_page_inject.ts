import { PageType } from '../../enums/PageType'
import { RequestPageEventType } from '../../enums/PageEventType'
import { createHomeButtonInjector } from '../../utils/inject/ButtonInjector'
import { PageInfoSyncManager, HomePageInfo } from '../../utils/inject/PageInfoSyncManager'
import { createHomePageActionHandler, HomePageActionPayload } from '../../handlers/HomePageActionHandler'

class HomePageInjectActivity {
    private buttonInjector = createHomeButtonInjector()
    private actionHandler = createHomePageActionHandler()
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

    async handleWindowMessage(event: MessageEvent): Promise<void> {
        if (event.source !== window) {
            return
        }

        if (event.data?.type !== RequestPageEventType.REQUEST_HOME_PAGE_ACTION) {
            return
        }

        if (event.data?.source !== PageType.CONTENT_SCRIPT) {
            return
        }

        const { action, params, requestId } = event.data.payload as HomePageActionPayload
        const responseId = requestId || `auto-${Date.now()}`

        try {
            const result = await this.actionHandler.execute(action, params)
            this.sendActionResponse(responseId, true, result)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error ?? '操作失败')
            this.sendActionResponse(responseId, false, undefined, errorMessage)
        }
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

console.debug('Start home inject.js')
new HomePageInjectActivity().init()
console.debug('End home inject.js')

