
import { MessageType } from '../../enums/MessageType'
import { RequestPageEventType } from '../../enums/PageEventType'
import { PageType } from '../../enums/PageType'
import Logger from '../../utils/Logger'

export { }

type ChromeMessageEvent = [message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void]

class HomeContentActivity {
  private isAutomationRunning = false

  @Logger.Mark("HomeContentActivity init")
  init() {
    this.addListener()
    this.injectScript()
  }

  addListener() {
    chrome.runtime.sendMessage({
      type: MessageType.REGISTER_CONTENT_JS,
    }).catch(err => Logger.E(err))
    chrome.runtime.onMessage.addListener(this.handleChromeMessage.bind(this))
    window.addEventListener('message', this.handlerWindowMessage.bind(this))
  }

  handleChromeMessage(...args: ChromeMessageEvent): boolean {
    const [message, sender, sendResponse] = args

    switch (message.type) {
      case MessageType.START_STUDY_AUTOMATION:
        this.handleStartStudyAutomation(...args)
        return true
      case MessageType.STOP_STUDY_AUTOMATION:
        this.handleStopStudyAutomation(...args)
        return true
    }

    return false
  }

  async handleStartStudyAutomation(...args: ChromeMessageEvent) {
    const [message, sender, sendResponse] = args

    Logger.I('[Study Automation] Received start request', message)

    try {
      this.isAutomationRunning = true
      const limitCount = message.payload?.limitCount || 10
      Logger.I('[Study Automation] Starting automation learning, limitCount:', limitCount)
      const result = await this.runStudyAutomation(limitCount)

      Logger.I('[Study Automation] Automation learning completed', result)
      sendResponse({ message: 'Automation learning task submitted', ...result })
    } catch (err: any) {
      Logger.E('[Study Automation] Automation learning failed:', err)
      sendResponse({
        error: err instanceof Error ? err.message : String(err),
        success: false
      })
    }

    return true
  }

  async handleStopStudyAutomation(...args: ChromeMessageEvent) {
    const [message, sender, sendResponse] = args

    Logger.I('[Study Automation] Received stop request')

    try {
      this.isAutomationRunning = false
      sendResponse({ message: 'Automation learning stopped' })
    } catch (err: any) {
      Logger.E('[Study Automation] Failed to stop automation learning:', err)
      sendResponse({
        error: err instanceof Error ? err.message : String(err),
        success: false
      })
    }

    return true
  }

  async runStudyAutomation(limitCount: number) {
    let studyList: any[] = []
    let retryCount = 0
    const MAX_RETRIES = limitCount * 2

    while (studyList.length < limitCount && retryCount < MAX_RETRIES && this.isAutomationRunning) {
      const batch = await this.sendHomePageAction('extractVideosFromPage')

      if (!batch.success || !batch.data || batch.data.length === 0) {
        await this.sendHomePageAction('clickChangeButton')
        await new Promise(r => setTimeout(r, 3000))
        retryCount++
        continue
      }

      const blackList = ['番剧', '动漫', '游戏', '开箱', '日常', 'vlog', '记录', '娱乐']
      const filteredVideos = batch.data.filter((v: any) => {
        const title = v.title.toLowerCase()
        if (title.length < 5) return false
        if (blackList.some(kw => title.includes(kw))) return false
        return true
      })

      const videoAnalysis = await this.analyzeVideosWithLLM(filteredVideos)
      const categorizedVideos = videoAnalysis.filter((item: any) =>
        item.category === 'class' || item.category === 'knowledge'
      )

      studyList.push(...categorizedVideos)
      retryCount++
    }

    studyList.sort((a: any, b: any) => (b.level + b.confidence) - (a.level + a.confidence))
    const finalSelection = studyList.slice(0, limitCount)

    const submittedTasks = []
    for (const item of finalSelection) {
      const studyRequest = await this.submitStudyRequest(item.link)
      submittedTasks.push({ link: item.link, submitted: studyRequest.success })
    }

    return {
      success: true,
      submittedCount: finalSelection.length,
      tasks: submittedTasks
    }
  }

  async sendHomePageAction(action: string, params?: Record<string, any>): Promise<any> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    Logger.D('[Study Automation] Sending page action request:', { action, params, requestId })

    window.postMessage({
      source: PageType.CONTENT_SCRIPT,
      type: RequestPageEventType.REQUEST_HOME_PAGE_ACTION,
      payload: { action, params, requestId }
    }, '*')

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        Logger.E('[Study Automation] Request timeout:', { action, requestId })
        reject(new Error('Request timeout'))
      }, 30000)

      const responseHandler = (event: MessageEvent) => {
        Logger.D('[Study Automation] Received message:', event.data)

        if (
          event.source !== window ||
          event.data?.source !== PageType.HOME_PAGE_INJECT ||
          event.data?.type !== RequestPageEventType.REQUEST_HOME_PAGE_ACTION ||
          event.data?.payload?.requestId !== requestId
        ) {
          return
        }

        clearTimeout(timeout)
        window.removeEventListener('message', responseHandler)

        const payload = event.data.payload
        Logger.I('[Study Automation] Page action response:', payload)

        if (payload.success) {
          resolve(payload.data)
        } else {
          reject(new Error(payload.error || 'Operation failed'))
        }
      }

      window.addEventListener('message', responseHandler)
    })
  }

  async analyzeVideosWithLLM(videos: Array<{ title: string; link: string }>) {
    const prompt = `Please analyze these Bilibili video titles and determine which ones are "tutorials" or "knowledge-based" about real world.
    Return a JSON array of objects with fields: category (class|knowledge), link, level (1-10), confidence (1-10), reason.
    Titles: ${JSON.stringify(videos.map(v => ({ title: v.title, link: v.link })))}`

    try {
      const result = await this.callLLMService(prompt)
      const content = result?.choices?.[0]?.message?.content || ''
      const jsonStr = content.match(/\[.*\]/s)?.[0]
      if (jsonStr) {
        return JSON.parse(jsonStr)
      }
    } catch (e) {
      Logger.E('Failed to parse LLM response', e)
    }
    return []
  }

  async callLLMService(prompt: string): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: MessageType.REQUEST_SUMMARIZE_SUBTITLE,
        payload: { prompt }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve(response)
      })
    })
  }

  async submitStudyRequest(link: string) {
    return new Promise<{ success: boolean }>((resolve) => {
      chrome.runtime.sendMessage({
        type: MessageType.REQUEST_SUMMARIZE_SUBTITLE,
        payload: {
          action: 'submitStudyRequest',
          link,
          platform: 'bilibili'
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          Logger.E('Failed to submit study request:', chrome.runtime.lastError)
          resolve({ success: false })
          return
        }
        resolve(response || { success: true })
      })
    })
  }

  isBilibiliHomepage(): boolean {
    const url = window.location.href
    return url === 'https://www.bilibili.com/' ||
      url === 'http://www.bilibili.com/' ||
      url.startsWith('https://www.bilibili.com/?') ||
      url.startsWith('http://www.bilibili.com/?')
  }

  async handlerWindowMessage(event: MessageEvent) {
    if (
      event.source !== window ||
      event.data?.source !== PageType.HOME_PAGE_INJECT
    ) {
      return
    }

    switch (event.data.type) {
      case RequestPageEventType.HOME_INFO_INIT:
        await chrome.runtime.sendMessage({
          type: MessageType.HOME_INFO_UPDATE,
          payload: event.data.payload,
        })
        break
      case RequestPageEventType.REQUEST_OPEN_SIDE_PANEL:
        chrome.runtime.sendMessage({
          type: MessageType.OPEN_SIDE_PANEL,
        })
        break
      default:
        break
    }
  }

  injectScript() {
    const ID = "home_page_inject"
    const origin = document.getElementById(ID)
    if (origin) {
      document.removeChild(origin)
    }
    const script = document.createElement('script')
    script.id = ID
    const url = chrome.runtime.getURL('assets/home_page_inject.js')
    script.src = url
    document.documentElement.appendChild(script)
  }
}

const activity = new HomeContentActivity()
if (activity.isBilibiliHomepage()) {
  activity.init()
} else {
  Logger.D('[Bilibili Plus] Not homepage, skipping execution')
}

