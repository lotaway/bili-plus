import React, { useEffect, useState } from 'react'
import { LLMProviderManager } from '../../services/LLMProviderManager'
import { LLMProviderConfig } from '../../types/llm-provider'

interface ModelInfo {
  name: string
  version: string
  object: string
  owned_by: string
  api_version: string
}

const App: React.FC = () => {
  const [providers, setProviders] = useState<LLMProviderConfig[]>([])
  const [currentProviderId, setCurrentProviderId] = useState<string>('')
  const [editingProvider, setEditingProvider] = useState<LLMProviderConfig | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [apiStatus, setApiStatus] = useState<{
    ok: boolean
    lastChecked: string
    message: string
  } | null>(null)
  const [modelList, setModelList] = useState<ModelInfo[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  useEffect(() => {
    loadProviders()
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

  const loadProviders = async () => {
    try {
      const llmProviderManager = new LLMProviderManager()
      await llmProviderManager.init()
      const config = await llmProviderManager.getConfig()
      setProviders(config.providers || [])
      setCurrentProviderId(config.selectedProviderId || '')
    } catch (error) {
      console.error('加载provider配置失败:', error)
      setProviders([])
      setCurrentProviderId('')
    }
  }

  const loadModelList = async (provider: LLMProviderConfig) => {
    if (!provider.endpoint || !provider.apiKey) {
      return
    }

    setIsLoadingModels(true)
    try {
      const cachedModelList = await chrome.storage.local.get('modelList')
      if (cachedModelList.modelList && cachedModelList.modelList.models && cachedModelList.modelList.models.length > 0) {
        const cacheAge = Date.now() - cachedModelList.modelList.lastUpdated
        const CACHE_MAX_AGE = 10 * 60 * 1000
        if (cacheAge < CACHE_MAX_AGE) {
          setModelList(cachedModelList.modelList.models)
          console.log('使用缓存的模型列表:', cachedModelList.modelList.models.length, '个模型')
          return
        }
      }

      const llmProviderManager = new LLMProviderManager()
      await llmProviderManager.init()
      const models = await llmProviderManager.fetchModelListForProvider(provider)
      setModelList(models)

      await chrome.storage.local.set({
        modelList: {
          models,
          lastUpdated: Date.now(),
          source: 'popup_direct_fetch'
        }
      })
    } catch (error) {
      console.error('加载模型列表失败:', error)
      setModelList([])
    } finally {
      setIsLoadingModels(false)
    }
  }

  const handleAddProvider = () => {
    const newProvider: LLMProviderConfig = {
      id: `provider_${Date.now()}`,
      name: '',
      type: 'custom',
      endpoint: '',
      apiKey: '',
      defaultModel: 'gpt-3.5-turbo',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setEditingProvider(newProvider)
    setIsAddingNew(true)
  }

  const handleEditProvider = (provider: LLMProviderConfig) => {
    setEditingProvider({ ...provider })
    setIsAddingNew(false)
  }

  const handleDeleteProvider = async (providerId: string) => {
    if (currentProviderId === providerId && providers.length > 1) {
      showMessage('不能删除当前正在使用的provider，请先切换到其他provider', 'error')
      return
    }

    if (window.confirm('确定要删除这个provider吗？')) {
      const updatedProviders = providers.filter(p => p.id !== providerId)
      const newCurrentId = currentProviderId === providerId || updatedProviders.length === 0 ? '' : currentProviderId
      await saveProviders(updatedProviders, newCurrentId)
      showMessage('provider已删除', 'success')
    }
  }

  const handleSwitchProvider = async (providerId: string) => {
    await saveProviders(providers, providerId)
    showMessage('已切换到新的provider', 'success')
  }

  const handleSaveProvider = async () => {
    if (!editingProvider) return

    if (!editingProvider.name.trim()) {
      showMessage('请输入provider名称', 'error')
      return
    }

    if (!editingProvider.endpoint.trim()) {
      showMessage('请输入API地址', 'error')
      return
    }

    if (!editingProvider.apiKey.trim()) {
      showMessage('请输入API密钥', 'error')
      return
    }

    if (!editingProvider.defaultModel.trim()) {
      showMessage('请输入模型名称', 'error')
      return
    }

    let updatedProviders: LLMProviderConfig[]
    if (isAddingNew) {
      updatedProviders = [...providers, editingProvider]
    } else {
      updatedProviders = providers.map(p =>
        p.id === editingProvider.id ? editingProvider : p
      )
    }

    const newCurrentProviderId = isAddingNew && providers.length === 0 ? editingProvider.id : currentProviderId
    await saveProviders(updatedProviders, newCurrentProviderId)

    setEditingProvider(null)
    setIsAddingNew(false)
    showMessage(isAddingNew ? 'provider已添加' : 'provider已更新', 'success')
  }

  const saveProviders = async (providersList: LLMProviderConfig[], currentId: string) => {
    try {
      const llmProviderManager = new LLMProviderManager()
      await llmProviderManager.init()
      await llmProviderManager.saveConfig({
        providers: providersList,
        selectedProviderId: currentId,
        version: 1
      })

      setProviders(providersList)
      setCurrentProviderId(currentId)
    } catch (error) {
      console.error('保存provider配置失败:', error)
      showMessage('保存配置失败', 'error')
    }
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

  const currentProvider = providers.find(p => p.id === currentProviderId)

  return (
    <div className="popup">
      <h3>Settings</h3>

      <div className="config-section">
        <h4>LLM Provider 管理</h4>

        <div className="providers-list">
          {providers.length === 0 ? (
            <p className="no-providers">暂无配置的provider</p>
          ) : (
            providers.map(provider => (
              <div key={provider.id} className={`provider-item ${provider.id === currentProviderId ? 'active' : ''}`}>
                <div className="provider-info">
                  <span className="provider-name">{provider.name || '未命名'}</span>
                  <span className="provider-model">{provider.defaultModel}</span>
                  {provider.id === currentProviderId && (
                    <span className="current-badge">当前使用</span>
                  )}
                </div>
                <div className="provider-actions">
                  <button
                    className="action-btn switch-btn"
                    onClick={() => handleSwitchProvider(provider.id)}
                    disabled={provider.id === currentProviderId}
                  >
                    切换
                  </button>
                  <button
                    className="action-btn edit-btn"
                    onClick={() => handleEditProvider(provider)}
                  >
                    编辑
                  </button>
                  <button
                    className="action-btn delete-btn"
                    onClick={() => handleDeleteProvider(provider.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button className="add-provider-btn" onClick={handleAddProvider}>
          + 添加新的Provider
        </button>

        {editingProvider && (
          <div className="provider-form">
            <h5>{isAddingNew ? '添加新的Provider' : '编辑Provider'}</h5>
            <div className="form-group">
              <label htmlFor="providerName">Provider名称</label>
              <input
                type="text"
                id="providerName"
                placeholder="例如: OpenAI配置"
                value={editingProvider.name}
                onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="providerType">API提供商</label>
              <input
                type="text"
                id="providerType"
                placeholder="例如: OpenAI, Anthropic 等"
                value={editingProvider.type}
                onChange={(e) => setEditingProvider({ ...editingProvider, type: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="aiEndpoint">API地址</label>
              <input
                type="text"
                id="aiEndpoint"
                placeholder="例如: https://api.openai.com/v1"
                value={editingProvider.endpoint}
                onChange={(e) => setEditingProvider({ ...editingProvider, endpoint: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="aiKey">API密钥</label>
              <input
                type="password"
                id="aiKey"
                placeholder="输入您的API密钥"
                value={editingProvider.apiKey}
                onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="aiModel">模型名称</label>
              {isLoadingModels ? (
                <select id="aiModel" disabled>
                  <option>加载模型中...</option>
                </select>
              ) : modelList.length > 0 ? (
                <select
                  id="aiModel"
                  value={editingProvider.defaultModel}
                  onChange={(e) => setEditingProvider({ ...editingProvider, defaultModel: e.target.value })}
                >
                  <option value="">请选择模型</option>
                  {modelList.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({model.version}) - {model.owned_by}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  id="aiModel"
                  placeholder="例如: gpt-3.5-turbo"
                  value={editingProvider.defaultModel}
                  onChange={(e) => setEditingProvider({ ...editingProvider, defaultModel: e.target.value })}
                />
              )}
              {modelList.length === 0 && editingProvider.endpoint && editingProvider.apiKey && (
                <button
                  type="button"
                  className="refresh-models-btn"
                  onClick={() => loadModelList(editingProvider)}
                  disabled={isLoadingModels}
                >
                  {isLoadingModels ? '加载中...' : '刷新模型列表'}
                </button>
              )}
            </div>
            <div className="form-actions">
              <button className="save-btn" onClick={handleSaveProvider}>
                保存
              </button>
              <button className="cancel-btn" onClick={() => setEditingProvider(null)}>
                取消
              </button>
            </div>
          </div>
        )}

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