import { useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useMessageHandling } from './hooks/useMessageHandling'
import { useScrollManagement } from './hooks/useScrollManagement'
import { useDecisionHandling } from './hooks/useDecisionHandling'
import styled from 'styled-components'
import {
  setAssistantRunning,
  setMessage,
  clearOutput,
  setDecisionData,
  setHasUserScrolled,
} from '../../store/slices/videoSummarySlice'
import { RootState } from '../../store/store'

const SidepaneContainer = styled.div`
  padding: 10px;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
`

const OutputSection = styled.div`
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

import { ActionButtons } from '../../components/ActionButtons'
import { ThinkingDisplay } from '../../components/ThinkingDisplay'
import { ResultDisplay } from '../../components/ResultDisplay'
import { AssistantInput } from '../../components/AssistantInput'
import { DecisionPanel } from '../../components/DecisionPanel'

import { MessageType } from '../../enums/MessageType'
import { DownloadType } from '../../enums/DownloadType'
import { FileUtils } from '../../utils/FileUtils'
import Logger from '../../utils/Logger'

export const VideoSummary = () => {
  const dispatch = useDispatch()
  const {
    isAssistantRunning,
    outputContent,
    decisionData,
    messages,
    showDownloadButton,
    hasUserScrolled
  } = useSelector((state: RootState) => state.videoSummary)

  const resultContainerRef = useRef<HTMLDivElement>(null)
  const thinkingContainerRef = useRef<HTMLDivElement>(null)
  const setMessageWithScrollReset = (msg: string) => {
    dispatch(setMessage(msg))
    dispatch(setHasUserScrolled(false))
  }

  const handleExtract = async (mode: DownloadType) => {
    setMessageWithScrollReset('正在提取字幕...')
    const res = await chrome.runtime.sendMessage({
      type: MessageType.REQUEST_FETCH_SUBTITLE,
      payload: { mode },
    })

    if (res?.error) {
      setMessageWithScrollReset(res.error)
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
    setMessageWithScrollReset(`字幕提取完成:${downloadId}`)
  }

  const handleRequestSubtitleSummarize = async () => {
    dispatch(clearOutput())
    clearAnaylazeContent()
    setMessageWithScrollReset('正在使用AI处理字幕...')
    const res = await chrome.runtime.sendMessage({ type: MessageType.REQUEST_SUMMARIZE_SUBTITLE })
    if (res?.error) {
      setMessageWithScrollReset(res.error)
      return
    }
  }

  const handleRequestScreenshotSummarize = async () => {
    dispatch(clearOutput())
    setMessageWithScrollReset('正在截取屏幕...')
    try {
      const screenshotDataUrl = await chrome.tabs.captureVisibleTab({
        format: 'png',
        quality: 80
      })
      setMessageWithScrollReset('正在使用AI分析界面...')
      const res = await chrome.runtime.sendMessage({
        type: MessageType.REQUEST_SUMMARIZE_SCREENSHOT,
        payload: { screenshot: screenshotDataUrl }
      })
      if (res?.error) {
        setMessageWithScrollReset(res.error)
        return
      }
    } catch (error) {
      Logger.E('截图失败:', error)
      setMessageWithScrollReset('截图失败，请重试')
    }
  }

  const handleAssistantStart = async (input: string) => {
    if (!input.trim()) {
      setMessageWithScrollReset('请输入您的问题或指令')
      return
    }
    if (isAssistantRunning) {
      setMessageWithScrollReset('AI智能体正在运行中，请先停止当前任务')
      return
    }

    setMessageWithScrollReset('正在启动AI智能体...')
    dispatch(setAssistantRunning(true))

    try {
      await chrome.runtime.sendMessage({
        type: MessageType.REQUEST_START_ASSISTANT,
        payload: { message: input.trim() },
      })
    } catch (error) {
      Logger.E('启动AI智能体失败:', error)
      setMessageWithScrollReset('启动AI智能体失败，请重试')
      dispatch(setAssistantRunning(false))
    }
  }

  const handleAssistantStop = async () => {
    if (!isAssistantRunning) return

    setMessageWithScrollReset('正在停止AI智能体...')
    try {
      await chrome.runtime.sendMessage({ type: MessageType.REQUEST_STOP_ASSISTANT })
    } catch (error) {
      Logger.E('停止AI智能体失败:', error)
    } finally {
      dispatch(setAssistantRunning(false))
      setMessageWithScrollReset('AI智能体已停止')
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

  const { clearAnaylazeContent } = useMessageHandling()
  // const clearAnaylazeContent = () => {}

  useScrollManagement(resultContainerRef, thinkingContainerRef)

  const { sendDecision } = useDecisionHandling()

  const handleSendDecision = (decision: string, feedback: string = '') => {
    sendDecision(decision, feedback, decisionData)
    dispatch(setDecisionData(null))
  }

  return (
    <SidepaneContainer>
      <h3>字幕生成</h3>

      <ActionButtons
        onExtract={handleExtract}
        onRequestSummarize={handleRequestSubtitleSummarize}
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
