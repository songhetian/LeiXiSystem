import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock HTMLCanvasElement.getContext for ECharts in jsdom
const gradientMock = { addColorStop: vi.fn() }
const patternMock = {} as CanvasPattern

const canvasContextMock = {
  canvas: { width: 800, height: 600 },
  // State
  save: vi.fn(),
  restore: vi.fn(),
  // Transforms
  setTransform: vi.fn(),
  resetTransform: vi.fn(),
  transform: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  getTransform: vi.fn().mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  // Rectangles
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  rect: vi.fn(),
  // Text
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn().mockReturnValue({
    width: 0,
    actualBoundingBoxAscent: 0,
    actualBoundingBoxDescent: 0,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: 0,
    fontBoundingBoxAscent: 0,
    fontBoundingBoxDescent: 0,
  }),
  // Path methods
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  ellipse: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  // Drawing
  stroke: vi.fn(),
  fill: vi.fn(),
  clip: vi.fn(),
  drawImage: vi.fn(),
  drawFocusIfNeeded: vi.fn(),
  // Pixel manipulation
  getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  putImageData: vi.fn(),
  createImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  // Gradients & patterns
  createLinearGradient: vi.fn().mockReturnValue(gradientMock),
  createRadialGradient: vi.fn().mockReturnValue(gradientMock),
  createConicGradient: vi.fn().mockReturnValue(gradientMock),
  createPattern: vi.fn().mockReturnValue(patternMock),
  // Misc
  isPointInPath: vi.fn().mockReturnValue(false),
  isPointInStroke: vi.fn().mockReturnValue(false),
  lineDashOffset: 0,
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  direction: 'ltr',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  shadowBlur: 0,
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  imageSmoothingEnabled: true,
  setLineDash: vi.fn(),
  getLineDash: vi.fn().mockReturnValue([]),
}

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(canvasContextMock) as any

// Mock window.matchMedia for jsdom (required by Arco Design Grid/Row)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

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
