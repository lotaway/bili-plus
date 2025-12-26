/**
 * LLM Provider 管理器
 * 支持多个LLM provider的配置、管理和切换
 */

import { 
  LLMProviderConfig, 
  LLMProvidersConfig, 
  getLLMProvidersConfig, 
  getSelectedProvider,
  selectProvider,
  validateProviderConfig 
} from '../types/llm-provider';
import { AIGenerationAnalyzer } from './AIGeneratioinAnalyzer';
import { StreamUtils } from '../utils/streamUtils';

interface ModelInfo {
  name: string;
  version: string;
  object: string;
  owned_by: string;
  api_version: string;
}

interface VersionInfo {
  model_name: string;
  version: string;
  object: string;
  owned_by: string;
  api_version: string;
}

interface ApiStatus {
  ok: boolean;
  lastChecked: string;
  message: string;
}

export class LLMProviderManager {
  private apiCheckTimeout: number | null = null;
  private currentProvider: LLMProviderConfig | null = null;
  private _versionInfo: VersionInfo | null = null;
  private _versionInfoFetched = false;
  private _modelList: ModelInfo[] = [];
  private _modelListFetched = false;
  private isBusy = false;

  static defaultModelName() {
    return 'gpt-3.5-turbo';
  }

  /** 获取当前选中的provider */
  get provider(): LLMProviderConfig | null {
    return this.currentProvider;
  }

  /** 获取API端点前缀（包含版本） */
  get apiPrefixWithVersion(): string {
    if (!this.currentProvider) {
      throw new Error('没有选中的LLM provider');
    }
    const version = this._versionInfo?.api_version ?? 'v1';
    return `${this.currentProvider.endpoint}/${version}`;
  }

  /** 获取版本信息 */
  get versionInfo(): VersionInfo | null {
    return this._versionInfo;
  }

  /** 获取模型列表 */
  get modelList(): ModelInfo[] {
    return [...this._modelList];
  }

  /** 初始化，加载当前选中的provider */
  async init(): Promise<{ isOk: boolean; error?: Error }> {
    try {
      await this.syncCurrentProvider();
      return { isOk: true };
    } catch (error) {
      console.error('LLMProviderManager初始化失败:', error);
      return { 
        isOk: false, 
        error: error instanceof Error ? error : new Error('初始化失败') 
      };
    }
  }

  /** 同步当前选中的provider */
  async syncCurrentProvider(): Promise<void> {
    const provider = await getSelectedProvider();
    this.currentProvider = provider;
    
    if (provider) {
      console.log(`当前选中的LLM provider: ${provider.name} (${provider.id})`);
    } else {
      console.warn('没有可用的LLM provider，请先配置');
    }
  }

  /** 切换到指定的provider */
  async switchProvider(providerId: string): Promise<boolean> {
    const success = await selectProvider(providerId);
    if (success) {
      await this.syncCurrentProvider();
      // 重置缓存的状态信息
      this._versionInfoFetched = false;
      this._modelListFetched = false;
      this._versionInfo = null;
      this._modelList = [];
    }
    return success;
  }

  /** 获取所有可用的providers */
  async getAvailableProviders(): Promise<LLMProviderConfig[]> {
    const config = await getLLMProvidersConfig();
    return config.providers.filter(p => p.enabled);
  }

  /** 开始API状态检查 */
  initializeApiStatusCheck() {
    if (this.apiCheckTimeout) {
      clearTimeout(this.apiCheckTimeout);
    }
    this.scheduleApiCheck();
  }

  /** 停止API状态检查 */
  stopApiStatusCheck() {
    if (this.apiCheckTimeout) {
      clearTimeout(this.apiCheckTimeout);
      this.apiCheckTimeout = null;
    }
  }

  /** 检查API状态检查是否正在运行 */
  isApiStatusCheckRunning(): boolean {
    return this.apiCheckTimeout !== null;
  }

  private scheduleApiCheck() {
    this.apiCheckTimeout = setTimeout(() => {
      this.checkApiStatus();
    }, 60 * 1000) as unknown as number;
  }

  /** 检查当前选中的provider的API状态 */
  private async checkApiStatus() {
    if (!this.currentProvider) {
      console.warn('没有选中的LLM provider，跳过API状态检查');
      this.scheduleApiCheck();
      return;
    }

    try {
      const signal = AbortSignal.timeout(5000);
      
      if (!this._versionInfoFetched) {
        await this.fetchVersionInfo();
      }

      const response = await fetch(`${this.currentProvider.endpoint}/api/show`, {
        method: 'POST',
        headers: this.defaultHeaders(false),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const isApiOk = data?.ok === true;

      await chrome.storage.local.set({
        apiStatus: {
          ok: isApiOk,
          lastChecked: new Date().toLocaleString(),
          message: isApiOk ? 'API服务正常' : 'API服务异常'
        }
      });

      console.log(`API状态检查 (${this.currentProvider.name}): ${isApiOk ? '正常' : '异常'}`);
    } catch (error) {
      console.error(`API状态检查失败 (${this.currentProvider?.name || '未知'}):`, error);
      await chrome.storage.local.set({
        apiStatus: {
          ok: false,
          lastChecked: new Date().toLocaleString(),
          message: `API检查失败: ${error instanceof Error ? error.message : '未知错误'}`
        }
      });
    } finally {
      this.scheduleApiCheck();
    }
  }

  /** 获取版本信息 */
  private async fetchVersionInfo() {
    if (!this.currentProvider?.endpoint) {
      return;
    }

    try {
      const signal = AbortSignal.timeout(5000);
      const response = await fetch(`${this.currentProvider.endpoint}/api/version`, {
        method: 'GET',
        headers: this.defaultHeaders(false),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const versionData = await response.json() as VersionInfo;
      this._versionInfo = versionData;
      this._versionInfoFetched = true;
      console.log('版本信息获取成功:', versionData);
    } catch (error) {
      console.error('获取版本信息失败:', error);
    }
  }

  /** 获取模型列表 */
  async fetchModelList(): Promise<ModelInfo[]> {
    if (!this.currentProvider?.endpoint) {
      return [];
    }

    try {
      const signal = AbortSignal.timeout(5000);
      const response = await fetch(`${this.currentProvider.endpoint}/api/tags`, {
        method: 'GET',
        headers: this.defaultHeaders(false),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const modelList = await response.json() as ModelInfo[];
      this._modelList = modelList;
      this._modelListFetched = true;
      return modelList;
    } catch (error) {
      console.error('获取模型列表失败:', error);
      return [];
    }
  }

  /** 验证模型是否可用 */
  async validateModel(modelName: string): Promise<boolean> {
    const models = await this.getAvailableModels();
    return models.some(model => model.name === modelName);
  }

  /** 默认请求头 */
  defaultHeaders(includeAuth: boolean = true, contentType: string = 'application/json'): Record<string, string> {
    const headers: Record<string, string> = {};

    if (contentType) {
      headers['Content-Type'] = `${contentType}; charset=utf-8`;
    }

    if (includeAuth && this.currentProvider?.apiKey) {
      headers['Authorization'] = `Bearer ${this.currentProvider.apiKey}`;
    }

    return headers;
  }

  /** 默认请求体 */
  get defaultRequestBody() {
    return {
      stream: true,
      enable_rag: false,
    };
  }

  /** 调用LLM */
  async callLLM(
    messages: { role: string; content: string }[],
    options: {
      temperature?: number;
      stream?: boolean;
      onProgress?: (chunk: string) => void;
    } = {}
  ) {
    if (!this.currentProvider) {
      return { error: '请先配置并选择LLM provider' };
    }

    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' };
    }

    this.isBusy = true;
    try {
      const bodyData = {
        ...this.defaultRequestBody,
        model: this.currentProvider.defaultModel ?? LLMProviderManager.defaultModelName(),
        messages,
        temperature: options.temperature ?? 0.7,
        stream: options.stream,
      };

      const signal = AbortSignal.timeout(5 * 60 * 1000);
      const response = await fetch(`${this.apiPrefixWithVersion}/chat/completions`, {
        method: 'POST',
        headers: this.defaultHeaders(),
        body: JSON.stringify(bodyData),
        signal,
      });

      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();

      const fullResponse = await new StreamUtils().readStream(
        reader,
        (content, _metadata) => {
          if (content && options.onProgress) {
            options.onProgress(content);
          }
        }
      );

      const data = new AIGenerationAnalyzer(fullResponse).analyze();
      return { data };
    } finally {
      this.isBusy = false;
    }
  }

  /** 分析截图 */
  async analyzeScreenshot(
    screenshotDataUrl: string,
    onProgress?: (chunk: string) => void
  ) {
    if (!this.currentProvider) {
      return { error: '请先配置并选择LLM provider' };
    }

    if (this.isBusy) {
      return { error: '当前正在处理中，请稍后再试' };
    }

    this.isBusy = true;
    try {
      const bodyData = {
        ...this.defaultRequestBody,
        model: this.currentProvider.defaultModel ?? LLMProviderManager.defaultModelName(),
        messages: [
          {
            role: 'user',
            content: `分析以下截图内容:\n\n![screenshot](${screenshotDataUrl})`,
          },
        ],
        temperature: 0.7,
        stream: true,
      };

      const signal = AbortSignal.timeout(5 * 60 * 1000);
      const response = await fetch(`${this.apiPrefixWithVersion}/chat/completions`, {
        method: 'POST',
        headers: this.defaultHeaders(),
        body: JSON.stringify(bodyData),
        signal,
      });

      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();

      const fullResponse = await new StreamUtils().readStream(
        reader,
        (content, _metadata) => {
          if (content && onProgress) {
            onProgress(content);
          }
        }
      );

      const data = new AIGenerationAnalyzer(fullResponse).analyze();
      return { data };
    } finally {
      this.isBusy = false;
    }
  }

  /** 保存文档 */
  async saveDocument(importDocumentData: any) {
    // 这里实现文档保存逻辑
    // 为了保持兼容性，暂时返回成功
    console.log('保存文档:', importDocumentData);
    return { success: true };
  }

  /** 获取完整的配置 */
  async getConfig(): Promise<LLMProvidersConfig> {
    return await getLLMProvidersConfig();
  }

  /** 获取指定provider的可用模型 */
  async getAvailableModels(providerId?: string): Promise<ModelInfo[]> {
    // 如果指定了providerId，需要先切换到该provider
    if (providerId && this.currentProvider?.id !== providerId) {
      const success = await this.switchProvider(providerId);
      if (!success) {
        console.error(`无法切换到provider: ${providerId}`);
        return [];
      }
    }
    
    if (!this._modelListFetched) {
      await this.fetchModelList();
    }
    return this.modelList;
  }

  /** 保存配置 */
  async saveConfig(config: LLMProvidersConfig): Promise<boolean> {
    try {
      // 这里需要实现保存配置的逻辑
      // 暂时使用chrome.storage.sync保存
      await chrome.storage.sync.set({
        llmProviders: config.providers,
        currentLLMProviderId: config.selectedProviderId
      });
      
      // 更新当前provider
      await this.syncCurrentProvider();
      return true;
    } catch (error) {
      console.error('保存配置失败:', error);
      return false;
    }
  }

  /** 获取当前provider的配置 */
  async getCurrentProviderConfig(): Promise<LLMProviderConfig | null> {
    return this.currentProvider;
  }
}