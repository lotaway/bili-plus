import { InjectConfig } from '../config/inject.config'
import Logger from '../utils/Logger'

export interface HomePageActionPayload {
    action: string
    params?: Record<string, any>
    requestId?: string
}

export interface ActionHandler {
    (params?: Record<string, any>): Promise<any> | any
}

export class StudyAutomationService {
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
        Logger.D('[StudyAutomationService] Executing action:', action, 'params:', params)
        const handler = this.actionHandlers.get(action)
        if (!handler) {
            Logger.E('[StudyAutomationService] Handler not found for action:', action)
            throw new Error(`Unsupported action: ${action}`)
        }
        const result = await handler(params)
        Logger.D('[StudyAutomationService] Action execution result:', result)
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

        Logger.D('[StudyAutomationService] Found potential video cards:', cards.length)

        cards.forEach((card, index) => {
            const titleEl = card.querySelector(InjectConfig.selectors.videoCardTitle)
            if (!titleEl) {
                Logger.D(`[StudyAutomationService] Card ${index} missing title element`)
                return
            }

            // Find all links in the card and look for one with a BV ID
            const links = Array.from(card.querySelectorAll('a'))
            if (card.tagName.toLowerCase() === 'a') {
                links.push(card as HTMLAnchorElement)
            }

            let videoLink = ''
            let bvid = ''

            for (const linkEl of links) {
                const href = linkEl.href
                if (!href) continue

                Logger.D(`[StudyAutomationService] Card ${index} checking link:`, href)
                const bvidMatch = href.match(/BV[a-zA-Z0-9]+/)
                if (bvidMatch) {
                    videoLink = href
                    bvid = bvidMatch[0]
                    break
                }
            }

            if (videoLink && bvid) {
                const title = titleEl.textContent?.trim() || ''
                if (title) {
                    results.push({ title, link: videoLink, bvid })
                }
            } else {
                Logger.D(`[StudyAutomationService] Card ${index} missing link or BVID. Links found:`, links.length)
            }
        })

        Logger.I('[StudyAutomationService] Successfully extracted videos:', results.length)
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

export function createStudyAutomationService(): StudyAutomationService {
    return new StudyAutomationService()
}
