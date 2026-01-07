import { InjectConfig } from '../config/inject.config'

export interface HomePageActionPayload {
    action: string
    params?: Record<string, any>
    requestId?: string
}

export interface ActionHandler {
    (params?: Record<string, any>): Promise<any> | any
}

export class HomePageActionHandler {
    private actionHandlers: Map<string, ActionHandler> = new Map()

    constructor() {
        this.registerDefaultHandlers()
    }

    private registerDefaultHandlers(): void {
        this.actionHandlers.set('getHomePageInfo', () => this.getHomePageInfo())
        this.actionHandlers.set('extractVideosFromPage', () => this.extractVideosFromPage())
        this.actionHandlers.set('clickChangeButton', () => this.clickChangeButton())
        this.actionHandlers.set('scrollToLoadMore', () => this.scrollToLoadMore())
    }

    registerHandler(action: string, handler: ActionHandler): void {
        this.actionHandlers.set(action, handler)
    }

    hasHandler(action: string): boolean {
        return this.actionHandlers.has(action)
    }

    getHandler(action: string): ActionHandler | undefined {
        return this.actionHandlers.get(action)
    }

    async execute(action: string, params?: Record<string, any>): Promise<any> {
        console.debug('[HomePageActionHandler] 执行action:', action, 'params:', params)
        const handler = this.actionHandlers.get(action)
        if (!handler) {
            console.error('[HomePageActionHandler] 未找到handler for action:', action)
            throw new Error(`不支持的操作: ${action}`)
        }
        const result = await handler(params)
        console.debug('[HomePageActionHandler] action执行结果:', result)
        return result
    }

    private getHomePageInfo(): { url: string; title: string; ready: boolean } {
        return {
            url: window.location.href,
            title: document.title,
            ready: this.checkHomePageReady(),
        }
    }

    private checkHomePageReady(): boolean {
        const container = document.querySelector(InjectConfig.selectors.homePageContainer)
        return !!container
    }

    private extractVideosFromPage(): Array<{ title: string; link: string; bvid: string }> {
        const cards = document.querySelectorAll(InjectConfig.selectors.videoCard)
        const results: Array<{ title: string; link: string; bvid: string }> = []

        cards.forEach(card => {
            const titleEl = card.querySelector(InjectConfig.selectors.videoCardTitle)
            const linkEl = card.querySelector('a')

            if (titleEl && linkEl) {
                const title = titleEl.textContent?.trim() || ''
                const link = linkEl.href
                const bvidMatch = link.match(/BV[a-zA-Z0-9]+/)

                if (bvidMatch) {
                    results.push({ title, link, bvid: bvidMatch[0] })
                }
            }
        })

        return results
    }

    private clickChangeButton(): { success: boolean; clicked: boolean } {
        const btn = document.querySelector(InjectConfig.selectors.rollButton) as HTMLElement

        if (btn) {
            btn.click()
            return { success: true, clicked: true }
        }

        return { success: true, clicked: false }
    }

    private scrollToLoadMore(): { success: boolean } {
        window.scrollTo(0, document.body.scrollHeight)
        return { success: true }
    }
}

export function createHomePageActionHandler(): HomePageActionHandler {
    return new HomePageActionHandler()
}

