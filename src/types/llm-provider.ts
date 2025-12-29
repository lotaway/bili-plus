export interface LLMProviderConfig {
  id: string
  name: string
  type: string
  endpoint: string
  apiKey: string
  defaultModel: string
  enabled: boolean
  createdAt: number
  updatedAt: number
  options?: Record<string, any>
}

export interface LLMProvidersConfig {
  providers: LLMProviderConfig[]
  selectedProviderId: string | null
  version: number
}

export interface ModelInfo {
  name: string
  version: string
  object: string
  owned_by: string
  api_version: string
}

export interface VersionInfo {
  model_name: string
  version: string
  object: string
  owned_by: string
  api_version: string
}

export interface ApiStatus {
  ok: boolean
  lastChecked: string
  message: string
}

export const LLMProviderType = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  OLLAMA: 'ollama',
  CUSTOM: 'custom',
} as const

export type LLMProviderType = typeof LLMProviderType[keyof typeof LLMProviderType]