export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const index = Math.min(i, units.length - 1)

  if (index === 0) {
    return `${bytes} B`
  }

  const value = bytes / Math.pow(k, index)
  return `${value.toFixed(1)} ${units[index]}`
}
