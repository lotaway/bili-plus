import { useState } from 'react'
import styled from 'styled-components'

// Styled components
const DecisionContainer = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  margin: 10px 0;
`

const DecisionButtons = styled.div`
  display: flex;
  gap: 10px;
  margin: 15px 0;
`

const FeedbackTextarea = styled.textarea`
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.5;
  color: #374151;
  background-color: #ffffff;
  resize: vertical;
  transition: all 0.2s ease-in-out;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }

  &:hover {
    border-color: #9ca3af;
  }
`

const DecisionButton = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
`

const ApproveButton = styled(DecisionButton)`
  background: #28a745;
  color: white;

  &:hover {
    background: #218838;
  }
`

const RejectButton = styled(DecisionButton)`
  background: #dc3545;
  color: white;

  &:hover {
    background: #c82333;
  }
`

interface DecisionData {
  reason: string
  message?: string
  max_iterations?: number
  [key: string]: any
}

interface DecisionPanelProps {
  decisionData?: DecisionData
  onSendDecision: (decision: string, feedback?: string) => void
}

export const DecisionPanel = ({
  decisionData,
  onSendDecision
}: DecisionPanelProps) => {
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)
  const [feedbackInput, setFeedbackInput] = useState('')

  const handleSendDecision = (decision: string, feedback: string = '') => {
    onSendDecision(decision, feedback)
    setShowFeedbackInput(false)
    setFeedbackInput('')
  }

  if (!decisionData) return null

  return (
    <DecisionContainer>
      <h4>⏸️ 需要人工决策</h4>
      <p>
        <strong>原因:</strong>{' '}
        {decisionData.reason || decisionData.message || '需要用户确认'}
      </p>

      {decisionData.reason === 'waiting_human' ? (
        <>
          <p>工作流已暂停，等待您的决策。</p>
          <DecisionButtons>
            <ApproveButton onClick={() => handleSendDecision('approved')}>
              同意继续
            </ApproveButton>
            <RejectButton onClick={() => setShowFeedbackInput(true)}>
              提供反馈
            </RejectButton>
          </DecisionButtons>
          {showFeedbackInput && (
            <div style={{ marginTop: '10px' }}>
              <FeedbackTextarea
                placeholder="请输入您的反馈意见..."
                rows={3}
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
              />
              <button
                style={{ marginTop: '5px' }}
                onClick={() => handleSendDecision('feedback', feedbackInput)}
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
          <DecisionButtons>
            <ApproveButton onClick={() => handleSendDecision('approved')}>
              继续执行
            </ApproveButton>
            <RejectButton onClick={() => handleSendDecision('false')}>
              停止执行
            </RejectButton>
          </DecisionButtons>
        </>
      ) : (
        <>
          <p>需要您的决策才能继续。</p>
          <DecisionButtons>
            <ApproveButton onClick={() => handleSendDecision('approved')}>
              同意
            </ApproveButton>
            <RejectButton onClick={() => setShowFeedbackInput(true)}>
              提供反馈
            </RejectButton>
          </DecisionButtons>
          {showFeedbackInput && (
            <div style={{ marginTop: '10px' }}>
              <FeedbackTextarea
                placeholder="请输入您的反馈意见..."
                rows={3}
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
              />
              <button
                style={{ marginTop: '5px' }}
                onClick={() => handleSendDecision('feedback', feedbackInput)}
              >
                提交反馈
              </button>
            </div>
          )}
        </>
      )}
    </DecisionContainer>
  )
}
