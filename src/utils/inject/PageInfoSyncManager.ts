import { PageType } from '../../enums/PageType'
import { RequestPageEventType } from '../../enums/PageEventType'
import { InjectConfig } from '../../config/inject.config'

export interface HomePageInfo {
    url: string
    title: string
    ready: boolean
}

export class PageInfoSyncManager {
    private timer: ReturnType<typeof setInterval> | null = null
    private isWindowActivate = true
    private syncCallback: () => HomePageInfo

    constructor(syncCallback: () => HomePageInfo) {
        this.syncCallback = syncCallback
    }

    start(): void {
        this.sync()
        this.timer = setInterval(() => this.sync(), InjectConfig.syncIntervalMs)
        this.bindEvents()
    }

    private bindEvents(): void {
        document.addEventListener('visibilitychange', () => {
            this.isWindowActivate = document.visibilityState === 'visible'
            this.sync()
        })
        window.addEventListener('unload', () => this.stop())
    }

    sync(needCheck = true): void {
        if (needCheck && !this.isWindowActivate) return

        const pageInfo = this.syncCallback()
        this.sendPageInfo(pageInfo)
    }

    private sendPageInfo(pageInfo: HomePageInfo): void {
        window.postMessage({
            source: PageType.HOME_PAGE_INJECT,
            type: RequestPageEventType.HOME_INFO_INIT,
            payload: pageInfo,
        })
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    getWindowActivateState(): boolean {
        return this.isWindowActivate
    }
}

