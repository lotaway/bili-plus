import Logger from '../../utils/Logger'
import { MessageType } from '../../enums/MessageType'
import { LOG_PREFIX } from './constants'
import { StudyAutomationOrchestrator } from './StudyAutomationOrchestrator'

type ChromeMessageEvent = [
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
]

interface MessageHandler {
    handle(...args: ChromeMessageEvent): Promise<boolean>
}

class StartStudyAutomationHandler implements MessageHandler {
    constructor(private orchestrator: StudyAutomationOrchestrator) { }

    async handle(...args: ChromeMessageEvent): Promise<boolean> {
        const [message, sender, sendResponse] = args

        Logger.I(`${LOG_PREFIX} Received start request`, message)

        try {
            const limitCount = message.payload?.limitCount || 10
            Logger.I(`${LOG_PREFIX} Starting automation learning, limitCount:`, limitCount)

            sendResponse({ message: 'Automation learning task submitted' })

            this.orchestrator.run(limitCount).then(result => {
                Logger.I(`${LOG_PREFIX} Automation learning completed`, result)
                if (sender.id) {
                    chrome.runtime.sendMessage(sender.id, {
                        type: MessageType.STUDY_AUTOMATION_RESPONSE,
                        data: result
                    })
                }
            }).catch(err => {
                Logger.E(`${LOG_PREFIX} Automation learning failed:`, err)
                if (sender.id) {
                    chrome.runtime.sendMessage(sender.id, {
                        type: MessageType.STUDY_AUTOMATION_RESPONSE,
                        data: {
                            error: err instanceof Error ? err.message : String(err),
                            success: false
                        }
                    })
                }
            })
        } catch (err: any) {
            Logger.E(`${LOG_PREFIX} Automation learning failed:`, err)
            sendResponse({
                error: err instanceof Error ? err.message : String(err),
                success: false
            })
        }

        return true
    }
}

class StopStudyAutomationHandler implements MessageHandler {
    constructor(private orchestrator: StudyAutomationOrchestrator) { }

    async handle(...args: ChromeMessageEvent): Promise<boolean> {
        const [, , sendResponse] = args

        Logger.I(`${LOG_PREFIX} Received stop request`)

        try {
            this.orchestrator.stop()
            sendResponse({ message: 'Automation learning stopped' })
        } catch (err: any) {
            Logger.E(`${LOG_PREFIX} Failed to stop automation learning:`, err)
            sendResponse({
                error: err instanceof Error ? err.message : String(err),
                success: false
            })
        }

        return true
    }
}

export class MessageHandlerStrategy {
    private handlers: Map<MessageType, MessageHandler>

    constructor(orchestrator: StudyAutomationOrchestrator) {
        this.handlers = new Map<MessageType, MessageHandler>()
        this.handlers.set(MessageType.START_STUDY_AUTOMATION, new StartStudyAutomationHandler(orchestrator))
        this.handlers.set(MessageType.STOP_STUDY_AUTOMATION, new StopStudyAutomationHandler(orchestrator))
    }

    async handle(...args: ChromeMessageEvent): Promise<boolean> {
        const [message] = args
        const handler = this.handlers.get(message.type)

        if (!handler) {
            return false
        }

        return handler.handle(...args)
    }
}
