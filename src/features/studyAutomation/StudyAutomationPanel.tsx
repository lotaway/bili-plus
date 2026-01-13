import React, { useState } from 'react'
import styled from 'styled-components'
import { MessageType } from '../../enums/MessageType'

const Container = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Button = styled.button`
  padding: 10px 16px;
  background-color: #00aeec;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`

const StatusText = styled.div<{ error?: boolean }>`
  color: ${props => props.error ? '#f44336' : '#4caf50'};
  font-size: 14px;
`

const StudyAutomationPanel: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const stopAutomation = async () => {
    setLoading(true)
    setStatus('正在停止自动化学习机...')
    setError(null)

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        throw new Error('未找到活动标签页')
      }

      const preError = chrome.runtime.lastError
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: MessageType.STOP_STUDY_AUTOMATION
      })
      if (chrome.runtime.lastError && preError !== chrome.runtime.lastError) {
        setError(`停止失败：${chrome.runtime.lastError.message}`)
        setLoading(false)
        return
      }

      if (response?.error) {
        setError(response.error)
      } else {
        setStatus('自动化学习已停止')
        setIsRunning(false)
      }
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleButtonClick = async () => {
    if (isRunning) {
      await stopAutomation()
    } else {
      await startAutomation()
    }
  }

  const startAutomation = async () => {
    setLoading(true)
    setStatus('正在启动自动化学习机...')
    setError(null)

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        throw new Error('未找到活动标签页')
      }

      if (!tab.url?.includes('bilibili.com')) {
        setStatus('请先前往 Bilibili 首页或视频页')
        setLoading(false)
        return
      }

      const preError = chrome.runtime.lastError
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: MessageType.START_STUDY_AUTOMATION
      })
      if (chrome.runtime.lastError && preError !== chrome.runtime.lastError) {
        setError(`请先刷新 Bilibili 页面：${chrome.runtime.lastError.message}`)
        setLoading(false)
        return
      }

      if (response?.error) {
        setError(response.error)
        setIsRunning(false)
      } else if (response?.success === false) {
        setError(response.message || '自动化学习失败')
        setIsRunning(false)
      } else {
        const submittedCount = response?.submittedCount ?? -1
        setStatus(`自动化学习完成，已提交 ${submittedCount} 个视频到学习队列`)
        setIsRunning(false)
      }
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <Container>
      <h3>自动学习机</h3>
      <p>自动扫描 B 站首页推荐，并筛选高质量知识视频加入学习队列。</p>
      <Button onClick={handleButtonClick} disabled={loading}>
        {isRunning ? (loading ? '停止中...' : '停止自动扫描') : (loading ? '启动中...' : '开始自动扫描')}
      </Button>
      {status && <StatusText>{status}</StatusText>}
      {error && <StatusText error>{error}</StatusText>}
    </Container>
  )
}

export default StudyAutomationPanel
