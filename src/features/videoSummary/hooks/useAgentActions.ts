import { useCallback } from 'react'
import { AgentActionType } from '../../../enums/AgentActionType'
import { MessageType } from '../../../enums/MessageType'
import { AgentActionRequest, AgentActionResult } from '../../../types/agent'
import Logger from '../../../utils/Logger'

interface ActionBinding {
    type: AgentActionType
    params?: Record<string, any>
}

function buildRequest(action: AgentActionType, params: Record<string, any> = {}, tabId?: number): AgentActionRequest {
    return {
        actionId: `sidepanel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        action,
        params,
        tabId,
    }
}

export function useAgentActions() {
    const executeAction = useCallback(async (
        action: AgentActionType,
        params: Record<string, any> = {},
        tabId?: number
    ): Promise<AgentActionResult> => {
        const request = buildRequest(action, params, tabId)
        Logger.I(`[useAgentActions] ${action}`)

        try {
            const result = await chrome.runtime.sendMessage({
                type: MessageType.AGENT_ACTION_REQUEST,
                data: request,
            })
            return result as AgentActionResult
        } catch (error: any) {
            Logger.E(`[useAgentActions] Failed ${action}`, error)
            return {
                actionId: request.actionId,
                success: false,
                error: error.message || String(error),
            }
        }
    }, [])

    const getTabs = useCallback(
        () => executeAction(AgentActionType.GET_TABS),
        [executeAction]
    )

    const getPageContent = useCallback(
        (tabId?: number) => executeAction(AgentActionType.GET_PAGE_CONTENT, {}, tabId),
        [executeAction]
    )

    const navigate = useCallback(
        (url: string, options?: { newWindow?: boolean; newTab?: boolean }) =>
            executeAction(AgentActionType.NAVIGATE, { url, ...options }),
        [executeAction]
    )

    const executeScript = useCallback(
        (code: string, tabId?: number) => executeAction(AgentActionType.EXECUTE_SCRIPT, { code }, tabId),
        [executeAction]
    )

    const getCookies = useCallback(
        (domain?: string) => executeAction(AgentActionType.GET_COOKIES, { domain }),
        [executeAction]
    )

    const getLocalStorage = useCallback(
        (tabId?: number, keys?: string[]) => executeAction(AgentActionType.GET_LOCAL_STORAGE, { keys }, tabId),
        [executeAction]
    )

    const getSessionStorage = useCallback(
        (tabId?: number, keys?: string[]) => executeAction(AgentActionType.GET_SESSION_STORAGE, { keys }, tabId),
        [executeAction]
    )

    const takeScreenshot = useCallback(
        (tabId?: number) => executeAction(AgentActionType.SCREENSHOT, {}, tabId),
        [executeAction]
    )

    const clickElement = useCallback(
        (selector: string, tabId?: number) => executeAction(AgentActionType.CLICK_ELEMENT, { selector }, tabId),
        [executeAction]
    )

    const getPageInfo = useCallback(
        (tabId?: number) => executeAction(AgentActionType.GET_PAGE_INFO, {}, tabId),
        [executeAction]
    )

    const getSelectedText = useCallback(
        (tabId?: number) => executeAction(AgentActionType.GET_SELECTED_TEXT, {}, tabId),
        [executeAction]
    )

    const fillInput = useCallback(
        (selector: string, value: string, tabId?: number) =>
            executeAction(AgentActionType.FILL_INPUT, { selector, value }, tabId),
        [executeAction]
    )

    const scrollPage = useCallback(
        (x?: number, y?: number, tabId?: number) =>
            executeAction(AgentActionType.SCROLL_PAGE, { x, y }, tabId),
        [executeAction]
    )

    return {
        executeAction,
        getTabs,
        getPageContent,
        navigate,
        executeScript,
        getCookies,
        getLocalStorage,
        getSessionStorage,
        takeScreenshot,
        clickElement,
        getPageInfo,
        getSelectedText,
        fillInput,
        scrollPage,
    }
}
