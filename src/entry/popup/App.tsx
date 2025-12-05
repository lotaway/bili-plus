import React, { useEffect, useState } from 'react'

const App: React.FC = () => {
  const [config, setConfig] = useState({
    aiProvider: '',
    aiEndpoint: '',
    aiKey: '',
    aiModel: 'gpt-3.5-turbo',
  })
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [apiStatus, setApiStatus] = useState<{
    ok: boolean
    lastChecked: string
    message: string
  } | null>(null)

  useEffect(() => {
    loadConfig()
    loadApiStatus()
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes.apiStatus) {
        setApiStatus(changes.apiStatus.newValue)
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const loadApiStatus = async () => {
    try {
      const result = await chrome.storage.local.get('apiStatus')
      if (result.apiStatus) {
        setApiStatus(result.apiStatus)
      }
    } catch (error) {
      console.error('加载API状态失败:', error)
    }
  }

  const loadConfig = async () => {
    const stored = await chrome.storage.sync.get([
      'aiProvider',
      'aiEndpoint',
      'aiKey',
      'aiModel',
    ])
    setConfig({
      aiProvider: stored.aiProvider || '',
      aiEndpoint: stored.aiEndpoint || '',
      aiKey: stored.aiKey || '',
      aiModel: stored.aiModel || 'gpt-3.5-turbo',
    })
  }

  const handleSaveConfig = async () => {
    await chrome.storage.sync.set(config).catch((error) => {
      console.error(error)
      showMessage(error.message)
    })
    showMessage('配置已保存', 'success')
  }

  const handleOpenSidePanel = async () => {
    try {
      const window = await chrome.windows.getCurrent()
      if (window.id) {
        await chrome.sidePanel.open({ windowId: window.id })
      }
    } catch (error) {
      console.error('Failed to open side panel:', error)
      showMessage('无法打开侧边栏', 'error')
    }
  }

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => {
      setMessage(null)
    }, 3000)
  }

  const handleCleanupStorage = () => {
    console.log("Cleanup storage clicked")
  }

  return (
    <div className="popup">
      <h3>🎬 Bilibili 字幕提取器</h3>
      <div className="config-section">
        <h4>AI 配置</h4>
        <div className="form-group">
          <label htmlFor="aiProvider">API 提供商</label>
          <input
            type="text"
            id="aiProvider"
            placeholder="例如: OpenAI, Anthropic 等"
            value={config.aiProvider}
            onChange={(e) => setConfig({ ...config, aiProvider: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="aiEndpoint">API 地址</label>
          <input
            type="text"
            id="aiEndpoint"
            placeholder="例如: https://api.openai.com/v1"
            value={config.aiEndpoint}
            onChange={(e) => setConfig({ ...config, aiEndpoint: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="aiKey">API 密钥</label>
          <input
            type="password"
            id="aiKey"
            placeholder="输入您的API密钥"
            value={config.aiKey}
            onChange={(e) => setConfig({ ...config, aiKey: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="aiModel">模型名称</label>
          <input
            type="text"
            id="aiModel"
            placeholder="例如: gpt-3.5-turbo"
            value={config.aiModel}
            onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
          />
        </div>
        <button id="saveConfig" onClick={handleSaveConfig}>
          保存配置
        </button>

        {apiStatus && (
          <div className="api-status-section">
            <h4>API 状态</h4>
            <div className={`api-status ${apiStatus.ok ? 'available' : 'unavailable'}`}>
              <span className="status-indicator"></span>
              <span className="status-text">
                {apiStatus.ok ? 'AI模型Provider可用' : 'AI模型Provider不可用'}
              </span>
              {apiStatus.message && (
                <span className="status-message"> - {apiStatus.message}</span>
              )}
              {apiStatus.lastChecked && (
                <span className="last-checked"> (最后检查: {apiStatus.lastChecked})</span>
              )}
            </div>
          </div>
        )}

        <button id="openSidePanel" onClick={handleOpenSidePanel}>
          显示操作面板
        </button>
      </div>

      <div className="storage-section">
        <h4>存储管理</h4>
        <button id="cleanupStorage" className="cleanup-btn" onClick={handleCleanupStorage}>
          清理存储空间
        </button>
        <p className="storage-info">
          清理过期的视频数据和临时文件，释放存储空间
        </p>
      </div>

      {message && (
        <div id="msg" className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}

export default App
