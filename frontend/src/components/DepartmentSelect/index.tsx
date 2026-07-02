import { useState, useEffect, useCallback } from 'react'
import { Select } from '@arco-design/web-react'
import { getDepartmentsList, Department } from '@/api/organization'
const Option = Select.Option

interface DepartmentSelectProps {
  value?: number | number[]
  onChange?: (value: number | number[]) => void
  placeholder?: string
  allowClear?: boolean
  mode?: 'multiple' | 'tags'
  className?: string
}

function DepartmentSelect({
  value,
  onChange,
  placeholder = '选择部门',
  allowClear = true,
  mode,
  className = '',
}: DepartmentSelectProps) {
  const [data, setData] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDepartmentsList()
      setData(res.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      allowClear={allowClear}
      mode={mode}
      className={className}
      loading={loading}
    >
      {data.map((department) => (
        <Option key={department.id} value={department.id}>
          {department.name}
        </Option>
      ))}
    </Select>
  )
}

export default DepartmentSelect
