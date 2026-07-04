import { useState } from 'react'
import { Input, Button, Message, Space } from '@arco-design/web-react'
import { IconLeft, IconRight } from '@arco-design/web-react/icon'
import styles from './index.module.css'
interface PaginationJumperProps {
  /** 当前页码 */
  current: number
  /** 总页数 */
  total: number
  /** 每页条数 */
  pageSize: number
  /** 页码变化回调 */
  onChange: (page: number) => void
  className?: string
}

/**
 * 分页跳转组件
 *
 * @example
 * <PaginationJumper
 *   current={1}
 *   total={100}
 *   pageSize={10}
 *   onChange={(page) => console.log(page)}
 * />
 */
export function PaginationJumper({
  current,
  total,
  pageSize,
  onChange,
  className = '',
}: PaginationJumperProps) {
  const [inputValue, setInputValue] = useState('')
  const totalPages = Math.ceil(total / pageSize)

  const handleJump = () => {
    const page = parseInt(inputValue, 10)
    if (isNaN(page) || page < 1) {
      Message.warning('请输入有效的页码')
      return
    }
    if (page > totalPages) {
      Message.warning(`最大页码为 ${totalPages}`)
      return
    }
    onChange(page)
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJump()
    }
  }

  if (totalPages <= 1) {
    return null
  }

  return (
    <Space className={`${styles['pagination-jumper']} ${className}`}>
      <Button
        size="mini"
        icon={<IconLeft />}
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
      />
      <span className={styles['pagination-jumper__text']}>
        第
        <Input
          size="mini"
          className={styles['pagination-jumper__input']}
          value={inputValue}
          onChange={setInputValue}
          onKeyDown={handleKeyDown}
          placeholder={String(current)}
        />
        / {totalPages} 页
      </span>
      <Button
        size="mini"
        icon={<IconRight />}
        disabled={current >= totalPages}
        onClick={() => onChange(current + 1)}
      />
      <Button size="mini" onClick={handleJump}>
        跳转
      </Button>
    </Space>
  )
}

export default PaginationJumper
