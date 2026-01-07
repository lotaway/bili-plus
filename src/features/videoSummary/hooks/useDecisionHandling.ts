import { useDispatch } from 'react-redux'
import { LLMProviderManager } from '../../../services/LLMProviderManager'
import { appendMarkdownContent, setMessage } from '../../../store/slices/videoSummarySlice'
import Logger from '../../../utils/Logger'

export const useDecisionHandling = () => {
  const dispatch = useDispatch()
  const sendDecision = async (decision: string, feedback: string = '', decisionData: any) => {
    if (!decisionData) return

    dispatch(appendMarkdownContent('<p>正在处理您的决策...</p>'))

    try {
      const llmProviderManager = new LLMProviderManager()
      await llmProviderManager.init()
      const currentConfig = await llmProviderManager.provider

      if (!currentConfig) {
        throw new Error('没有可用的LLM provider配置')
      }

      const decisionPayload = {
        approved: decision === 'approved',
        feedback: feedback,
        ...decisionData,
      }

      const response = await fetch(`${currentConfig.endpoint}/agents/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentConfig.apiKey ?? ''}`,
        },
        body: JSON.stringify(decisionPayload),
      })

      if (!response.ok) {
        throw new Error(`决策提交失败: ${await response.text()}`)
      }

      dispatch(setMessage('决策已提交，继续处理中...'))
    } catch (error: any) {
      Logger.E('Decision submission error:', error)
      dispatch(setMessage(`决策提交失败: ${error.message}`))
    }
  }

  return {
    sendDecision
  }
}