import { AgentActionType } from '../enums/AgentActionType'
import { AgentActionRequest, AgentActionResult } from '../types/agent'
import { handleGetTabs, handleNavigate, handleGetCookies, handleScreenshot } from './agentActions/backgroundActionHandlers'
import {
    handleGetPageContent,
    handleExecuteScript,
    handleGetLocalStorage,
    handleGetSessionStorage,
    handleClickElement,
    handleGetPageInfo,
    handleGetSelectedText,
    handleFillInput,
    handleScrollPage,
    resolvePendingResult,
} from './agentActions/pageScriptActionHandlers'
import Logger from '../utils/Logger'

type ActionHandler = (request: AgentActionRequest) => Promise<AgentActionResult>

function registerHandlers(): Map<AgentActionType, ActionHandler> {
    const handlers = new Map<AgentActionType, ActionHandler>()
    handlers.set(AgentActionType.GET_TABS, handleGetTabs)
    handlers.set(AgentActionType.NAVIGATE, handleNavigate)
    handlers.set(AgentActionType.GET_COOKIES, handleGetCookies)
    handlers.set(AgentActionType.SCREENSHOT, handleScreenshot)
    handlers.set(AgentActionType.GET_PAGE_CONTENT, handleGetPageContent)
    handlers.set(AgentActionType.EXECUTE_SCRIPT, handleExecuteScript)
    handlers.set(AgentActionType.GET_LOCAL_STORAGE, handleGetLocalStorage)
    handlers.set(AgentActionType.GET_SESSION_STORAGE, handleGetSessionStorage)
    handlers.set(AgentActionType.CLICK_ELEMENT, handleClickElement)
    handlers.set(AgentActionType.GET_PAGE_INFO, handleGetPageInfo)
    handlers.set(AgentActionType.GET_SELECTED_TEXT, handleGetSelectedText)
    handlers.set(AgentActionType.FILL_INPUT, handleFillInput)
    handlers.set(AgentActionType.SCROLL_PAGE, handleScrollPage)
    return handlers
}

export class AgentActionExecutor {
    private readonly handlers = registerHandlers()

    async execute(request: AgentActionRequest): Promise<AgentActionResult> {
        const handler = this.handlers.get(request.action)
        if (!handler) {
            return {
                actionId: request.actionId,
                success: false,
                error: `Unknown action type: ${request.action}`,
            }
        }

        Logger.I(`[AgentActionExecutor] ${request.action} (${request.actionId})`)
        try {
            const result = await handler(request)
            Logger.I(`[AgentActionExecutor] Completed ${request.action} (${request.actionId})`)
            return result
        } catch (error: any) {
            Logger.E(`[AgentActionExecutor] Failed ${request.action}`, error)
            return {
                actionId: request.actionId,
                success: false,
                error: error.message || String(error),
            }
        }
    }

    handleContentScriptActionResult(message: any): boolean {
        return resolvePendingResult(message)
    }

    getActionList(): AgentActionType[] {
        return Array.from(this.handlers.keys())
    }
}
