/** Resolve the backend on the same machine/network as the page on mobile. */
export function getApiBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL
  if (configuredUrl) return configuredUrl.replace(/\/$/, '')

  if (typeof window === 'undefined') return 'http://127.0.0.1:8000'

  return `${window.location.protocol}//${window.location.hostname}:8000`
}

export function getUploadUrl(imagePath: string): string {
  const fileName = imagePath.split(/[\\/]/).pop()
  if (!fileName) return ''
  return `${getApiBaseUrl()}/uploads/${encodeURIComponent(fileName)}`
}
