import { useEffect, useRef } from 'react'
import { AIGenerationAnalyzer } from '../../../services/AIGeneratioinAnalyzer'

interface UseAIAnalysisProps {
  appendThinkingContent: (content: string) => void
  appendMarkdownContent: (content: string) => void
  setMarkdownContent: (content: string) => void
  setShowDownloadButton: (show: boolean) => void
  setHasUserScrolled: (scrolled: boolean) => void
}

export const useAIAnalysis = ({
  appendThinkingContent,
  appendMarkdownContent,
  setMarkdownContent,
  setShowDownloadButton,
  setHasUserScrolled
}: UseAIAnalysisProps) => {
  const aiGenerationAnalyzerRef = useRef<AIGenerationAnalyzer | null>(null)

  useEffect(() => {
    if (!aiGenerationAnalyzerRef.current) {
      aiGenerationAnalyzerRef.current = new AIGenerationAnalyzer()
    }
    const aiGenerationAnalyzer = aiGenerationAnalyzerRef.current
    
    const handleAnalyzerOutput = (data: { done: boolean, think: string, content: string }) => {
      if (data.done) {
        appendThinkingContent(data.think)
        setMarkdownContent(data.content)
        setShowDownloadButton(true)
        setHasUserScrolled(false)
        return
      }
      if (data.think) {
        appendThinkingContent(data.think)
      }
      if (data.content) {
        appendMarkdownContent(data.content)
      }
    }
    
    const subscriptionId = aiGenerationAnalyzer.subscribe(handleAnalyzerOutput)
    return () => {
      aiGenerationAnalyzer.unsubscribe(subscriptionId)
      aiGenerationAnalyzer.reset()
    }
  }, [
    appendThinkingContent,
    appendMarkdownContent,
    setMarkdownContent,
    setShowDownloadButton,
    setHasUserScrolled
  ])

  return {
    aiGenerationAnalyzer: aiGenerationAnalyzerRef.current
  }
}
