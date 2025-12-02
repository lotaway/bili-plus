import React, { useEffect, useState, useRef } from 'react';

interface DecisionData {
  reason: string;
  message?: string;
  max_iterations?: number;
  [key: string]: any;
}

const App: React.FC = () => {
  const [assistantInput, setAssistantInput] = useState('');
  const [isAssistantRunning, setIsAssistantRunning] = useState(false);
  const [messages, setMessages] = useState<string>(''); // Using string for HTML content to match original behavior
  const [decisionData, setDecisionData] = useState<DecisionData | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  const resultContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'summarize:keepAlive') {
        handleSummarizeKeepAliveMessage(message.data);
      } else if (message.type === 'assistant:keepAlive') {
        handleAssistantKeepAliveMessage(message.data);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const sendMessage = (payload: any): Promise<any> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, resolve);
    });
  };

  const setMessage = (msg: string) => {
    // In React, we might want to just append to messages or replace.
    // The original code used textContent = msg for simple messages, 
    // and innerHTML += for stream content.
    // I'll use a simple state for the "status" message area if I separate them,
    // but the original used one container for everything.
    // For compatibility, I'll just clear and set content.
    setMessages(msg);
    setDecisionData(null); // Clear decision UI on new message
  };

  const appendMessage = (content: string) => {
    setMessages((prev) => prev + content);
  };

  const handleExtract = async (mode: 'srt' | 'md') => {
    setMessage('正在提取字幕...');
    const res = await sendMessage({
      type: 'fetchSubtitles',
      payload: { mode },
    });

    if (res?.error) {
      setMessage(res.error);
      return;
    }

    let downloadId = -1;
    if (mode === 'md' || mode === 'srt') {
      const ext = mode === 'md' ? 'md' : 'srt';
      const textData = text2url(res.data, mode);
      try {
        downloadId = await downloadFile(
          textData.url,
          `${res.bvid}-${res.cid}.${ext}`
        );
      } finally {
        textData.destory();
      }
    }
    setMessage(`字幕提取完成:${downloadId}`);
  };

  const handleSummarize = async () => {
    setMessage('正在使用AI处理字幕...');
    const res = await sendMessage({ type: 'summarize' });
    if (res?.error) {
      setMessage(res.error);
      return;
    }
    // Note: The original code had logic for requireDownload=false but called it with no args (false).
    // So it just returns after sending message? 
    // Wait, the original code: 
    // async summarize(requireDownload = false) { ... if (!requireDownload) return ... }
    // And the event listener: () => this.summarize()
    // So it defaults to false, and just sends the message. 
    // The actual result comes back via 'summarize:keepAlive'.
  };

  const handleAssistantStart = async () => {
    if (!assistantInput.trim()) {
      setMessage('请输入您的问题或指令');
      return;
    }
    if (isAssistantRunning) {
      setMessage('AI智能体正在运行中，请先停止当前任务');
      return;
    }

    setMessage('正在启动AI智能体...');
    setIsAssistantRunning(true);

    try {
      await sendMessage({
        type: 'startAssistant',
        payload: { message: assistantInput.trim() },
      });
    } catch (error) {
      console.error('启动AI智能体失败:', error);
      setMessage('启动AI智能体失败，请重试');
      setIsAssistantRunning(false);
    }
  };

  const handleAssistantStop = async () => {
    if (!isAssistantRunning) return;

    setMessage('正在停止AI智能体...');
    try {
      await sendMessage({ type: 'stopAssistant' });
    } catch (error) {
      console.error('停止AI智能体失败:', error);
    } finally {
      setIsAssistantRunning(false);
      setMessage('AI智能体已停止');
    }
  };

  const text2url = (text: string, fileType: string) => {
    const fileType2MediaType: Record<string, string> = {
      txt: 'text/plain',
      md: 'text/markdown',
      xmd: 'text/x-markdown',
      srt: 'application/x-subrip',
    };
    const blob = new Blob([text], {
      type: fileType2MediaType[fileType] || 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    return {
      url,
      destory: () => URL.revokeObjectURL(url),
    };
  };

  const downloadFile = async (url: string, filename: string) => {
    return await chrome.downloads.download({
      url,
      filename,
      conflictAction: 'uniquify',
      saveAs: false,
    });
  };

  const handleSummarizeKeepAliveMessage = (data: any) => {
    if (data.error) {
      setMessage(data.error);
      return;
    }
    if (data.done && data.content) {
      setMessages(renderMarkdown(data.data));
      return;
    }
    if (data.content) {
      appendMessage(data.content);
    }
  };

  const handleAssistantKeepAliveMessage = (data: any) => {
    if (data.metadata?.type === 'decision_required') {
      setDecisionData({
        ...data,
        ...data.metadata,
        reason: data.metadata?.reason || data.reason,
      });
      return;
    }

    if (data.error) {
      setMessage(data.error);
      return;
    }
    if (data.done && data.content) {
      setMessages(data.data); // Assuming data.data is HTML or final text
      return;
    }
    if (data.content) {
      appendMessage(data.content);
    }
  };

  const sendDecision = async (decision: string, feedback: string = '') => {
    if (!decisionData) return;
    
    // Optimistic update or loading state could be added here
    appendMessage('<p>正在处理您的决策...</p>');
    setDecisionData(null); // Hide decision UI
    setShowFeedbackInput(false);
    setFeedbackInput('');

    try {
      const config = await chrome.storage.sync.get([
        'aiProvider',
        'aiEndpoint',
        'aiKey',
      ]);

      if (!config.aiEndpoint) {
        throw new Error('请先配置AI服务');
      }

      const decisionPayload = {
        approved: decision === 'approved',
        feedback: feedback,
        ...decisionData,
      };

      const response = await fetch(`${config.aiEndpoint}/agents/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.aiKey ?? ''}`,
        },
        body: JSON.stringify(decisionPayload),
      });

      if (!response.ok) {
        throw new Error(`决策提交失败: ${await response.text()}`);
      }

      setMessages((prev) => prev + '<p>决策已提交，继续处理中...</p>');
    } catch (error: any) {
      console.error('Decision submission error:', error);
      setMessages((prev) => prev + `<p style="color: red;">决策提交失败: ${error.message}</p>`);
    }
  };

  const renderMarkdown = (text: string) => {
    // Simple replacement as in original code
    return text
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div className="sidepane-container">
      <h3>字幕生成</h3>
      <div className="action-section">
        <button id="extract" onClick={() => handleExtract('srt')}>
          提取当前视频字幕（含时间戳）
        </button>
        <button id="extract-only-text" onClick={() => handleExtract('md')}>
          提取当前视频字幕（纯文字）
        </button>
        <button id="summary" onClick={handleSummarize}>
          视频知识总结
        </button>
      </div>

      <div className="assistant-section">
        <div className="assistant-input">
          <textarea
            id="assistant-input"
            placeholder="请输入您的问题或指令..."
            rows={3}
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

      <div
        id="result-container"
        className="result-container"
        ref={resultContainerRef}
        dangerouslySetInnerHTML={{ __html: messages }}
      />

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
  );
};

export default App;
