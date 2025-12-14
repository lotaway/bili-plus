import { store } from './store'
import { RootState } from './store'

const STORAGE_KEY = 'bili-plus-redux-state'

export const saveStateToStorage = async () => {
  try {
    const state = store.getState()
    const serializedState = JSON.stringify(state)
    await chrome.storage.local.set({ [STORAGE_KEY]: serializedState })
    console.debug('State saved to storage')
  } catch (error) {
    console.error('Failed to save state to storage:', error)
  }
}

export const loadStateFromStorage = async (): Promise<Partial<RootState> | null> => {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY])
    if (result[STORAGE_KEY]) {
      const state = JSON.parse(result[STORAGE_KEY])
      console.debug('State loaded from storage')
      return state
    }
  } catch (error) {
    console.error('Failed to load state from storage:', error)
  }
  return null
}

let saveInterval: NodeJS.Timeout | null = null

export const startAutoSave = () => {
  if (saveInterval) {
    clearInterval(saveInterval)
  }

  saveInterval = setInterval(() => {
    saveStateToStorage()
  }, 5000)

  window.addEventListener('beforeunload', saveStateToStorage)
}

export const stopAutoSave = () => {
  if (saveInterval) {
    clearInterval(saveInterval)
    saveInterval = null
  }
  window.removeEventListener('beforeunload', saveStateToStorage)
}
