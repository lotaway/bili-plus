import { useState } from 'react'
import styled from 'styled-components'

// Styled components
const AssistantSection = styled.div`
  margin: 15px 0 0 0;
  position: sticky;
  bottom: 0;
  background: white;
  padding: 10px 0;
  border-top: 1px solid #e9ecef;
`

const StyledAssistantInput = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
`

const AssistantButtons = styled.div`
  display: flex;
  gap: 10px;
`

const AssistantButton = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
`

const StartButton = styled(AssistantButton)`
  background: #007bff;
  color: white;

  &:hover {
    background: #0056b3;
  }
`

const StopButton = styled(AssistantButton)`
  background: #dc3545;
  color: white;

  &:hover {
    background: #c82333;
  }
`

interface AssistantInputProps {
  isAssistantRunning: boolean
  onAssistantStart: (input: string) => void
  onAssistantStop: () => void
}

export const AssistantInput = ({
  isAssistantRunning,
  onAssistantStart,
  onAssistantStop
}: AssistantInputProps) => {
  const [assistantInput, setAssistantInput] = useState('')

  const handleStart = () => {
    onAssistantStart(assistantInput)
  }

  const handleStop = () => {
    onAssistantStop()
  }

  return (
    <AssistantSection>
      <StyledAssistantInput>
        <textarea
          placeholder="请输入您的问题或指令..."
          rows={6}
          value={assistantInput}
          onChange={(e) => setAssistantInput(e.target.value)}
        />
        <AssistantButtons>
          {!isAssistantRunning ? (
            <StartButton onClick={handleStart}>
              助手启动
            </StartButton>
          ) : (
            <StopButton onClick={handleStop}>
              停止
            </StopButton>
          )}
        </AssistantButtons>
      </StyledAssistantInput>
    </AssistantSection>
  )
}
