import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { ChromeMessage } from '../../../types/chrome'
import { MessageType } from '../../../enums/MessageType'
import { AgentResponse, AgentRuntimeStatus, SummarizeResponse } from '../../../types/summarize'
import {
  setMessage,
  setDecisionData,
  appendThinkingContent,
  appendMarkdownContent,
  setMarkdownContent,
  setShowDownloadButton,
  setHasUserScrolled,
} from '../../../store/slices/videoSummarySlice'
import { AIGenerationAnalyzer } from '../../../services/AIGeneratioinAnalyzer'

export const useMessageHandling = () => {
  const dispatch = useDispatch()
  const aiAnalyzerRef = useRef<AIGenerationAnalyzer | null>(null)

  useEffect(() => {
    if (!aiAnalyzerRef.current) {
      aiAnalyzerRef.current = new AIGenerationAnalyzer()
    }
    const aiAnalyzer = aiAnalyzerRef.current

    const handleAnalyzerOutput = (data: { done: boolean, think: string, content: string }) => {
      if (data.done) {
        if (data.think) {
          dispatch(appendThinkingContent(data.think))
        }
        if (data.content) {
          dispatch(setMarkdownContent(data.content))
        }
        dispatch(setShowDownloadButton(true))
        dispatch(setHasUserScrolled(false))
        return
      }
      if (data.think) {
        dispatch(appendThinkingContent(data.think))
      }
      if (data.content) {
        dispatch(appendMarkdownContent(data.content))
      }
    }

    const subscriptionId = aiAnalyzer.subscribe(handleAnalyzerOutput)

    const handleMessage = (message: ChromeMessage) => {
      switch (message.type) {
        case MessageType.SUMMARIZE_SUBTITLE_RESPONSE_STREAM:
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
        if (data.content && aiAnalyzer) {
          aiAnalyzer.reset()
          aiAnalyzer.inputStream(data.content)
        }
        return
      }
      if (data.content && aiAnalyzer) {
        aiAnalyzer.inputStream(data.content)
      }
    }

    const handleAssistantResponseStream = (data: AgentResponse) => {
      if ("error" in data) {
        dispatch(setMessage(data.error))
        return
      }
      if (data.status === AgentRuntimeStatus.WAITING_HUMAN) {
        const message = data.history[data.history.length - 1]
        dispatch(setDecisionData({
          ...data,
          ...message.data.metadata,
          reason: message?.data.prompt ?? data.status,
        }))
        return
      }
      if (data.done) {
        console.debug("Stream ended")
        if (data.content && aiAnalyzer) {
          aiAnalyzer.reset()
          aiAnalyzer.inputStream(data.content)
        }
        return
      }
      if (data.content && aiAnalyzer) {
        aiAnalyzer.inputStream(data.content)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      aiAnalyzer.unsubscribe(subscriptionId)
      aiAnalyzer.reset()
    }
  }, [dispatch])
}
