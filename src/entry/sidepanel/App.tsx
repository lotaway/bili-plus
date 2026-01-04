import React, { useEffect } from 'react'
import { Provider } from 'react-redux'
import { store } from '../../store/store'
import { loadStateFromStorage, startAutoSave, stopAutoSave } from '../../store/storageManager'
import TabContainer from '../../components/TabContainer'
import Calculator from '../../features/calculator/calculator'
import { VideoSummary } from '../../features/videoSummary/VideoSummary'
import VideoDownload from '../../features/videoDownload/VideoDownload'
import StudyAutomationPanel from '../../features/studyAutomation/StudyAutomationPanel'

const AppContent: React.FC = () => {
  useEffect(() => {
    const initializeApp = async () => {
      const savedState = await loadStateFromStorage()
      if (savedState) {
        console.debug('App state initialized from storage')
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
    <TabContainer tabs={tabs} defaultTab="subtitle" />
  )
}

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  )
}

export default App
