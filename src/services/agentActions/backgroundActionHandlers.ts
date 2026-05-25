import { AgentActionType } from '../../enums/AgentActionType'
import { AgentActionRequest, AgentActionResult, TabInfo } from '../../types/agent'
import { SCREENSHOT_QUALITY } from './constants'

export async function handleGetTabs(request: AgentActionRequest): Promise<AgentActionResult> {
    const chromeTabs = await chrome.tabs.query({})
    const tabs: TabInfo[] = chromeTabs.map(t => ({
        id: t.id!,
        index: t.index,
        windowId: t.windowId,
        title: t.title || '',
        url: t.url || '',
        active: t.active || false,
        pinned: t.pinned || false,
        highlighted: t.highlighted || false,
        incognito: t.incognito || false,
        favIconUrl: t.favIconUrl,
        status: t.status,
    }))

    return {
        actionId: request.actionId,
        success: true,
        data: { tabs, total: tabs.length },
    }
}

export async function handleNavigate(request: AgentActionRequest): Promise<AgentActionResult> {
    const { url, newWindow, newTab } = request.params

    if (!url) {
        return { actionId: request.actionId, success: false, error: 'URL is required' }
    }

    if (newWindow) {
        const window = await chrome.windows.create({ url, focused: true })
        return {
            actionId: request.actionId,
            success: true,
            data: { windowId: window.id, tabId: window.tabs?.[0]?.id, url },
        }
    }

    if (newTab) {
        const tab = await chrome.tabs.create({ url, active: true })
        return {
            actionId: request.actionId,
            success: true,
            data: { tabId: tab.id, url },
        }
    }

    const tabId = request.tabId || await getActiveTabId()
    const tab = await chrome.tabs.update(tabId, { url })
    return {
        actionId: request.actionId,
        success: true,
        data: { tabId: tab.id, url },
    }
}

export async function handleGetCookies(request: AgentActionRequest): Promise<AgentActionResult> {
    const { domain, url, name } = request.params

    let cookies: chrome.cookies.Cookie[]
    if (url) {
        cookies = await chrome.cookies.getAll({ url })
    } else if (domain) {
        cookies = await chrome.cookies.getAll({ domain })
    } else if (name) {
        cookies = await chrome.cookies.getAll({ name })
    } else {
        cookies = await chrome.cookies.getAll({})
    }

    return {
        actionId: request.actionId,
        success: true,
        data: { cookies },
    }
}

export async function handleScreenshot(request: AgentActionRequest): Promise<AgentActionResult> {
    const { tabId: targetTabId } = request.params

    let dataUrl: string
    if (targetTabId) {
        const tab = await chrome.tabs.get(targetTabId)
        dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'png',
            quality: SCREENSHOT_QUALITY,
        })
    } else {
        dataUrl = await chrome.tabs.captureVisibleTab({
            format: 'png',
            quality: SCREENSHOT_QUALITY,
        })
    }

    return {
        actionId: request.actionId,
        success: true,
        data: { dataUrl },
    }
}

export async function getActiveTabId(): Promise<number> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) return tabs[0].id
    throw new Error('No active tab found')
}
