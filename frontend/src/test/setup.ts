import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Arco Design Message
vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual('@arco-design/web-react')
  return {
    ...actual,
    Message: {
      success: vi.fn(() => vi.fn()),
      error: vi.fn(() => vi.fn()),
      warning: vi.fn(() => vi.fn()),
      info: vi.fn(() => vi.fn()),
      normal: vi.fn(() => vi.fn()),
      loading: vi.fn(() => vi.fn()),
      config: vi.fn(),
      clear: vi.fn(),
    },
  }
})
