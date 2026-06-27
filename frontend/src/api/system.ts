import { get } from './request'

export function getHealth() {
  return get('/health')
}

export function getReady() {
  return get('/ready')
}
