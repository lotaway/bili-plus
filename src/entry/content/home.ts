import { MessageType } from '../../enums/MessageType'
import { RequestPageEventType } from '../../enums/PageEventType'
import { PageType } from '../../enums/PageType'
import { ContentAgentActionBridge } from '../../services/agentActions/ContentAgentActionBridge'
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
  private readonly agentActionBridge = new ContentAgentActionBridge('HomeContent')

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
    this.agentActionBridge.setup()
  }

  private registerContentScript(): void {
    chrome.runtime.sendMessage({
      type: MessageType.REGISTER_CONTENT_JS,
    }).catch(err => Logger.E(err))
  }

  private async handleChromeMessage(...args: ChromeMessageEvent): Promise<boolean> {
    return await this.messageHandlerStrategy.handle(...args)
  }