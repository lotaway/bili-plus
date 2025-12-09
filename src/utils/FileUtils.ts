
export class FileUtils {

  static extractMimeTypeFromDataUrl(dataUrl: string): string {
    const match = dataUrl.match(/^data:([^;]+);/)
    return match ? match[1] : ''
  }

  static getFileExtensionFromMimeType(mimeType: string): string {
    const mimeToExtension: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'text/html': '.html',
      'application/json': '.json',
      'application/xml': '.xml',
    }

    return mimeToExtension[mimeType.toLowerCase()] || '.bin'
  }

  static generateFilenameFromDataUrl(dataUrl: string, customName?: string): string {
    const mimeType = this.extractMimeTypeFromDataUrl(dataUrl)
    const extension = this.getFileExtensionFromMimeType(mimeType)
    const baseName = customName || String(Date.now())
    return `${baseName}${extension}`
  }
}
