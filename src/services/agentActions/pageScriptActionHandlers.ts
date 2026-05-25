import { AgentActionType } from '../../enums/AgentActionType'
import { AgentActionRequest, AgentActionResult } from '../../types/agent'
import { MessageType } from '../../enums/MessageType'
import { PAGE_ACTION_TIMEOUT } from './constants'

type PendingResult = {
    resolve: (result: AgentActionResult) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
}

const pendingResults = new Map<string, PendingResult>()

export function resolvePendingResult(message: any): boolean {
    if (message.type !== MessageType.AGENT_ACTION_RESULT) return false

    const result = message.data as AgentActionResult
    const pending = pendingResults.get(result.actionId)
    if (!pending) return false

    clearTimeout(pending.timer)
    pendingResults.delete(result.actionId)
    pending.resolve(result)
    return true
}

function executeWithFallback(
    tabId: number,
    request: AgentActionRequest,
    scriptFn: () => Promise<AgentActionResult>,
): Promise<AgentActionResult> {
    return scriptFn().catch(() => sendMessageToTab(tabId, request))
}

function sendMessageToTab(tabId: number, request: AgentActionRequest): Promise<AgentActionResult> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingResults.delete(request.actionId)
            reject(new Error(`Page action timed out: ${request.action}`))
        }, PAGE_ACTION_TIMEOUT)

        pendingResults.set(request.actionId, { resolve, reject, timer })

        chrome.tabs.sendMessage(tabId, {
            type: MessageType.AGENT_ACTION_REQUEST,
            data: request,
        }).catch((error) => {
            clearTimeout(timer)
            pendingResults.delete(request.actionId)
            reject(new Error(`Failed to send message to tab ${tabId}: ${error.message}`))
        })
    })
}

function buildResponse(request: AgentActionRequest, data: any): AgentActionResult {
    return { actionId: request.actionId, success: true, data }
}

function buildError(request: AgentActionRequest, error: string): AgentActionResult {
    return { actionId: request.actionId, success: false, error }
}

async function injectAndExecute(
    tabId: number,
    request: AgentActionRequest,
    func: Function,
    args: any[] = []
): Promise<AgentActionResult> {
    return executeWithFallback(tabId, request, async () => {
        const result = await chrome.scripting.executeScript({
            target: { tabId },
            func: func as (...args: any[]) => any,
            args,
        })
        return buildResponse(request, result[0]?.result)
    })
}

export async function handleGetPageContent(request: AgentActionRequest): Promise<AgentActionResult> {
    const tabId = await getTabId(request)
    return injectAndExecute(tabId, request, () => ({
        textContent: document.body?.innerText || '',
        htmlContent: document.documentElement?.outerHTML || '',
        title: document.title,
        url: window.location.href,
    }))
}

export async function handleExecuteScript(request: AgentActionRequest): Promise<AgentActionResult> {
    const { code } = request.params
    if (!code) return buildError(request, 'Script code is required')

    const tabId = await getTabId(request)
    return injectAndExecute(tabId, request, (code: string) => new Function(code)(), [code])
}

export async function handleGetLocalStorage(request: AgentActionRequest): Promise<AgentActionResult> {
    const tabId = await getTabId(request)
    return injectAndExecute(tabId, request, (keys?: string[]) => getStorageItems(window.localStorage, keys), [request.params.keys])
}

export async function handleGetSessionStorage(request: AgentActionRequest): Promise<AgentActionResult> {
    const tabId = await getTabId(request)
    return injectAndExecute(tabId, request, (keys?: string[]) => getStorageItems(window.sessionStorage, keys), [request.params.keys])
}

export async function handleClickElement(request: AgentActionRequest): Promise<AgentActionResult> {
    const { selector } = request.params
    if (!selector) return buildError(request, 'Selector is required')

    const tabId = await getTabId(request)
    return injectAndExecute(tabId, request, (sel: string) => {
        const element = document.querySelector(sel)
        if (!element) throw new Error(`Element not found: ${sel}`)
        if (element instanceof HTMLElement) {
            element.click()
        } else {
            element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        }
        return { clicked: true, selector: sel }
    }, [selector])
}

export async function handleGetPageInfo(request: AgentActionRequest): Promise<AgentActionResult> {
    const tabId = await getTabId(request)
    return injectAndExecute(tabId, request, () => ({
        title: document.title,
        url: window.location.href,
        referrer: document.referrer,
        readyState: document.readyState,
        contentType: document.contentType,
        characterSet: document.characterSet,
        cookieEnabled: navigator.cookieEnabled,
        language: navigator.language,
        documentElement: {
            clientWidth: document.documentElement.clientWidth,
            clientHeight: document.documentElement.clientHeight,
            scrollWidth: document.documentElement.scrollWidth,
            scrollHeight: document.documentElement.scrollHeight,
        },
    }))
}

export async function handleGetSelectedText(request: AgentActionRequest): Promise<AgentActionResult> {
    const tabId = await getTabId(request)
    return injectAndExecute(tabId, request, () => window.getSelection()?.toString() || '')
}

export async function handleFillInput(request: AgentActionRequest): Promise<AgentActionResult> {
    const { selector, value } = request.params
    if (!selector || value === undefined) return buildError(request, 'Selector and value are required')

    const tabId = await getTabId(request)
    return injectAndExecute(tabId, request, (sel: string, val: string) => {
        const element = document.querySelector(sel)
        if (!element) throw new Error(`Input element not found: ${sel}`)
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
            setter?.call(element, val)
            element.dispatchEvent(new Event('input', { bubbles: true }))
            element.dispatchEvent(new Event('change', { bubbles: true }))
        } else if (element instanceof HTMLElement && element.isContentEditable) {
            element.textContent = val
            element.dispatchEvent(new Event('input', { bubbles: true }))
        } else {
            throw new Error(`Element is not input or contentEditable: ${sel}`)
        }
        return { filled: true, selector: sel }
    }, [selector, value])
}

export async function handleScrollPage(request: AgentActionRequest): Promise<AgentActionResult> {
    const tabId = await getTabId(request)
    const { x, y, behavior } = request.params

    return injectAndExecute(tabId, request,
        (scrollX: number, scrollY: number, scrollBehavior: string) => {
            window.scrollTo({ left: scrollX, top: scrollY, behavior: (scrollBehavior as ScrollBehavior) || 'smooth' })
            return true
        },
        [x || 0, y || 0, behavior || 'smooth']
    )
}

function getStorageItems(storage: Storage, keys?: string[]): Record<string, string | null> {
    const items: Record<string, string | null> = {}
    if (keys && keys.length > 0) {
        for (const key of keys) {
            items[key] = storage.getItem(key)
        }
    } else {
        for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i)
            if (k !== null) items[k] = storage.getItem(k)
        }
    }
    return items
}

async function getTabId(request: AgentActionRequest): Promise<number> {
    if (request.tabId) return request.tabId
    return getActiveTabId()
}

async function getActiveTabId(): Promise<number> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) return tabs[0].id
    throw new Error('No active tab found')
}
