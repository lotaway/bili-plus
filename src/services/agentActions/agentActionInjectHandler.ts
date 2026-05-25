import { AgentActionType } from '../../enums/AgentActionType'
import { PageType } from '../../enums/PageType'
import { RequestPageEventType } from '../../enums/PageEventType'
import Logger from '../../utils/Logger'

type PageActionResult = {
    textContent?: string
    htmlContent?: string
    title?: string
    url?: string
    result?: any
    localStorage?: Record<string, string | null>
    sessionStorage?: Record<string, string | null>
    clicked?: boolean
    selector?: string
    filled?: boolean
    value?: string
    scrolled?: boolean
    x?: number
    y?: number
    [key: string]: any
}

type PageAction = (params: Record<string, any>) => PageActionResult

const pageActions: Partial<Record<AgentActionType, PageAction>> = {
    [AgentActionType.GET_PAGE_CONTENT]: () => ({
        textContent: document.body?.innerText || '',
        htmlContent: document.documentElement?.outerHTML || '',
        title: document.title,
        url: window.location.href,
    }),

    [AgentActionType.EXECUTE_SCRIPT]: (params) => {
        const fn = new Function(params.code)
        return { result: fn() }
    },

    [AgentActionType.GET_LOCAL_STORAGE]: (params) => ({
        localStorage: extractStorage(window.localStorage, params.keys),
    }),

    [AgentActionType.GET_SESSION_STORAGE]: (params) => ({
        sessionStorage: extractStorage(window.sessionStorage, params.keys),
    }),

    [AgentActionType.CLICK_ELEMENT]: (params) => {
        const element = document.querySelector(params.selector)
        if (!element) throw new Error(`Element not found: ${params.selector}`)
        if (element instanceof HTMLElement) {
            element.click()
        } else {
            element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        }
        return { clicked: true, selector: params.selector }
    },

    [AgentActionType.GET_PAGE_INFO]: () => ({
        title: document.title,
        url: window.location.href,
        referrer: document.referrer,
        readyState: document.readyState,
        contentType: document.contentType,
        characterSet: document.characterSet,
        cookieEnabled: navigator.cookieEnabled,
        userAgent: navigator.userAgent,
        language: navigator.language,
    }),

    [AgentActionType.GET_SELECTED_TEXT]: () => ({
        text: window.getSelection()?.toString() || '',
    }),

    [AgentActionType.FILL_INPUT]: (params) => {
        fillInputElement(params.selector, params.value)
        return { filled: true, selector: params.selector, value: params.value }
    },

    [AgentActionType.SCROLL_PAGE]: (params) => {
        window.scrollTo({
            left: params.x ?? 0,
            top: params.y ?? 0,
            behavior: (params.behavior as ScrollBehavior) || 'smooth',
        })
        return { scrolled: true, x: params.x ?? 0, y: params.y ?? 0 }
    },
}

function extractStorage(storage: Storage, keys?: string[]): Record<string, string | null> {
    const items: Record<string, string | null> = {}
    if (keys && keys.length > 0) {
        for (const key of keys) items[key] = storage.getItem(key)
    } else {
        for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i)
            if (k !== null) items[k] = storage.getItem(k)
        }
    }
    return items
}

function fillInputElement(selector: string, value: string): void {
    const element = document.querySelector(selector)
    if (!element) throw new Error(`Input element not found: ${selector}`)

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        setter?.call(element, value)
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (element instanceof HTMLElement && element.isContentEditable) {
        element.textContent = value
        element.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
        throw new Error(`Element is not an input or contentEditable: ${selector}`)
    }
}

export class AgentPageActionHandler {
    private readonly pageType: PageType

    constructor(pageType: PageType) {
        this.pageType = pageType
    }

    handle(event: MessageEvent): boolean {
        if (event.source !== window) return false
        if (event.data?.type !== RequestPageEventType.REQUEST_AGENT_PAGE_ACTION) return false
        if (event.data?.source !== PageType.CONTENT_SCRIPT) return false

        const { actionId, action, params } = event.data.payload
        Logger.I(`[AgentPageAction] ${action} (${actionId})`)

        this.runAction(action, params, actionId)
        return true
    }

    private async runAction(action: AgentActionType, params: Record<string, any>, actionId: string): Promise<void> {
        try {
            const executor = pageActions[action]
            if (!executor) throw new Error(`Unsupported page action: ${action}`)

            const result = executor(params)
            this.sendResult(actionId, true, result)
        } catch (error: any) {
            Logger.E(`[AgentPageAction] Failed ${action}`, error)
            this.sendResult(actionId, false, undefined, error.message)
        }
    }

    private sendResult(actionId: string, success: boolean, data?: any, error?: string): void {
        window.postMessage({
            source: this.pageType,
            type: RequestPageEventType.REQUEST_AGENT_PAGE_ACTION,
            payload: { actionId, success, data, error },
        }, '*')
    }
}
