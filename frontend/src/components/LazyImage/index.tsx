import { useState, useEffect, useRef, useCallback } from 'react'
import { Skeleton } from '@arco-design/web-react'
import styles from './index.module.css'
interface LazyImageProps {
  src: string
  alt?: string
  className?: string
  style?: React.CSSProperties
  /** 占位图颜色 */
  placeholderColor?: string
  /** 加载失败时显示的图片 */
  fallbackSrc?: string
  /** 是否启用懒加载，默认 true */
  lazy?: boolean
  /** 提前加载的距离，默认 100px */
  rootMargin?: string
  /** 宽度 */
  width?: number | string
  /** 高度 */
  height?: number | string
  /** 圆角 */
  radius?: number
  /** 加载完成回调 */
  onLoad?: () => void
  /** 加载失败回调 */
  onError?: () => void
}

export default function LazyImage({
  src,
  alt = '',
  className = '',
  style,
  placeholderColor = 'var(--color-fill-1)',
  fallbackSrc,
  lazy = true,
  rootMargin = '100px',
  width,
  height,
  radius = 4,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)
  const [shouldLoad, setShouldLoad] = useState(!lazy)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setIsError(true)
    onError?.()
  }, [onError])

  useEffect(() => {
    if (!lazy || shouldLoad) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin },
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [lazy, shouldLoad, rootMargin])

  const imageSrc = isError && fallbackSrc ? fallbackSrc : src

  return (
    <div
      className={`${styles['lazy-image']} ${className}`}
      style={{
        width,
        height,
        backgroundColor: placeholderColor,
        borderRadius: radius,
        ...style,
      }}
      ref={imgRef as any}
    >
      {!isLoaded && (
        <div className={styles['lazy-image__placeholder']}>
          <Skeleton.Image style={{ width: '100%', height: '100%' }} />
        </div>
      )}
      {(shouldLoad || !lazy) && (
        <img
          src={imageSrc}
          alt={alt}
          className={`${styles['lazy-image__img']} ${isLoaded ? styles['lazy-image__img--loaded'] : ''}`}
          onLoad={handleLoad}
          onError={handleError}
          style={{ borderRadius: radius }}
        />
      )}
    </div>
  )
}
