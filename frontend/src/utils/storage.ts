export function storageGet<T = any>(key: string): T | null {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function storageSet(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('storageSet error:', e)
  }
}

export function storageRemove(key: string) {
  localStorage.removeItem(key)
}

export function storageClear() {
  localStorage.clear()
}
