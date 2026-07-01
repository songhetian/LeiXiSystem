import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  Message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  DatePicker,
  Popconfirm,
} from '@arco-design/web-react'
import {
  getMonthlyAttendance,
  batchCalculateMonthly,
  batchLockMonthly,
  batchUnlockMonthly,
  MonthlyAttendance,
} from '@/api/attendance'
import { PageHeader, FilterBar, BatchActions, employeeColumn, departmentColumn } from '@/components'
import { useBatchSelection } from '@/hooks/useBatchSelection'
import './index.css'

const FormItem = Form.Item
const Option = Select.Option
const { MonthPicker } = DatePicker

const statusMap: Record<string, { text: string; color: string }> = {
  calculated: { text: '已计算', color: 'blue' },
  locked: { text: '已锁定', color: 'green' },
  pending: { text: '待计算', color: 'orange' },
}

function AttendanceMonthlyPage() {
  const [data, setData] = useState<MonthlyAttendance[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [form] = Form.useForm()
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>()
  const [calculateVisible, setCalculateVisible] = useState(false)
  const [lockVisible, setLockVisible] = useState(false)
  const batch = useBatchSelection<MonthlyAttendance>()

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const loadData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const values = form.getFieldsValue()
      const params: any = { page, pageSize }
      if (values.year && values.month) {
        params.year = values.year
        params.month = values.month
      }
      if (values.employeeId) params.employeeId = values.employeeId
      if (values.status) params.status = values.status

      const res = await getMonthlyAttendance(params)
      setData(res.data.list || [])
      setPagination({
        current: res.data.page || page,
        pageSize: res.data.pageSize || pageSize,
        total: res.data.total || 0,
      })
    } catch (e: any) {
      Message.error(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSearch = () => {
    loadData(1, pagination.pageSize)
    batch.clearSelection()
  }

  const handleReset = () => {
    form.resetFields()
    setSelectedMonth(undefined)
    loadData(1, pagination.pageSize)
    batch.clearSelection()
  }

  const handlePageChange = (page: number, pageSize: number) => {
    loadData(page, pageSize)
  }

  const handleMonthChange = (dateString: string) => {
    setSelectedMonth(dateString)
    if (dateString) {
      const [year, month] = dateString.split('-').map(Number)
      form.setFieldsValue({ year, month })
    } else {
      form.setFieldsValue({ year: undefined, month: undefined })
    }
  }

  // 批量计算
  const handleBatchCalculate = async () => {
    const year = form.getFieldValue('year') || currentYear
    const month = form.getFieldValue('month') || currentMonth
    const employeeIds = batch.selectedIds.length > 0 ? batch.selectedIds as number[] : undefined

    try {
      const res = await batchCalculateMonthly({ year, month, employeeIds })
      Message.success(res.message || `成功计算`)
      setCalculateVisible(false)
      batch.clearSelection()
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      Message.error(e?.message || '计算失败')
    }
  }

  // 批量锁定
  const handleBatchLock = async () => {
    const year = form.getFieldValue('year') || currentYear
    const month = form.getFieldValue('month') || currentMonth
    const employeeIds = batch.selectedIds.length > 0 ? batch.selectedIds as number[] : undefined

    try {
      const res = await batchLockMonthly({ year, month, employeeIds })
      Message.success(res.message || `成功锁定`)
      setLockVisible(false)
      batch.clearSelection()
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      Message.error(e?.message || '锁定失败')
    }
  }

  // 批量解锁
  const handleBatchUnlock = async () => {
    const year = form.getFieldValue('year') || currentYear
    const month = form.getFieldValue('month') || currentMonth
    const employeeIds = batch.selectedIds.length > 0 ? batch.selectedIds as number[] : undefined

    try {
      const res = await batchUnlockMonthly({ year, month, employeeIds })
      Message.success(res.message || `成功解锁`)
      batch.clearSelection()
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      Message.error(e?.message || '解锁失败')
    }
  }

  const columns = [
    employeeColumn(),
    departmentColumn(),
    {
      title: '年份',
      dataIndex: 'year',
      width: 80,
    },
    {
      title: '月份',
      dataIndex: 'month',
      width: 70,
      render: (value: number) => `${value}月`,
    },
    {
      title: '正常天数',
      dataIndex: 'normalDays',
      width: 90,
    },
    {
      title: '迟到天数',
      dataIndex: 'lateDays',
      width: 90,
    },
    {
      title: '早退天数',
      dataIndex: 'earlyDays',
      width: 90,
    },
    {
      title: '旷工天数',
      dataIndex: 'absentDays',
      width: 90,
    },
    {
      title: '请假天数',
      dataIndex: 'leaveDays',
      width: 90,
    },
    {
      title: '加班小时',
      dataIndex: 'overtimeHours',
      width: 90,
    },
    {
      title: '工时',
      dataIndex: 'workHours',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const info = statusMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
  ]

  return (
    <div className="attendance-monthly">
      <Card bordered={false}>
        <PageHeader
          title="考勤月度结算"
          description="批量计算、锁定和管理员工月度考勤数据。"
        />
      </Card>

      <Card bordered={false}>
        <FilterBar
          filters={
            <>
              <FormItem label="年月" field="monthPicker">
                <MonthPicker
                  placeholder="选择年月"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  format="yyyy-MM"
                />
              </FormItem>
              <FormItem label="状态" field="status">
                <Select placeholder="全部状态" allowClear className="attendance-monthly__select">
                  <Option value="calculated">已计算</Option>
                  <Option value="locked">已锁定</Option>
                  <Option value="pending">待计算</Option>
                </Select>
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
          searchText="搜索"
        />
      </Card>

      <Card bordered={false}>
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={() => setCalculateVisible(true)}>
            批量计算
          </Button>
          <Popconfirm
            title="确认批量锁定？"
            content="锁定后员工将不能修改该月的考勤记录"
            onOk={() => setLockVisible(true)}
          >
            <Button>批量锁定</Button>
          </Popconfirm>
          <Button status="warning" onClick={handleBatchUnlock}>
            批量解锁
          </Button>
        </Space>

        <BatchActions
          selectedCount={batch.selectedCount}
          onClear={batch.clearSelection}
          actions={
            <>
              <Button type="primary" onClick={() => setCalculateVisible(true)}>
                批量计算
              </Button>
              <Button onClick={() => setLockVisible(true)}>批量锁定</Button>
              <Button status="warning" onClick={handleBatchUnlock}>
                批量解锁
              </Button>
            </>
          }
        />

        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={columns}
          rowSelection={batch.getRowSelection(data)}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 批量计算确认弹窗 */}
      <Modal
        title="批量计算考勤"
        visible={calculateVisible}
        onOk={handleBatchCalculate}
        onCancel={() => setCalculateVisible(false)}
        confirmLoading={loading}
      >
        <p>确定要批量计算 {form.getFieldValue('year') || currentYear} 年 {form.getFieldValue('month') || currentMonth} 月的考勤数据吗？</p>
        {batch.selectedCount > 0 && <p>将计算选中的 {batch.selectedCount} 名员工</p>}
      </Modal>

      {/* 批量锁定确认弹窗 */}
      <Modal
        title="批量锁定考勤"
        visible={lockVisible}
        onOk={handleBatchLock}
        onCancel={() => setLockVisible(false)}
        confirmLoading={loading}
      >
        <p>确定要批量锁定 {form.getFieldValue('year') || currentYear} 年 {form.getFieldValue('month') || currentMonth} 月的考勤数据吗？</p>
        {batch.selectedCount > 0 && <p>将锁定选中的 {batch.selectedCount} 名员工</p>}
      </Modal>
    </div>
  )
}

export default AttendanceMonthlyPage
