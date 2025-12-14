import React from 'react'
import TabContainer from '../../components/TabContainer'
import Calculator from '../../features/calculator/calculator'
import { VideoSummary } from '../../features/videoSummary/VideoSummary'
import VideoDownload from '../../features/videoDownload/VideoDownload'

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
        },
        {
            id: 'download',
            label: '视频下载',
            content: <VideoDownload />
        }
    ]

    return (
        <TabContainer tabs={tabs} defaultTab="subtitle" />
    )
}

export default App
