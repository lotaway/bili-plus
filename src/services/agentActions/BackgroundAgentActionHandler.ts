import { MessageType } from '../../enums/MessageType'
import { AgentActionRequest } from '../../types/agent'
import { AgentActionExecutor } from '../AgentActionExecutor'
import Logger from '../../utils/Logger'

export class BackgroundAgentActionHandler {
    private readonly executor = new AgentActionExecutor()

    setup(): void {
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))
        Logger.I('[BackgroundAgentActionHandler] Registered')
    }

    private async handleMessage(
        message: any,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ): Promise<boolean | void> {
        if (message.type === MessageType.AGENT_ACTION_REQUEST) {
            this.handleActionRequest(message, sendResponse)
            return true
        }

        if (message.type === MessageType.AGENT_ACTION_RESULT) {
            this.executor.handleContentScriptActionResult(message)
            return false
        }
    }

    private async handleActionRequest(
        message: any,
        sendResponse: (response?: any) => void
    ): Promise<void> {
        const request = message.data as AgentActionRequest
        const result = await this.executor.execute(request)
        sendResponse(result)
    }
}
