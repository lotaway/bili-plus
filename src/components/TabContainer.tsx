import React, { ReactNode } from 'react'
import styled from 'styled-components'

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface TabContainerProps {
  tabs: Tab[]
  defaultTab?: string
}

const TabContainerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #d8e8f6;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 22px rgba(24, 85, 133, 0.08);
`

const TabHeader = styled.div`
  display: flex;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid #e2eef8;
  background: linear-gradient(135deg, #f8fcff 0%, #eef6ff 100%);
`

const TabButton = styled.button<{ active: boolean }>`
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: ${props => props.active ? 'linear-gradient(135deg, #1a91d8 0%, #0f74bc 100%)' : 'transparent'};
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.active ? '#ffffff' : '#4f6f8b'};
  transition: all 0.2s ease;
  flex: 1;
  text-align: center;
  min-width: 0;

  &:hover {
    background: ${props => props.active ? 'linear-gradient(135deg, #1a91d8 0%, #0f74bc 100%)' : '#e6f1fb'};
    color: ${props => props.active ? '#ffffff' : '#335977'};
  }

  ${props => props.active && `
    box-shadow: 0 8px 16px rgba(15, 116, 188, 0.26);
  `}
`

const TabContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: linear-gradient(180deg, #fbfdff 0%, #f5faff 100%);
`

const TabContainer: React.FC<TabContainerProps> = ({ tabs, defaultTab }) => {
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id)

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content

  return (
    <TabContainerWrapper>
      <TabHeader>
        {tabs.map(tab => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </TabButton>
        ))}
      </TabHeader>
      <TabContent>
        {activeTabContent}
      </TabContent>
    </TabContainerWrapper>
  )
}

export default TabContainer
