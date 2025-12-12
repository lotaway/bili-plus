import React from 'react'
import TabContainer from '../../components/TabContainer'
import Calculator from '../../features/calculator/calculator'
import { VideoSummary } from '../../features/videoSummary/VideoSummary'

const App: React.FC = () => {
    const tabs = [
        {
            id: 'subtitle',
            label: '字幕生成',
            content: <VideoSummary />
        },
        {
            id: 'calculator',
            label: '贷款计算器',
            content: <Calculator />
        }
    ]

    return (
        <TabContainer tabs={tabs} defaultTab="subtitle" />
    )
}

export default App
