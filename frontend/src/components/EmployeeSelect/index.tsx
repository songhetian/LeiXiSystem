import { useState, useEffect, useCallback } from 'react'
import { Select } from '@arco-design/web-react'
import { getEmployees, Employee } from '@/api/personnel'
const Option = Select.Option

interface EmployeeSelectProps {
  value?: number
  onChange?: (value: number) => void
  placeholder?: string
  allowClear?: boolean
  className?: string
}

function EmployeeSelect({
  value,
  onChange,
  placeholder = '选择员工',
  allowClear = true,
  className = '',
}: EmployeeSelectProps) {
  const [data, setData] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEmployees({ page: 1, pageSize: 1000, status: 'active' })
      setData(res.data?.list || [])
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
      showSearch
      className={className}
      loading={loading}
    >
      {data.map((employee) => (
        <Option key={employee.id} value={employee.id}>
          {employee.realName}（{employee.employeeNo}）
        </Option>
      ))}
    </Select>
  )
}

export default EmployeeSelect
