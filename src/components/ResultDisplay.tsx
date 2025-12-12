import ReactMarkdown from 'react-markdown'
import styled from 'styled-components'

// Styled components
const ResultSection = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
`

const ResultHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`

const ResultContainer = styled.div`
  max-height: 300px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.5;
  color: #495057;
  background: white;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ced4da;
  word-break: break-all;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
`

const DownloadButton = styled.button`
  padding: 6px 12px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;

  &:hover {
    background: #218838;
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
`

interface ResultDisplayProps {
  markdownContent: string
  messages: string
  showDownloadButton: boolean
  resultContainerRef: React.RefObject<HTMLDivElement>
  onDownloadMarkdown: () => void
}

export const ResultDisplay = ({
  markdownContent,
  messages,
  showDownloadButton,
  resultContainerRef,
  onDownloadMarkdown
}: ResultDisplayProps) => {
  return (
    <ResultSection>
      <ResultHeader>
        <h4>📝 输出结果</h4>
      </ResultHeader>
      {markdownContent && (
        <ResultContainer ref={resultContainerRef}>
          <ReactMarkdown>{markdownContent}</ReactMarkdown>
        </ResultContainer>
      )}
      {messages && <ResultContainer>{messages}</ResultContainer>}
      {showDownloadButton && markdownContent && (
        <DownloadButton
          onClick={onDownloadMarkdown}
          title="下载Markdown文件"
        >
          下载
        </DownloadButton>
      )}
    </ResultSection>
  )
}
