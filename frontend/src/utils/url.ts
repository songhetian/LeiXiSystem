export function parseHttpUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null
    }
    return url
  } catch {
    return null
  }
}

export function isSafeHttpUrl(rawUrl: string) {
  return Boolean(parseHttpUrl(rawUrl))
}

export function openSafeExternalUrl(rawUrl: string) {
  const url = parseHttpUrl(rawUrl)
  if (!url) {
    return false
  }

  const opened = window.open(url.toString(), '_blank', 'noopener,noreferrer')
  if (opened) {
    opened.opener = null
  }
  return true
}

export function saveBlob(blob: Blob, filename: string) {
  const safeFilename = filename.replace(/[\\/:*?"<>|]/g, '_')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = safeFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
