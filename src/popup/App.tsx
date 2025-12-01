import React, { useEffect, useState } from 'react';

const App: React.FC = () => {
  const [config, setConfig] = useState({
    aiProvider: '',
    aiEndpoint: '',
    aiKey: '',
    aiModel: 'gpt-3.5-turbo',
  });
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const stored = await chrome.storage.sync.get([
      'aiProvider',
      'aiEndpoint',
      'aiKey',
      'aiModel',
    ]);
    setConfig({
      aiProvider: stored.aiProvider || '',
      aiEndpoint: stored.aiEndpoint || '',
      aiKey: stored.aiKey || '',
      aiModel: stored.aiModel || 'gpt-3.5-turbo',
    });
  };

  const handleSaveConfig = async () => {
    await chrome.storage.sync.set(config);
    showMessage('配置已保存', 'success');
  };

  const handleOpenSidePanel = async () => {
    try {
      const window = await chrome.windows.getCurrent();
      if (window.id) {
        await chrome.sidePanel.open({ windowId: window.id });
      }
    } catch (error) {
      console.error('Failed to open side panel:', error);
      showMessage('无法打开侧边栏', 'error');
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage(null);
    }, 3000);
  };

  const handleCleanupStorage = () => {
      // Logic for cleanup wasn't implemented in the original popup.js provided, 
      // but the button existed in HTML. 
      // If there was logic, it should be here. 
      // For now, I'll leave it as a placeholder or implement if I find it elsewhere.
      console.log("Cleanup storage clicked");
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
        <button id="openSidePanel" onClick={handleOpenSidePanel}>
          生成字幕/总结
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
  );
};

export default App;
