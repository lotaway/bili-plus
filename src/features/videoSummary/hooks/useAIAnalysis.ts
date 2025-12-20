import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { AIGenerationAnalyzer } from '../../../services/AIGeneratioinAnalyzer'
import {
  appendThinkingContent,
  appendMarkdownContent,
  setMarkdownContent,
  setShowDownloadButton,
  setHasUserScrolled,
  setAssistantRunning,
  setMessage
} from '../../../store/slices/videoSummarySlice'

export const useAIAnalysis = () => {
  const dispatch = useDispatch()
  const aiGenerationAnalyzerRef = useRef<AIGenerationAnalyzer | null>(null)

  useEffect(() => {
    if (!aiGenerationAnalyzerRef.current) {
      aiGenerationAnalyzerRef.current = new AIGenerationAnalyzer()
    }
    const aiGenerationAnalyzer = aiGenerationAnalyzerRef.current

    const handleAnalyzerOutput = (data: { done: boolean, think: string, content: string }) => {
      if (data.done) {
        if (!data.content || data.content.trim() === '') {
          dispatch(setMessage('无内容'))
          dispatch(setAssistantRunning(false))
          return
        }
        dispatch(appendThinkingContent(data.think))
        dispatch(setMarkdownContent(data.content))
        dispatch(setShowDownloadButton(true))
        dispatch(setHasUserScrolled(false))
        dispatch(setAssistantRunning(false))
        return
      }
      if (data.think) {
        dispatch(appendThinkingContent(data.think))
      }
      if (data.content) {
        dispatch(appendMarkdownContent(data.content))
      }
    }
    const subscriptionId = aiGenerationAnalyzer.subscribe(handleAnalyzerOutput)
    return () => {
      aiGenerationAnalyzer.unsubscribe(subscriptionId)
      aiGenerationAnalyzer.reset()
    }
  }, [dispatch])

  return {
    aiGenerationAnalyzer: aiGenerationAnalyzerRef.current
  }
}
