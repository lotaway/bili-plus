import {
  LLMProviderConfig,
  LLMProvidersConfig,
  LLMProviderType,
} from '../types/llm-provider'
import Logger from '../utils/Logger'

export const INIT_LLM_PROVIDERS_CONFIG: LLMProvidersConfig = {
  providers: [],
  selectedProviderId: null,
  version: 1,
}

export const LLM_PROVIDERS_STORAGE_KEY = 'llmProvidersConfig'

export async function migrateLegacyConfig(): Promise<LLMProvidersConfig> {
  try {
    const legacyConfig = await chrome.storage.sync.get([
      'aiProvider',
      'aiEndpoint',
      'aiKey',
      'aiModel',
    ])

    if (!legacyConfig.aiEndpoint && !legacyConfig.aiKey) {
      return INIT_LLM_PROVIDERS_CONFIG
    }

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
    }

    const newConfig: LLMProvidersConfig = {
      providers: [newProvider],
      selectedProviderId: newProvider.id,
      version: 1,
    }

    await chrome.storage.sync.set({
      [LLM_PROVIDERS_STORAGE_KEY]: newConfig,
    })

    await chrome.storage.sync.remove([
      'aiProvider',
      'aiEndpoint',
      'aiKey',
      'aiModel',
    ])

    return newConfig
  } catch (error) {
    Logger.E('迁移旧配置失败:', error)
    return INIT_LLM_PROVIDERS_CONFIG
  }
}

export async function getLLMProvidersConfig(): Promise<LLMProvidersConfig> {
  try {
    const result = await chrome.storage.sync.get([LLM_PROVIDERS_STORAGE_KEY])

    if (result[LLM_PROVIDERS_STORAGE_KEY]) {
      return result[LLM_PROVIDERS_STORAGE_KEY] as LLMProvidersConfig
    }

    return await migrateLegacyConfig()
  } catch (error) {
    Logger.E('获取LLM Providers配置失败:', error)
    return INIT_LLM_PROVIDERS_CONFIG
  }
}

export async function saveLLMProvidersConfig(config: LLMProvidersConfig): Promise<void> {
  try {
    await chrome.storage.sync.set({
      [LLM_PROVIDERS_STORAGE_KEY]: {
        ...config,
        version: 1,
      },
    })
  } catch (error) {
    Logger.E('保存LLM Providers配置失败:', error)
    throw error
  }
}

export async function getSelectedProvider(): Promise<LLMProviderConfig | null> {
  const config = await getLLMProvidersConfig()

  if (!config.selectedProviderId || config.providers.length === 0) {
    return null
  }

  const provider = config.providers.find(p => p.id === config.selectedProviderId)
  return provider || null
}

export async function addProvider(provider: Omit<LLMProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const config = await getLLMProvidersConfig()

  const newProvider: LLMProviderConfig = {
    ...provider,
    id: `provider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  config.providers.push(newProvider)

  if (config.providers.length === 1) {
    config.selectedProviderId = newProvider.id
  }

  await saveLLMProvidersConfig(config)
  return newProvider.id
}

export async function updateProvider(id: string, updates: Partial<Omit<LLMProviderConfig, 'id' | 'createdAt'>>): Promise<boolean> {
  const config = await getLLMProvidersConfig()
  const index = config.providers.findIndex(p => p.id === id)

  if (index === -1) {
    return false
  }

  config.providers[index] = {
    ...config.providers[index],
    ...updates,
    updatedAt: Date.now(),
  }

  await saveLLMProvidersConfig(config)
  return true
}

export async function deleteProvider(id: string): Promise<boolean> {
  const config = await getLLMProvidersConfig()
  const initialLength = config.providers.length

  config.providers = config.providers.filter(p => p.id !== id)

  if (config.selectedProviderId === id) {
    config.selectedProviderId = config.providers.length > 0 ? config.providers[0].id : null
  }

  if (config.providers.length !== initialLength) {
    await saveLLMProvidersConfig(config)
    return true
  }

  return false
}

export async function selectProvider(id: string): Promise<boolean> {
  const config = await getLLMProvidersConfig()
  const providerExists = config.providers.some(p => p.id === id)

  if (!providerExists) {
    return false
  }

  config.selectedProviderId = id
  await saveLLMProvidersConfig(config)
  return true
}

export function getEnabledProviders(config: LLMProvidersConfig): LLMProviderConfig[] {
  return config.providers.filter(p => p.enabled)
}

export function validateProviderConfig(provider: LLMProviderConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!provider.name.trim()) {
    errors.push('Provider名称不能为空')
  }

  if (!provider.endpoint.trim()) {
    errors.push('API端点地址不能为空')
  } else if (!provider.endpoint.startsWith('http://') && !provider.endpoint.startsWith('https://')) {
    errors.push('API端点地址必须以http://或https://开头')
  }

  if (!provider.apiKey.trim()) {
    errors.push('API密钥不能为空')
  }

  if (!provider.defaultModel.trim()) {
    errors.push('默认模型名称不能为空')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}