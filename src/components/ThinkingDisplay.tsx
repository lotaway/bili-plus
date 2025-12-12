import styled from 'styled-components'

// Styled components
const ThinkingContainer = styled.div`
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 15px;
`

const ThinkingContent = styled.div`
  max-height: 200px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.4;
  color: #856404;
  background: #fffbf0;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ffeaa7;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
`

interface ThinkingDisplayProps {
  thinkingContent: string
  thinkingContainerRef: React.RefObject<HTMLDivElement>
}

export const ThinkingDisplay = ({
  thinkingContent,
  thinkingContainerRef
}: ThinkingDisplayProps) => {
  if (!thinkingContent) return null

  return (
    <ThinkingContainer>
      <h4>🤔 思考过程</h4>
      <ThinkingContent
        ref={thinkingContainerRef}
        dangerouslySetInnerHTML={{ __html: thinkingContent }}
      />
    </ThinkingContainer>
  )
}
