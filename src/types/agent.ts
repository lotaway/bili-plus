import { AgentActionType } from '../enums/AgentActionType'

export interface AgentActionRequest {
    actionId: string
    action: AgentActionType
    params: Record<string, any>
    tabId?: number
}

export interface AgentActionResult {
    actionId: string
    success: boolean
    data?: any
    error?: string
}

export interface TabInfo {
    id: number
    index: number
    windowId: number
    title: string
    url: string
    active: boolean
    pinned: boolean
    highlighted: boolean
    incognito: boolean
    favIconUrl?: string
    status?: string
}

export interface PageContentResult {
    textContent: string
    htmlContent?: string
    title: string
    url: string
}

export interface ScriptExecutionResult {
    result: any
}

export interface StorageResult {
    cookies?: chrome.cookies.Cookie[]
    localStorage?: Record<string, string | null>
    sessionStorage?: Record<string, string | null>
}

export interface PageInfoResult {
    title: string
    url: string
    referrer: string
    readyState: string
    contentType: string
    contentLength?: number
}

export interface SelectedTextResult {
    text: string
}

export interface ScreenshotResult {
    dataUrl: string
}

export interface AgentActionCapability {
    type: AgentActionType
    description: string
    requiredParams: string[]
    runsInPage: boolean
}

export const AGENT_ACTION_CAPABILITIES: AgentActionCapability[] = [
    {
        type: AgentActionType.GET_TABS,
        description: '获取所有浏览器标签页信息',
        requiredParams: [],
        runsInPage: false,
    },
    {
        type: AgentActionType.GET_PAGE_CONTENT,
        description: '获取指定页面的文本/HTML内容',
        requiredParams: [],
        runsInPage: true,
    },
    {
        type: AgentActionType.NAVIGATE,
        description: '在浏览器中导航到指定URL（新标签页或当前标签页）',
        requiredParams: ['url'],
        runsInPage: false,
    },
    {
        type: AgentActionType.EXECUTE_SCRIPT,
        description: '在指定页面中执行JavaScript脚本',
        requiredParams: ['code'],
        runsInPage: true,
    },
    {
        type: AgentActionType.GET_COOKIES,
        description: '获取指定域的cookie',
        requiredParams: [],
        runsInPage: false,
    },
    {
        type: AgentActionType.GET_LOCAL_STORAGE,
        description: '获取页面的localStorage数据',
        requiredParams: [],
        runsInPage: true,
    },
    {
        type: AgentActionType.GET_SESSION_STORAGE,
        description: '获取页面的sessionStorage数据',
        requiredParams: [],
        runsInPage: true,
    },
    {
        type: AgentActionType.SCREENSHOT,
        description: '截取当前可见标签页的屏幕截图',
        requiredParams: [],
        runsInPage: false,
    },
    {
        type: AgentActionType.CLICK_ELEMENT,
        description: '点击页面上的指定元素（CSS选择器）',
        requiredParams: ['selector'],
        runsInPage: true,
    },
    {
        type: AgentActionType.GET_PAGE_INFO,
        description: '获取页面的基本信息（URL、标题等）',
        requiredParams: [],
        runsInPage: true,
    },
    {
        type: AgentActionType.GET_SELECTED_TEXT,
        description: '获取页面中当前选中的文本',
        requiredParams: [],
        runsInPage: true,
    },
    {
        type: AgentActionType.FILL_INPUT,
        description: '在页面输入框中填入文本',
        requiredParams: ['selector', 'value'],
        runsInPage: true,
    },
    {
        type: AgentActionType.SCROLL_PAGE,
        description: '滚动页面到指定位置',
        requiredParams: [],
        runsInPage: true,
    },
]
