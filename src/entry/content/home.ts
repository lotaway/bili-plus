import { MessageType } from '../../enums/MessageType'
import { RequestPageEventType } from '../../enums/PageEventType'
import { PageType } from '../../enums/PageType'
import Logger from '../../utils/Logger'
import { PageActionService } from '../../features/studyAutomation/PageActionService'
import { LLMAnalyzer } from '../../features/studyAutomation/LLMAnalyzer'
import { StudyTaskSubmitter } from '../../features/studyAutomation/StudyTaskSubmitter'
import { StudyAutomationOrchestrator } from '../../features/studyAutomation/StudyAutomationOrchestrator'
import { MessageHandlerStrategy } from '../../features/studyAutomation/MessageHandlerStrategy'
import { LLMResponse } from '../../features/studyAutomation/types'

export { }

type ChromeMessageEvent = [
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
]

class HomeContentActivity {
  private messageHandlerStrategy: MessageHandlerStrategy
  private orchestrator: StudyAutomationOrchestrator

  constructor() {
    this.orchestrator = this.createOrchestrator()
    this.messageHandlerStrategy = new MessageHandlerStrategy(this.orchestrator)
  }

  @Logger.Mark("HomeContentActivity init")
  init(): void {
    this.addListener()
    this.injectScript()
  }

  private createOrchestrator(): StudyAutomationOrchestrator {
    const pageActionService = new PageActionService()
    const llmAnalyzer = new LLMAnalyzer(this.callLLMService.bind(this))
    const taskSubmitter = new StudyTaskSubmitter(
      this.submitStudyRequest.bind(this),
      () => this.orchestrator?.isAutomationRunning() ?? false
    )

    return new StudyAutomationOrchestrator(
      pageActionService,
      llmAnalyzer,
      taskSubmitter
    )
  }

  private addListener(): void {
    this.registerContentScript()
    chrome.runtime.onMessage.addListener(this.handleChromeMessage.bind(this))
    window.addEventListener('message', this.handleWindowMessage.bind(this))
  }

  private registerContentScript(): void {
    chrome.runtime.sendMessage({
      type: MessageType.REGISTER_CONTENT_JS,
    }).catch(err => Logger.E(err))
  }

  private async handleChromeMessage(...args: ChromeMessageEvent): Promise<boolean> {
    return await this.messageHandlerStrategy.handle(...args)
  }

  private async callLLMService(prompt: string): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      let fullContent = ''

      const messageListener = (message: any) => {
        if (message.type === MessageType.ASSISTANT_RESPONSE_STREAM) {
          if (message.data.error) {
            chrome.runtime.onMessage.removeListener(messageListener)
            reject(new Error(message.data.error))
            return
          }

          if (message.data.content) {
            fullContent += message.data.content
          }

          if (message.data.done) {
            chrome.runtime.onMessage.removeListener(messageListener)
            resolve({
              choices: [{
                message: {
                  content: fullContent
                }
              }]
            } as any)
          }
        }
      }

      chrome.runtime.onMessage.addListener(messageListener)

      chrome.runtime.sendMessage({
        type: MessageType.REQUEST_START_ASSISTANT,
        payload: { prompt }
      }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.runtime.onMessage.removeListener(messageListener)
          reject(new Error(chrome.runtime.lastError.message))
        }
      })
    })
  }

  private async submitStudyRequest(link: string): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
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

  private isBilibiliHomepage(): boolean {
    const url = window.location.href
    const validPrefixes = [
      'https://www.bilibili.com/',
      'http://www.bilibili.com/',
      'https://www.bilibili.com/?',
      'http://www.bilibili.com/?'
    ]
    return validPrefixes.some(prefix => url === prefix || url.startsWith(prefix))
  }

  private async handleWindowMessage(event: MessageEvent): Promise<void> {
    if (!this.isValidWindowMessage(event)) {
      return
    }

    switch (event.data.type) {
      case RequestPageEventType.HOME_INFO_INIT:
        await this.handleHomeInfoInit(event.data.payload)
        break
      case RequestPageEventType.REQUEST_OPEN_SIDE_PANEL:
        this.handleOpenSidePanel()
        break
    }
  }

  private isValidWindowMessage(event: MessageEvent): boolean {
    return (
      event.source === window &&
      event.data?.source === PageType.HOME_PAGE_INJECT
    )
  }

  private async handleHomeInfoInit(payload: any): Promise<void> {
    await chrome.runtime.sendMessage({
      type: MessageType.HOME_INFO_UPDATE,
      payload,
    })
  }

  private handleOpenSidePanel(): void {
    chrome.runtime.sendMessage({
      type: MessageType.OPEN_SIDE_PANEL,
    })
  }

  private injectScript(): void {
    const scriptId = "home_page_inject"
    this.removeExistingScript(scriptId)
    this.insertScript(scriptId)
  }

  private removeExistingScript(scriptId: string): void {
    const existingScript = document.getElementById(scriptId)
    if (existingScript) {
      existingScript.remove()
    }
  }

  private insertScript(scriptId: string): void {
    const script = document.createElement('script')
    script.id = scriptId
    script.src = chrome.runtime.getURL('assets/home_page_inject.js')
    document.documentElement.appendChild(script)
  }
}

const activity = new HomeContentActivity()
if (activity['isBilibiliHomepage']()) {
  activity.init()
} else {
  Logger.D('[Bilibili Plus] Not homepage, skipping execution')
}
