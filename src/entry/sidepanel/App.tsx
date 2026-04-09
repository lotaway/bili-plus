import React, { useEffect } from 'react'
import { Provider } from 'react-redux'
import { store } from '../../store/store'
import { loadStateFromStorage, startAutoSave, stopAutoSave } from '../../store/storageManager'
import TabContainer from '../../components/TabContainer'
import Calculator from '../../features/calculator/calculator'
import { VideoSummary } from '../../features/videoSummary/VideoSummary'
import VideoDownload from '../../features/videoDownload/VideoDownload'
import StudyAutomationPanel from '../../features/studyAutomation/StudyAutomationPanel'
import Logger from '../../utils/Logger'
import { SidepanelGlobalStyle } from './sidepanelStyles'

const AppContent: React.FC = () => {
  useEffect(() => {
    const initializeApp = async () => {
      const savedState = await loadStateFromStorage()
      if (savedState) {
        Logger.D('App state initialized from storage')
      }
      startAutoSave()
    }

    initializeApp()

    return () => {
      stopAutoSave()
    }
  }, [])

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
    },
    {
      id: 'study',
      label: '自动学习',
      content: <StudyAutomationPanel />
    }
  ]

  return (
    <div className="sidepanel-shell">
      <header className="sidepanel-header">
        <p className="sidepanel-kicker">BILI PLUS</p>
        <h2>智能工具面板</h2>
        <p className="sidepanel-subtitle">字幕、下载、学习与计算能力统一在一个工作区</p>
      </header>
      <main className="sidepanel-main">
        <TabContainer tabs={tabs} defaultTab="subtitle" />
      </main>
    </div>
  )
}

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <SidepanelGlobalStyle />
      <AppContent />
    </Provider>
  )
}

export default App
