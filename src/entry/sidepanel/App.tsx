import React, { useEffect, useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { MessageType } from '../../enums/MessageType'
import { DownloadType } from '../../enums/DownloadType'
import { SummarizeResponse } from '../../types/summarize'
import { LLM_Runner } from '../../services/LLM_Runner'
import { ParsingState } from '../../enums/ParseState'
import { AIGenerationAnalyzer } from '../../services/AIGeneratioinAnalyzer'
import { ChromeMessage } from '../../types/chrome'
import { FileUtils } from '../../utils/FileUtils'

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

const App: React.FC = () => {
  const [assistantInput, setAssistantInput] = useState('')
  const [isAssistantRunning, setIsAssistantRunning] = useState(false)
  const [outputContent, setOutputContent] = useState<OutputContent>({ markdown: '', thinking: '' })
  const [decisionData, setDecisionData] = useState<DecisionData | null>(null)
  const [feedbackInput, setFeedbackInput] = useState('')
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)
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
  const scrollTimeoutRef = useRef<number>()

  useEffect(() => {
    const scrollToBottom = () => {
      if (resultContainerRef.current && !hasUserScrolled) {
        resultContainerRef.current.scrollTop = resultContainerRef.current.scrollHeight
      }
      if (thinkingContainerRef.current) {
        thinkingContainerRef.current.scrollTop = thinkingContainerRef.current.scrollHeight
      }
    }

    scrollToBottom()
  }, [outputContent.markdown, outputContent.thinking, messages, hasUserScrolled])

  useEffect(() => {
    const container = resultContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      scrollTimeoutRef.current = setTimeout(() => {
        const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10
        setHasUserScrolled(!isAtBottom)
      }, 100)
    }

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])
  
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
  }, [])
  const sendMessage = (payload: any): Promise<any> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, resolve)
    })
  }

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
    setOutputContent((prev) => {
      return {
        ...prev,
        markdown: prev.markdown + content,
      }
    })
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

  const handleExtract = async (mode: DownloadType) => {
    // clearOoutput()
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
    // setMessage('已经完成字幕的AI处理')
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

  const handleAssistantStart = async () => {
    if (!assistantInput.trim()) {
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
        payload: { message: assistantInput.trim() },
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

  const aiGenerationAnalyzer = new AIGenerationAnalyzer()
  const handleSummarizeResponseStream = (data: SummarizeResponse) => {
    if ("error" in data) {
      setMessage(data.error)
      return
    }

    if (data.done) {
      console.debug("Stream ended")
      setMarkdownContent(data.content)
      parsingStateRef.current = {
        currentBuffer: '',
        state: ParsingState.FREE,
        thinkingBuffer: '',
        markdownBuffer: ''
      }
      return
    }
    if (data.content) {
      let content = data.content
      parsingStateRef.current.currentBuffer += content
      while (parsingStateRef.current.currentBuffer.length > 0) {
        if (parsingStateRef.current.state === ParsingState.FREE) {
          let thinkingStartIndex = parsingStateRef.current.currentBuffer.indexOf(aiGenerationAnalyzer.START_THINK_TAG)
          const thinkingEndIndex = parsingStateRef.current.currentBuffer.indexOf(aiGenerationAnalyzer.END_THINK_TAG)

          if (thinkingEndIndex !== -1 && (thinkingStartIndex === -1 || thinkingEndIndex < thinkingStartIndex)) {
            thinkingStartIndex = 0
            const contentBefore = parsingStateRef.current.currentBuffer.substring(thinkingStartIndex, thinkingEndIndex)
            setOutputContent(prev => ({ ...prev, markdown: '', thinking: prev.thinking + prev.markdown + contentBefore }))
            setHasUserScrolled(false)
            parsingStateRef.current.currentBuffer = parsingStateRef.current.currentBuffer.substring(thinkingEndIndex + aiGenerationAnalyzer.END_THINK_TAG.length)
            continue
          }
          const markdownStartIndex = parsingStateRef.current.currentBuffer.indexOf(aiGenerationAnalyzer.START_MARKDOWN_TAG)
          if (thinkingStartIndex !== -1 && (markdownStartIndex === -1 || thinkingStartIndex < markdownStartIndex)) {
            parsingStateRef.current.state = ParsingState.THINKING
            parsingStateRef.current.currentBuffer = parsingStateRef.current.currentBuffer.substring(thinkingStartIndex + aiGenerationAnalyzer.START_THINK_TAG.length)
          } else if (markdownStartIndex !== -1) {
            parsingStateRef.current.state = ParsingState.GENERATING
            parsingStateRef.current.currentBuffer = parsingStateRef.current.currentBuffer.substring(markdownStartIndex + aiGenerationAnalyzer.START_MARKDOWN_TAG.length)
          } else {
            appendMarkdownContent(parsingStateRef.current.currentBuffer)
            parsingStateRef.current.currentBuffer = ''
          }
        }
        if (parsingStateRef.current.state === ParsingState.THINKING) {
          const thinkingEnd = parsingStateRef.current.currentBuffer.indexOf(aiGenerationAnalyzer.END_THINK_TAG)
          if (thinkingEnd !== -1) {
            parsingStateRef.current.thinkingBuffer += parsingStateRef.current.currentBuffer.substring(0, thinkingEnd)
            appendThinkingContent(parsingStateRef.current.thinkingBuffer)
            parsingStateRef.current.thinkingBuffer = ''
            parsingStateRef.current.state = ParsingState.FREE
            parsingStateRef.current.currentBuffer = parsingStateRef.current.currentBuffer.substring(thinkingEnd + aiGenerationAnalyzer.END_THINK_TAG.length)
          } else {
            parsingStateRef.current.thinkingBuffer += parsingStateRef.current.currentBuffer
            parsingStateRef.current.currentBuffer = ''
          }
        }
        if (parsingStateRef.current.state === ParsingState.GENERATING) {
          const markdownEnd = parsingStateRef.current.currentBuffer.indexOf(aiGenerationAnalyzer.END_MARKDOWN_TAG)
          if (markdownEnd !== -1) {
            parsingStateRef.current.markdownBuffer += parsingStateRef.current.currentBuffer.substring(0, markdownEnd)
            appendMarkdownContent(parsingStateRef.current.markdownBuffer)
            parsingStateRef.current.markdownBuffer = ''
            parsingStateRef.current.state = ParsingState.FREE
            parsingStateRef.current.currentBuffer = parsingStateRef.current.currentBuffer.substring(markdownEnd + aiGenerationAnalyzer.END_MARKDOWN_TAG.length)
          } else {
            parsingStateRef.current.markdownBuffer += parsingStateRef.current.currentBuffer
            parsingStateRef.current.currentBuffer = ''
          }
        }
      }
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
      if (data.data) {
        setMarkdownContent(data.data)
      } else {
        setMarkdownContent(data.content)
      }
      return
    }
    if (data.content && !data.thinking) {
      appendMarkdownContent(data.content)
    }
  }

  const sendDecision = async (decision: string, feedback: string = '') => {
    if (!decisionData)
      return
    appendMarkdownContent('<p>正在处理您的决策...</p>')
    setDecisionData(null)
    setShowFeedbackInput(false)
    setFeedbackInput('')
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
      setMessages((prev) => prev + '<p>决策已提交，继续处理中...</p>')
    } catch (error: any) {
      console.error('Decision submission error:', error)
      setMessages((prev) => prev + `<p style="color: red;">决策提交失败: ${error.message}</p>`)
    }
  }

  return (
    <div className="sidepane-container">
      <h3>字幕生成</h3>
      <div className="action-section">
        <button id="extract" onClick={() => handleExtract(DownloadType.SRT)}>
          提取当前视频字幕（含时间戳）
        </button>
        <button id="extract-only-text" onClick={() => handleExtract(DownloadType.MARKDOWN)}>
          提取当前视频字幕（纯文字）
        </button>
        <button onClick={handleRequestSummarize}>
          视频知识总结（按照字幕）
        </button>
        <button onClick={handleRequestScreenshotSummarize}>
          界面总结（截图分析）
        </button>
      </div>
      <div className="output-section">
        {outputContent.thinking && (
          <div className="thinking-container">
            <h4>🤔 思考过程</h4>
            <div
              ref={thinkingContainerRef}
              className="thinking-content"
              dangerouslySetInnerHTML={{ __html: outputContent.thinking }}
            />
          </div>
        )}
        <div className="result-section">
          <div className="result-header">
            <h4>📝 输出结果</h4>
          </div>
          {outputContent.markdown && <div
            className="result-container"
            ref={resultContainerRef}
          >
            <ReactMarkdown>{outputContent.markdown}</ReactMarkdown>
          </div>}
          {messages && <div
            className="result-container"
          >{messages}</div>}
          {showDownloadButton && outputContent.markdown && (
            <button
              className="download-btn"
              onClick={handleDownloadMarkdown}
              title="下载Markdown文件"
            >
              下载
            </button>
          )}
        </div>
        <div className="assistant-section">
          <div className="assistant-input">
            <textarea
              placeholder="请输入您的问题或指令..."
              rows={6}
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
            />
            <div className="assistant-buttons">
              {!isAssistantRunning ? (
                <button id="assistant-start" onClick={handleAssistantStart}>
                  助手启动
                </button>
              ) : (
                <button id="assistant-stop" onClick={handleAssistantStop}>
                  停止
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {decisionData && (
        <div className="decision-container current-decision-ui">
          <h4>⏸️ 需要人工决策</h4>
          <p>
            <strong>原因:</strong>{' '}
            {decisionData.reason || decisionData.message || '需要用户确认'}
          </p>

          {decisionData.reason === 'waiting_human' ? (
            <>
              <p>工作流已暂停，等待您的决策。</p>
              <div className="decision-buttons">
                <button
                  className="decision-btn approve-btn"
                  onClick={() => sendDecision('approved')}
                >
                  同意继续
                </button>
                <button
                  className="decision-btn reject-btn"
                  onClick={() => setShowFeedbackInput(true)}
                >
                  提供反馈
                </button>
              </div>
              {showFeedbackInput && (
                <div className="feedback-input" style={{ marginTop: '10px' }}>
                  <textarea
                    id="feedback-text"
                    placeholder="请输入您的反馈意见..."
                    rows={3}
                    style={{ width: '100%' }}
                    value={feedbackInput}
                    onChange={(e) => setFeedbackInput(e.target.value)}
                  />
                  <button
                    id="submit-feedback"
                    style={{ marginTop: '5px' }}
                    onClick={() => sendDecision('feedback', feedbackInput)}
                  >
                    提交反馈
                  </button>
                </div>
              )}
            </>
          ) : decisionData.reason === 'max_iterations' ? (
            <>
              <p>
                已达到最大迭代次数 ({decisionData.max_iterations})，请决定是否继续。
              </p>
              <div className="decision-buttons">
                <button
                  className="decision-btn approve-btn"
                  onClick={() => sendDecision('approved')}
                >
                  继续执行
                </button>
                <button
                  className="decision-btn reject-btn"
                  onClick={() => sendDecision('false')}
                >
                  停止执行
                </button>
              </div>
            </>
          ) : (
            <>
              <p>需要您的决策才能继续。</p>
              <div className="decision-buttons">
                <button
                  className="decision-btn approve-btn"
                  onClick={() => sendDecision('approved')}
                >
                  同意
                </button>
                <button
                  className="decision-btn reject-btn"
                  onClick={() => sendDecision('false')}
                >
                  拒绝
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default App
