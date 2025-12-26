/**
 * LLM Provider 配置类型定义
 * 支持多个provider配置，用户可自行切换
 */

export interface LLMProviderConfig {
  /** Provider唯一标识 */
  id: string;
  /** Provider名称，用于显示 */
  name: string;
  /** Provider类型，如：openai、anthropic、ollama等 */
  type: string;
  /** API端点地址 */
  endpoint: string;
  /** API密钥 */
  apiKey: string;
  /** 默认模型名称 */
  defaultModel: string;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 额外配置选项 */
  options?: Record<string, any>;
}

export interface LLMProvidersConfig {
  /** 所有provider配置 */
  providers: LLMProviderConfig[];
  /** 当前选中的provider ID */
  selectedProviderId: string | null;
  /** 配置版本，用于迁移和兼容性检查 */
  version: number;
}

/** 默认的LLM Providers配置 */
export const DEFAULT_LLM_PROVIDERS_CONFIG: LLMProvidersConfig = {
  providers: [],
  selectedProviderId: null,
  version: 1,
};

/** Provider类型常量 */
export const LLMProviderType = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  OLLAMA: 'ollama',
  CUSTOM: 'custom',
} as const;

export type LLMProviderType = typeof LLMProviderType[keyof typeof LLMProviderType];

/** 存储键名常量 */
export const LLM_PROVIDERS_STORAGE_KEY = 'llmProvidersConfig';

/** 迁移旧的单个provider配置到新的多个provider配置 */
export async function migrateLegacyConfig(): Promise<LLMProvidersConfig> {
  try {
    // 尝试读取旧的配置
    const legacyConfig = await chrome.storage.sync.get([
      'aiProvider',
      'aiEndpoint',
      'aiKey',
      'aiModel',
    ]);

    // 如果没有任何旧的配置，返回默认配置
    if (!legacyConfig.aiEndpoint && !legacyConfig.aiKey) {
      return DEFAULT_LLM_PROVIDERS_CONFIG;
    }

    // 创建新的provider配置
    const newProvider: LLMProviderConfig = {
      id: 'legacy-migrated',
      name: legacyConfig.aiProvider || 'Legacy Provider',
      type: LLMProviderType.CUSTOM,
      endpoint: legacyConfig.aiEndpoint || '',
      apiKey: legacyConfig.aiKey || '',
      defaultModel: legacyConfig.aiModel || 'gpt-3.5-turbo',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 创建新的配置
    const newConfig: LLMProvidersConfig = {
      providers: [newProvider],
      selectedProviderId: newProvider.id,
      version: 1,
    };

    // 保存新的配置
    await chrome.storage.sync.set({
      [LLM_PROVIDERS_STORAGE_KEY]: newConfig,
    });

    // 可选：清理旧的配置
    await chrome.storage.sync.remove([
      'aiProvider',
      'aiEndpoint',
      'aiKey',
      'aiModel',
    ]);

    return newConfig;
  } catch (error) {
    console.error('迁移旧配置失败:', error);
    return DEFAULT_LLM_PROVIDERS_CONFIG;
  }
}

/** 获取LLM Providers配置 */
export async function getLLMProvidersConfig(): Promise<LLMProvidersConfig> {
  try {
    const result = await chrome.storage.sync.get([LLM_PROVIDERS_STORAGE_KEY]);
    
    if (result[LLM_PROVIDERS_STORAGE_KEY]) {
      return result[LLM_PROVIDERS_STORAGE_KEY] as LLMProvidersConfig;
    }
    
    // 如果没有配置，尝试迁移旧的配置
    return await migrateLegacyConfig();
  } catch (error) {
    console.error('获取LLM Providers配置失败:', error);
    return DEFAULT_LLM_PROVIDERS_CONFIG;
  }
}

/** 保存LLM Providers配置 */
export async function saveLLMProvidersConfig(config: LLMProvidersConfig): Promise<void> {
  try {
    await chrome.storage.sync.set({
      [LLM_PROVIDERS_STORAGE_KEY]: {
        ...config,
        version: 1,
      },
    });
  } catch (error) {
    console.error('保存LLM Providers配置失败:', error);
    throw error;
  }
}

/** 获取当前选中的provider配置 */
export async function getSelectedProvider(): Promise<LLMProviderConfig | null> {
  const config = await getLLMProvidersConfig();
  
  if (!config.selectedProviderId || config.providers.length === 0) {
    return null;
  }
  
  const provider = config.providers.find(p => p.id === config.selectedProviderId);
  return provider || null;
}

/** 添加新的provider */
export async function addProvider(provider: Omit<LLMProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const config = await getLLMProvidersConfig();
  
  const newProvider: LLMProviderConfig = {
    ...provider,
    id: `provider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  config.providers.push(newProvider);
  
  // 如果是第一个provider，自动选中
  if (config.providers.length === 1) {
    config.selectedProviderId = newProvider.id;
  }
  
  await saveLLMProvidersConfig(config);
  return newProvider.id;
}

/** 更新provider */
export async function updateProvider(id: string, updates: Partial<Omit<LLMProviderConfig, 'id' | 'createdAt'>>): Promise<boolean> {
  const config = await getLLMProvidersConfig();
  const index = config.providers.findIndex(p => p.id === id);
  
  if (index === -1) {
    return false;
  }
  
  config.providers[index] = {
    ...config.providers[index],
    ...updates,
    updatedAt: Date.now(),
  };
  
  await saveLLMProvidersConfig(config);
  return true;
}

/** 删除provider */
export async function deleteProvider(id: string): Promise<boolean> {
  const config = await getLLMProvidersConfig();
  const initialLength = config.providers.length;
  
  config.providers = config.providers.filter(p => p.id !== id);
  
  // 如果删除的是当前选中的provider，需要重新选择
  if (config.selectedProviderId === id) {
    config.selectedProviderId = config.providers.length > 0 ? config.providers[0].id : null;
  }
  
  // 只有当provider数量发生变化时才保存
  if (config.providers.length !== initialLength) {
    await saveLLMProvidersConfig(config);
    return true;
  }
  
  return false;
}

/** 选择provider */
export async function selectProvider(id: string): Promise<boolean> {
  const config = await getLLMProvidersConfig();
  const providerExists = config.providers.some(p => p.id === id);
  
  if (!providerExists) {
    return false;
  }
  
  config.selectedProviderId = id;
  await saveLLMProvidersConfig(config);
  return true;
}

/** 获取所有启用的provider */
export function getEnabledProviders(config: LLMProvidersConfig): LLMProviderConfig[] {
  return config.providers.filter(p => p.enabled);
}

/** 验证provider配置是否完整 */
export function validateProviderConfig(provider: LLMProviderConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!provider.name.trim()) {
    errors.push('Provider名称不能为空');
  }
  
  if (!provider.endpoint.trim()) {
    errors.push('API端点地址不能为空');
  } else if (!provider.endpoint.startsWith('http://') && !provider.endpoint.startsWith('https://')) {
    errors.push('API端点地址必须以http://或https://开头');
  }
  
  if (!provider.apiKey.trim()) {
    errors.push('API密钥不能为空');
  }
  
  if (!provider.defaultModel.trim()) {
    errors.push('默认模型名称不能为空');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}