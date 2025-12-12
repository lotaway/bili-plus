import { LLM_Runner } from '../../../services/LLM_Runner'

interface UseDecisionHandlingProps {
  appendMarkdownContent: (content: string | ((prev: string) => string)) => void
  setMessages: (messages: string | ((prev: string) => string)) => void
}

export const useDecisionHandling = ({
  appendMarkdownContent,
  setMessages
}: UseDecisionHandlingProps) => {
  const sendDecision = async (decision: string, feedback: string = '', decisionData: any) => {
    if (!decisionData) return

    appendMarkdownContent('<p>正在处理您的决策...</p>')

    try {
      const llmRunner = new LLM_Runner()
      const result = await llmRunner.init()
      if (result.error) {
        throw result.error
      }

      const decisionPayload = {
        approved: decision === 'approved',
        feedback: feedback,
        ...decisionData,
      }

      const response = await fetch(`${llmRunner.config.aiEndpoint}/agents/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${llmRunner.config.aiKey ?? ''}`,
        },
        body: JSON.stringify(decisionPayload),
      })

      if (!response.ok) {
        throw new Error(`决策提交失败: ${await response.text()}`)
      }

      setMessages(prev => prev + '<p>决策已提交，继续处理中...</p>')
    } catch (error: any) {
      console.error('Decision submission error:', error)
      setMessages(prev => prev + `<p style="color: red;">决策提交失败: ${error.message}</p>`)
    }
  }

  return {
    sendDecision
  }
}
