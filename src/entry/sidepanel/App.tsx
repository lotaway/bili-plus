import React, { useEffect, useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { MessageType } from '../../enums/MessageType'
import { DownloadType } from '../../enums/DownloadType'
import { SummarizeResponse } from '../../types/summarize'
import { LLM_Runner } from '../../services/LLM_Runner'

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

  const [parsingState, setParsingState] = useState({
    currentBuffer: '',
    inThinking: false,
    inMarkdown: false,
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
    const handleMessage = (message: any) => {
      if (message.type === MessageType.SUMMARIZE_RESPONSE_STREAM) {
        handleSummarizeResponseStream(message.data)
      } else if (message.type === MessageType.ASSISTANT_RESPONSE_STREAM) {
        handleAssistantResponseStream(message.data)
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
      const textData = text2url(res.data, mode)
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
    setMessage('已经完成字幕的AI处理')
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
        type: 'startAssistant',
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
      await sendMessage({ type: 'stopAssistant' })
    } catch (error) {
      console.error('停止AI智能体失败:', error)
    } finally {
      setIsAssistantRunning(false)
      setMessage('AI智能体已停止')
    }
  }

  const text2url = (text: string, fileType: DownloadType) => {
    const fileType2MediaType: Record<DownloadType, string> = {
      [DownloadType.TEXT]: 'text/plain',
      [DownloadType.MARKDOWN]: 'text/markdown',
      [DownloadType.XMARKDOWN]: 'text/x-markdown',
      [DownloadType.SRT]: 'application/x-subrip',
    }
    const blob = new Blob([text], {
      type: fileType2MediaType[fileType] || 'text/plain',
    })
    const url = URL.createObjectURL(blob)
    return {
      url,
      destory: () => URL.revokeObjectURL(url),
    }
  }

  const handleDownloadMarkdown = () => {
    if (!outputContent.markdown) return

    const textData = text2url(outputContent.markdown, DownloadType.MARKDOWN)
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

  const handleSummarizeResponseStream = (data: SummarizeResponse) => {
    if ("error" in data) {
      setMessage(data.error)
      return
    }

    if (data.done) {
      console.info("Stream ended")
      const matchs = new RegExp(/```markdown([\s\S]+?)```/).exec(data.content)
      setMarkdownContent(matchs ? matchs[1] : data.content)
      setParsingState({
        currentBuffer: '',
        inThinking: false,
        inMarkdown: false,
        thinkingBuffer: '',
        markdownBuffer: ''
      })
      return
    }
    if (data.content) {
      let content = data.content
      let newState = { ...parsingState }
      newState.currentBuffer += content
      while (newState.currentBuffer.length > 0) {
        if (!newState.inThinking && !newState.inMarkdown) {
          const thinkingStart = newState.currentBuffer.indexOf('<thinking>')
          const markdownStart = newState.currentBuffer.indexOf('```markdown')
          if (thinkingStart !== -1 && (markdownStart === -1 || thinkingStart < markdownStart)) {
            newState.inThinking = true
            newState.currentBuffer = newState.currentBuffer.substring(thinkingStart + 10)
          } else if (markdownStart !== -1) {
            newState.inMarkdown = true
            newState.currentBuffer = newState.currentBuffer.substring(markdownStart + 11)
          } else {
            appendMarkdownContent(newState.currentBuffer)
            newState.currentBuffer = ''
          }
        } else if (newState.inThinking) {
          const thinkingEnd = newState.currentBuffer.indexOf('</thinking>')
          if (thinkingEnd !== -1) {
            newState.thinkingBuffer += newState.currentBuffer.substring(0, thinkingEnd)
            appendThinkingContent(newState.thinkingBuffer)
            newState.thinkingBuffer = ''
            newState.inThinking = false
            newState.currentBuffer = newState.currentBuffer.substring(thinkingEnd + 11)
          } else {
            newState.thinkingBuffer += newState.currentBuffer
            newState.currentBuffer = ''
          }
        } else if (newState.inMarkdown) {
          const markdownEnd = newState.currentBuffer.indexOf('```')
          if (markdownEnd !== -1) {
            newState.markdownBuffer += newState.currentBuffer.substring(0, markdownEnd)
            appendMarkdownContent(newState.markdownBuffer)
            newState.markdownBuffer = ''
            newState.inMarkdown = false
            newState.currentBuffer = newState.currentBuffer.substring(markdownEnd + 3)
          } else {
            newState.markdownBuffer += newState.currentBuffer
            newState.currentBuffer = ''
          }
        }
      }
      setParsingState(newState)
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
        <button id="summary" onClick={handleRequestSummarize}>
          视频知识总结
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
