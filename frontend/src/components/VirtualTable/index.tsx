import { useMemo, useRef, useCallback } from 'react'
import { Table } from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import styles from './index.module.css'
interface VirtualTableProps<T = any> extends Omit<TableProps<T>, 'virtualized'> {
  /** 是否启用虚拟滚动，默认 true */
  virtual?: boolean
  /** 行高，默认 48 */
  rowHeight?: number
  /** 可视区域高度 */
  height?: number | string
  /** 缓冲区行数，默认 5 */
  bufferSize?: number
}

function VirtualTable<T extends Record<string, any> = any>(props: VirtualTableProps<T>) {
  const {
    virtual = true,
    rowHeight = 48,
    height = 500,
    bufferSize = 5,
    data = [],
    columns = [],
    ...tableProps
  } = props

  const tableRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)

  const visibleCount = useMemo(() => {
    const h = typeof height === 'number' ? height : 500
    return Math.ceil(h / rowHeight) + bufferSize * 2
  }, [height, rowHeight, bufferSize])

  const startIndex = useMemo(() => {
    return Math.max(0, Math.floor(scrollTopRef.current / rowHeight) - bufferSize)
  }, [rowHeight, bufferSize])

  const endIndex = useMemo(() => {
    const total = Array.isArray(data) ? data.length : 0
    return Math.min(total, startIndex + visibleCount)
  }, [data, startIndex, visibleCount])

  const visibleData = useMemo(() => {
    if (!virtual || !Array.isArray(data)) return data
    return data.slice(startIndex, endIndex)
  }, [virtual, data, startIndex, endIndex])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!virtual) return
    scrollTopRef.current = e.currentTarget.scrollTop
  }, [virtual])

  if (!virtual) {
    return <Table {...tableProps} data={data} columns={columns} />
  }

  return (
    <div className={styles['virtual-table']} style={{ height }} ref={tableRef} onScroll={handleScroll}>
      <Table
        {...tableProps}
        data={visibleData as T[]}
        columns={columns}
        scroll={{ y: typeof height === 'number' ? height : parseInt(String(height)) }}
        pagination={false}
      />
    </div>
  )
}

export default VirtualTable
