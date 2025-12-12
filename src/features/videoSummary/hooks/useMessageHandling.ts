import { useEffect } from 'react'
import { ChromeMessage } from '../../../types/chrome'
import { MessageType } from '../../../enums/MessageType'
import { SummarizeResponse } from '../../../types/summarize'

interface UseMessageHandlingProps {
  handleSummarizeResponseStream: (data: SummarizeResponse) => void
  handleAssistantResponseStream: (data: any) => void
}

export const useMessageHandling = ({
  handleSummarizeResponseStream,
  handleAssistantResponseStream
}: UseMessageHandlingProps) => {
  useEffect(() => {
    const handleMessage = (message: ChromeMessage) => {
      switch (message.type) {
        case MessageType.SUMMARIZE_RESPONSE_STREAM:
        case MessageType.SUMMARIZE_SCREENSHOT_RESPONSE_STREAM:
          handleSummarizeResponseStream(message.data)
          break
        case MessageType.ASSISTANT_RESPONSE_STREAM:
          handleAssistantResponseStream(message.data)
          break
        default:
          // 其他消息类型暂不处理
          break
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [handleSummarizeResponseStream, handleAssistantResponseStream])
}
