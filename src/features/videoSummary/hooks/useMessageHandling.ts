import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { ChromeMessage } from '../../../types/chrome'
import { MessageType } from '../../../enums/MessageType'
import { SummarizeResponse } from '../../../types/summarize'
import {
  setMessage,
  setDecisionData,
  appendThinkingContent,
  appendMarkdownContent,
  setMarkdownContent,
  setShowDownloadButton,
  setHasUserScrolled
} from '../../../store/slices/videoSummarySlice'

export const useMessageHandling = () => {
  const dispatch = useDispatch()
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

    const handleSummarizeResponseStream = (data: SummarizeResponse) => {
      if ("error" in data) {
        dispatch(setMessage(data.error))
        return
      }
      
      if (data.done) {
        console.debug("Stream ended")
        return
      }
    }

    const handleAssistantResponseStream = (data: any) => {
      if (data.metadata?.type === 'decision_required') {
        dispatch(setDecisionData({
          ...data,
          ...data.metadata,
          reason: data.metadata?.reason || data.reason,
        }))
        return
      }
      if (data.error) {
        dispatch(setMessage(data.error))
        return
      }
      if (data.thinking) {
        dispatch(appendThinkingContent(data.thinking))
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [dispatch])
}
