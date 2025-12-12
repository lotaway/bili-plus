import { DownloadType } from '../enums/DownloadType'
import styled from 'styled-components'

// Styled components
const ActionSection = styled.div`
  display: flex;
  gap: 10px;
  margin: 15px 0;
  flex-wrap: wrap;
`

const ActionButton = styled.button`
  padding: 8px 16px;
  border: 1px solid #007bff;
  background: white;
  color: #007bff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  flex: 1;
  min-width: 120px;

  &:hover {
    background: #007bff;
    color: white;
  }
`

interface ActionButtonsProps {
  onExtract: (mode: DownloadType) => void
  onRequestSummarize: () => void
  onRequestScreenshotSummarize: () => void
}

export const ActionButtons = ({
  onExtract,
  onRequestSummarize,
  onRequestScreenshotSummarize
}: ActionButtonsProps) => {
  return (
    <ActionSection>
      <ActionButton onClick={() => onExtract(DownloadType.SRT)}>
        提取当前视频字幕（含时间戳）
      </ActionButton>
      <ActionButton onClick={() => onExtract(DownloadType.MARKDOWN)}>
        提取当前视频字幕（纯文字）
      </ActionButton>
      <ActionButton onClick={onRequestSummarize}>
        视频知识总结（按照字幕）
      </ActionButton>
      <ActionButton onClick={onRequestScreenshotSummarize}>
        界面总结（截图分析）
      </ActionButton>
    </ActionSection>
  )
}
