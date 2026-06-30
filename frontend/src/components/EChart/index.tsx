import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import './index.css'

interface EChartProps {
  option: echarts.EChartsOption
  style?: React.CSSProperties
  className?: string
}

export default function EChart({ option, style, className }: EChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    chartInstance.current = echarts.init(chartRef.current)
    const handleResize = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.setOption(option, true)
    }
  }, [option])

  return (
    <div
      ref={chartRef}
      className={`echart ${className || ''}`}
      style={style}
    />
  )
}
