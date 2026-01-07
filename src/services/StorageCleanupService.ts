import Logger from "../utils/Logger"

export class StorageCleanupService {
  async initializeStorageCleanup(): Promise<void> {
    try {
      const syncBytes = await new Promise<number>((resolve) => {
        chrome.storage.sync.getBytesInUse(null, resolve)
      })
      Logger.I('Sync storage usage:', syncBytes, 'bytes')

      if (syncBytes > 90000) {
        await this.cleanupSyncStorage()
      }
    } catch (error) {
      Logger.E('Storage cleanup initialization failed:', error)
    }
  }

  async cleanupSyncStorage(): Promise<void> {
    try {
      const allData = await chrome.storage.sync.get(null)
      const keysToRemove: string[] = []
      for (const [key, value] of Object.entries(allData)) {
        if (value && typeof value === 'object' && (value as any).timestamp) {
          const age = Date.now() - (value as any).timestamp
          if (age > 7 * 24 * 60 * 60 * 1000) {
            keysToRemove.push(key)
          }
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.sync.remove(keysToRemove)
        Logger.I(`清理了 ${keysToRemove.length} 个过期的sync存储项`)
      }
    } catch (error) {
      Logger.E('清理sync存储时出错:', error)
    }
  }
}
