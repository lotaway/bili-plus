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
`

const TabHeader = styled.div`
  display: flex;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
`

const TabButton = styled.button<{ active: boolean }>`
  padding: 8px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: ${props => props.active ? '#007bff' : '#6c757d'};
  border-bottom: 2px solid ${props => props.active ? '#007bff' : 'transparent'};
  transition: all 0.2s;
  flex: 1;
  text-align: center;
  min-width: 0;

  &:hover {
    background: #e9ecef;
    color: #495057;
  }

  ${props => props.active && `
    background: white;
  `}
`

const TabContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 10px;
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
