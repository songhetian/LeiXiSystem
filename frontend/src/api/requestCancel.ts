import type { AxiosRequestConfig } from 'axios'

const pendingRequests = new Map<string, AbortController>()

function generateRequestKey(config: AxiosRequestConfig): string {
  const { method, url, params, data } = config
  return [method, url, JSON.stringify(params), JSON.stringify(data)].join('&')
}

export function addPendingRequest(config: AxiosRequestConfig): void {
  const key = generateRequestKey(config)
  if (pendingRequests.has(key)) {
    const controller = pendingRequests.get(key)
    controller?.abort()
    pendingRequests.delete(key)
  }

  const controller = new AbortController()
  config.signal = controller.signal
  pendingRequests.set(key, controller)
}

export function removePendingRequest(config: AxiosRequestConfig): void {
  const key = generateRequestKey(config)
  pendingRequests.delete(key)
}

export function clearAllPendingRequests(): void {
  pendingRequests.forEach((controller) => controller.abort())
  pendingRequests.clear()
}

export default {
  addPendingRequest,
  removePendingRequest,
  clearAllPendingRequests,
}
