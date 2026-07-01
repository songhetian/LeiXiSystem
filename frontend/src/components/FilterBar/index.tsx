import { ReactNode, useEffect } from 'react'
import { Button, Form, Space } from '@arco-design/web-react'
import styles from './index.module.css'
const FormItem = Form.Item

interface FilterBarProps {
  filters: ReactNode
  onSearch: () => void
  onReset: () => void
  searchText?: string
  resetText?: string
  className?: string
  /** 是否在输入框中启用 Enter 键触发搜索，默认 true */
  enableEnterSearch?: boolean
}

function FilterBar({
  filters,
  onSearch,
  onReset,
  searchText = '查询',
  resetText = '重置',
  className = '',
  enableEnterSearch = true,
}: FilterBarProps) {
  // 监听输入框的 Enter 键
  useEffect(() => {
    if (!enableEnterSearch) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 只有在按下 Enter 且不在 Button 或其他交互元素上时触发
      if (e.key !== 'Enter') return

      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (isInput && !target.closest('button')) {
        e.preventDefault()
        onSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableEnterSearch, onSearch])

  return (
    <Form layout="inline" className={`${styles['filter-bar']} ${className}`}>
      <div className={styles['filter-bar__filters']}>{filters}</div>
      <FormItem className={styles['filter-bar__actions']}>
        <Space>
          <Button type="primary" onClick={onSearch}>{searchText}</Button>
          <Button onClick={onReset}>{resetText}</Button>
        </Space>
      </FormItem>
    </Form>
  )
}

export default FilterBar
