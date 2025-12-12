import { useRef, useState } from 'react'
import { useMessageHandling } from './hooks/useMessageHandling'
import { useScrollManagement } from './hooks/useScrollManagement'
import { useAIAnalysis } from './hooks/useAIAnalysis'
import { useDecisionHandling } from './hooks/useDecisionHandling'
import styled from 'styled-components'

const SidepaneContainer = styled.div`
  padding: 15px;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
`

const OutputSection = styled.div`
  margin: 15px 0;
  display: flex;
  flex-direction: column;
  gap: 15px;
`

import { ActionButtons } from '../../components/ActionButtons'
import { ThinkingDisplay } from '../../components/ThinkingDisplay'
import { ResultDisplay } from '../../components/ResultDisplay'
import { AssistantInput } from '../../components/AssistantInput'
import { DecisionPanel } from '../../components/DecisionPanel'

import { MessageType } from '../../enums/MessageType'
import { DownloadType } from '../../enums/DownloadType'
import { SummarizeResponse } from '../../types/summarize'
import { FileUtils } from '../../utils/FileUtils'
import { ParsingState } from '../../enums/ParseState'

interface DecisionData {
  reason: string
  message?: string
  max_iterations?: number
  [key: string]: any
}

interface OutputContent {
  markdown: string
  thinking: string
}

export const VideoSummary = () => {
  const [isAssistantRunning, setIsAssistantRunning] = useState(false)
  const [outputContent, setOutputContent] = useState<OutputContent>({ markdown: '', thinking: '' })
  const [decisionData, setDecisionData] = useState<DecisionData | null>(null)
  const [hasUserScrolled, setHasUserScrolled] = useState(false)
  const [messages, setMessages] = useState('')
  const [showDownloadButton, setShowDownloadButton] = useState(false)

  const parsingStateRef = useRef({
    currentBuffer: '',
    state: ParsingState.FREE,
    thinkingBuffer: '',
    markdownBuffer: ''
  })

  const resultContainerRef = useRef<HTMLDivElement>(null)
  const thinkingContainerRef = useRef<HTMLDivElement>(null)

  const setMessage = (msg: string) => {
    setMessages(msg)
    setHasUserScrolled(false)
  }

  const clearOutput = () => {
    setMessages("")
    setOutputContent({ markdown: '', thinking: '' })
    setShowDownloadButton(false)
    setDecisionData(null)
    parsingStateRef.current = {
      currentBuffer: '',
      state: ParsingState.FREE,
      thinkingBuffer: '',
      markdownBuffer: ''
    }
  }

  const appendMarkdownContent = (content: string) => {
    setOutputContent((prev) => ({
      ...prev,
      markdown: prev.markdown + content,
    }))
    setHasUserScrolled(false)
  }

  const setMarkdownContent = (content: string) => {
    setOutputContent(prev => ({ ...prev, markdown: content }))
    setMessages('')
    setShowDownloadButton(true)
    setHasUserScrolled(false)
  }

  const appendThinkingContent = (content: string) => {
    setOutputContent(prev => ({ ...prev, thinking: prev.thinking + content }))
    setHasUserScrolled(false)
  }

  const handleSummarizeResponseStream = (data: SummarizeResponse) => {
    if ("error" in data) {
      setMessage(data.error)
      return
    }

    if (data.done) {
      console.debug("Stream ended")
      if (data.content && aiGenerationAnalyzer) {
        aiGenerationAnalyzer.reset()
        aiGenerationAnalyzer.inputStream(data.content)
      }
      parsingStateRef.current = {
        currentBuffer: '',
        state: ParsingState.FREE,
        thinkingBuffer: '',
        markdownBuffer: ''
      }
      return
    }
    if (data.content && aiGenerationAnalyzer) {
      aiGenerationAnalyzer.inputStream(data.content)
    }
  }

  const handleAssistantResponseStream = (data: any) => {
    if (data.metadata?.type === 'decision_required') {
      setDecisionData({
        ...data,
        ...data.metadata,
        reason: data.metadata?.reason || data.reason,
      })
      return
    }
    if (data.error) {
      setMessage(data.error)
      return
    }
    if (data.thinking) {
      appendThinkingContent(data.thinking)
    }

    if (data.done && data.content) {
      if (data.data && aiGenerationAnalyzer) {
        aiGenerationAnalyzer.inputStream(data.data)
      } else if (aiGenerationAnalyzer) {
        aiGenerationAnalyzer.inputStream(data.content)
      }
      return
    }
    if (data.content && !data.thinking && aiGenerationAnalyzer) {
      aiGenerationAnalyzer.inputStream(data.content)
    }
  }

  const handleExtract = async (mode: DownloadType) => {
    setMessage('正在提取字幕...')
    const res = await sendMessage({
      type: MessageType.REQUEST_FETCH_SUBTITLE,
      payload: { mode },
    })

    if (res?.error) {
      setMessage(res.error)
      return
    }

    let downloadId = -1
    if (mode === DownloadType.MARKDOWN || mode === DownloadType.SRT) {
      const ext = mode === DownloadType.MARKDOWN ? DownloadType.MARKDOWN : DownloadType.SRT
      const textData = FileUtils.text2url(res.data, mode)
      try {
        downloadId = await downloadFile(
          textData.url,
          `${res.bvid}-${res.cid}.${ext}`
        )
      } finally {
        textData.destory()
      }
    }
    setMessage(`字幕提取完成:${downloadId}`)
  }

  const handleRequestSummarize = async () => {
    clearOutput()
    setMessage('正在使用AI处理字幕...')
    const res = await sendMessage({ type: MessageType.REQUEST_SUMMARIZE })
    if (res?.error) {
      setMessage(res.error)
      return
    }
  }

  const handleRequestScreenshotSummarize = async () => {
    clearOutput()
    setMessage('正在截取屏幕...')
    try {
      const screenshotDataUrl = await chrome.tabs.captureVisibleTab({
        format: 'png',
        quality: 80
      })
      setMessage('正在使用AI分析界面...')
      const res = await sendMessage({
        type: MessageType.REQUEST_SUMMARIZE_SCREENSHOT,
        payload: { screenshot: screenshotDataUrl }
      })
      if (res?.error) {
        setMessage(res.error)
        return
      }
    } catch (error) {
      console.error('截图失败:', error)
      setMessage('截图失败，请重试')
    }
  }

  const handleAssistantStart = async (input: string) => {
    if (!input.trim()) {
      setMessage('请输入您的问题或指令')
      return
    }
    if (isAssistantRunning) {
      setMessage('AI智能体正在运行中，请先停止当前任务')
      return
    }

    setMessage('正在启动AI智能体...')
    setIsAssistantRunning(true)

    try {
      await sendMessage({
        type: MessageType.REQUEST_START_ASSISTANT,
        payload: { message: input.trim() },
      })
    } catch (error) {
      console.error('启动AI智能体失败:', error)
      setMessage('启动AI智能体失败，请重试')
      setIsAssistantRunning(false)
    }
  }

  const handleAssistantStop = async () => {
    if (!isAssistantRunning) return

    setMessage('正在停止AI智能体...')
    try {
      await sendMessage({ type: MessageType.REQUEST_STOP_ASSISTANT })
    } catch (error) {
      console.error('停止AI智能体失败:', error)
    } finally {
      setIsAssistantRunning(false)
      setMessage('AI智能体已停止')
    }
  }

  const handleDownloadMarkdown = () => {
    if (!outputContent.markdown) return

    const textData = FileUtils.text2url(outputContent.markdown, DownloadType.MARKDOWN)
    const filename = `ai-summary-${Date.now()}.md`

    downloadFile(textData.url, filename).then(() => {
      textData.destory()
    })
  }

  const downloadFile = async (url: string, filename: string) => {
    return await chrome.downloads.download({
      url,
      filename,
      conflictAction: 'uniquify',
      saveAs: false,
    })
  }

  const sendMessage = (payload: any): Promise<any> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, resolve)
    })
  }

  // Custom hooks
  const { aiGenerationAnalyzer } = useAIAnalysis({
    appendThinkingContent,
    appendMarkdownContent,
    setMarkdownContent,
    setShowDownloadButton,
    setHasUserScrolled
  })

  useMessageHandling({
    handleSummarizeResponseStream,
    handleAssistantResponseStream
  })

  useScrollManagement({
    resultContainerRef,
    thinkingContainerRef,
    hasUserScrolled,
    setHasUserScrolled,
    dependencies: [outputContent.markdown, outputContent.thinking, messages, hasUserScrolled]
  })

  const { sendDecision } = useDecisionHandling({
    appendMarkdownContent,
    setMessages
  })

  const handleSendDecision = (decision: string, feedback: string = '') => {
    sendDecision(decision, feedback, decisionData)
    setDecisionData(null)
  }

  return (
    <SidepaneContainer>
      <h3>字幕生成</h3>
      
      <ActionButtons
        onExtract={handleExtract}
        onRequestSummarize={handleRequestSummarize}
        onRequestScreenshotSummarize={handleRequestScreenshotSummarize}
      />
      
      <OutputSection>
        <ThinkingDisplay
          thinkingContent={outputContent.thinking}
          thinkingContainerRef={thinkingContainerRef}
        />
        
        <ResultDisplay
          markdownContent={outputContent.markdown}
          messages={messages}
          showDownloadButton={showDownloadButton}
          resultContainerRef={resultContainerRef}
          onDownloadMarkdown={handleDownloadMarkdown}
        />
        
        <AssistantInput
          isAssistantRunning={isAssistantRunning}
          onAssistantStart={handleAssistantStart}
          onAssistantStop={handleAssistantStop}
        />
      </OutputSection>

      <DecisionPanel
        decisionData={decisionData ?? undefined}
        onSendDecision={handleSendDecision}
      />
    </SidepaneContainer>
  )
}
