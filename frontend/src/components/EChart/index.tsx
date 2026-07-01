import { useEffect, useRef } from 'react'
import { echarts } from '@/utils/echarts'
import type { EChartsOption } from 'echarts'
import styles from './index.module.css'
interface EChartProps {
  option: EChartsOption
  style?: React.CSSProperties
  className?: string
  /** 是否启用加载动画，默认 false */
  loading?: boolean
  /** 主题，默认跟随系统 */
  theme?: 'light' | 'dark'
}

export default function EChart({ option, style, className, loading = false, theme }: EChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    chartInstance.current = echarts.init(chartRef.current, theme)
    const handleResize = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [theme])

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.setOption(option, true)
    }
  }, [option])

  useEffect(() => {
    if (chartInstance.current) {
      if (loading) {
        chartInstance.current.showLoading()
      } else {
        chartInstance.current.hideLoading()
      }
    }
  }, [loading])

  return (
    <div
      ref={chartRef}
      className={`${styles.echart} ${className || ''}`}
      style={style}
    />
  )
}
