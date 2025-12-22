export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function calculateProgress(loaded: number, total: number): number {
  if (total === 0) return 0
  return Math.round((loaded / total) * 100)
}

export function formatCurrency(amount: number, decimals: number = 2): string {
  if (amount === 0) return '0'
  
  const dm = decimals < 0 ? 0 : decimals
  
  if (Math.abs(amount) >= 1000000000) {
    return parseFloat((amount / 1000000000).toFixed(dm)) + 'B'
  } else if (Math.abs(amount) >= 1000000) {
    return parseFloat((amount / 1000000).toFixed(dm)) + 'M'
  } else {
    return parseFloat(amount.toFixed(dm)).toString()
  }
}
