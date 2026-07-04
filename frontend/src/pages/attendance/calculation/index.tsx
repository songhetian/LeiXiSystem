import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Form,
  Grid,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
} from '@arco-design/web-react'
import { IconCheck, IconCommon } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { calculateAttendance, getAttendanceMonthly, lockAttendanceMonthly } from '@/api/attendance'
import { PageHeader, FilterBar } from '@/components'
import { toast } from '@/utils/toast'
import styles from './calculation.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface AttendanceMonthlyRow {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  department: string
  expectedWorkDays: number
  actualWorkDays: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  absentDays: number
  lateCount: number
  earlyCount: number
  missingCheckinCount: number
  overtimeMinutes: number
  status: string
}

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  calculated: { text: '已核算', color: 'blue' },
  locked: { text: '已锁定', color: 'green' },
  reopened: { text: '已重开', color: 'orange' },
}

function getDefaultMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function normalizeMonthly(item: any): AttendanceMonthlyRow {
  return {
    id: item.id,
    employeeId: item.employeeId,
    employeeName: item.employee?.user?.realName || '-',
    employeeNo: item.employee?.employeeNo || '-',
    department: item.employee?.user?.department?.name || '-',
    expectedWorkDays: Number(item.expectedWorkDays || 0),
    actualWorkDays: Number(item.actualWorkDays || 0),
    paidLeaveDays: Number(item.paidLeaveDays || 0),
    unpaidLeaveDays: Number(item.unpaidLeaveDays || 0),
    absentDays: Number(item.absentDays || 0),
    lateCount: Number(item.lateCount || 0),
    earlyCount: Number(item.earlyCount || 0),
    missingCheckinCount: Number(item.missingCheckinCount || 0),
    overtimeMinutes: Number(item.overtimeMinutes || 0),
    status: item.status || 'draft',
  }
}

function AttendanceCalculationPage() {
  const [data, setData] = useState<AttendanceMonthlyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth())
  const [searchDept, setSearchDept] = useState<string | undefined>()

  const getSelectedYearMonth = useCallback(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    return { year, month }
  }, [selectedMonth])

  const loadData = useCallback(async () => {
    const { year, month } = getSelectedYearMonth()
    setLoading(true)
    try {
      const res = await getAttendanceMonthly({ year, month })
      setData((res.data || []).map(normalizeMonthly))
    } finally {
      setLoading(false)
    }
  }, [getSelectedYearMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredData = useMemo(() => {
    if (!searchDept) return data
    return data.filter((item) => item.department === searchDept)
  }, [data, searchDept])

  const departments = useMemo(() => {
    return Array.from(new Set(data.map((item) => item.department).filter(Boolean)))
  }, [data])

  const handleBatchCalc = useCallback(async () => {
    setCalculating(true)
    try {
      await calculateAttendance(getSelectedYearMonth())
      toast.success('月考勤核算完成')
      await loadData()
    } finally {
      setCalculating(false)
    }
  }, [getSelectedYearMonth, loadData])

  const handleLock = useCallback(() => {
    Modal.confirm({
      title: '锁定月考勤',
      content: '锁定后薪资批次将读取该月考勤结果，确认锁定？',
      onOk: async () => {
        await lockAttendanceMonthly(getSelectedYearMonth())
        toast.success('月考勤已锁定')
        await loadData()
      },
    })
  }, [getSelectedYearMonth, loadData])

  const stats = useMemo(() => [
    { title: '应出勤总天数', value: data.reduce((sum, item) => sum + item.expectedWorkDays, 0), suffix: '天', color: '#10B981' },
    { title: '实际出勤', value: data.reduce((sum, item) => sum + item.actualWorkDays, 0), suffix: '天', color: '#00B42A' },
    { title: '异常缺卡', value: data.reduce((sum, item) => sum + item.missingCheckinCount, 0), suffix: '次', color: '#FF7D00' },
    { title: '已锁定人数', value: data.filter((item) => item.status === 'locked').length, suffix: '人', color: '#722ED1' },
  ], [data])

  const columns: TableProps<AttendanceMonthlyRow>['columns'] = useMemo(() => [
    { title: '工号', dataIndex: 'employeeNo', width: 110, fixed: 'left' },
    { title: '姓名', dataIndex: 'employeeName', width: 110, fixed: 'left' },
    { title: '部门', dataIndex: 'department', width: 120 },
    { title: '应出勤', dataIndex: 'expectedWorkDays', width: 90 },
    { title: '实出勤', dataIndex: 'actualWorkDays', width: 90 },
    { title: '带薪假', dataIndex: 'paidLeaveDays', width: 90 },
    { title: '无薪假', dataIndex: 'unpaidLeaveDays', width: 90 },
    {
      title: '旷工',
      dataIndex: 'absentDays',
      width: 80,
      render: (value) => <Tag color={value > 0 ? 'red' : 'green'}>{value}天</Tag>,
    },
    {
      title: '迟到',
      dataIndex: 'lateCount',
      width: 80,
      render: (value) => <Tag color={value > 0 ? 'orange' : 'green'}>{value}次</Tag>,
    },
    {
      title: '早退',
      dataIndex: 'earlyCount',
      width: 80,
      render: (value) => <Tag color={value > 0 ? 'orange' : 'green'}>{value}次</Tag>,
    },
    {
      title: '缺卡',
      dataIndex: 'missingCheckinCount',
      width: 80,
      render: (value) => <Tag color={value > 0 ? 'red' : 'green'}>{value}次</Tag>,
    },
    {
      title: '加班',
      dataIndex: 'overtimeMinutes',
      width: 90,
      render: (value) => `${Math.round(value / 60 * 10) / 10}h`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      fixed: 'right',
      render: (value) => {
        const info = statusMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
  ], [])

  return (
    <div className={styles['attendance-calc']}>
      <Row gutter={16} className={styles['attendance-calc__stats-row']}>
        {stats.map((item) => (
          <Col span={6} key={item.title}>
            <Card bordered={false}>
              <Statistic
                title={item.title}
                value={item.value}
                suffix={item.suffix}
                className={styles['attendance-calc__stat-value']}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} className={styles['attendance-calc__intro-card']}>
        <PageHeader
          title="考勤核算"
          description="读取真实月考勤数据，核算后可锁定，薪资批次会基于锁定后的月考勤生成工资条。"
        />
      </Card>

      <Card bordered={false} className={styles['attendance-calc__intro-card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="部门">
                <Select
                  className={styles['attendance-calc__dept-select']}
                  placeholder="全部部门"
                  value={searchDept}
                  onChange={setSearchDept}
                  allowClear
                >
                  {departments.map((department) => (
                    <Option key={department} value={department}>{department}</Option>
                  ))}
                </Select>
              </FormItem>
              <FormItem label="月份">
                <Select className={styles['attendance-calc__month-select']} value={selectedMonth} onChange={setSelectedMonth}>
                  <Option value={getDefaultMonth()}>{getDefaultMonth()}</Option>
                  <Option value="2024-06">2024-06</Option>
                  <Option value="2024-05">2024-05</Option>
                  <Option value="2024-04">2024-04</Option>
                </Select>
              </FormItem>
            </>
          }
          onSearch={loadData}
          onReset={() => setSearchDept(undefined)}
        />
      </Card>

      <Card bordered={false}>
        <div className={styles['attendance-calc__result-header']}>
          <div>
            <span className={styles['attendance-calc__result-title']}>月考勤结果</span>
            <Tag color="blue" className={styles['attendance-calc__result-tag']}>
              共 {filteredData.length} 条
            </Tag>
          </div>
          <Space size="small">
            <Button
              type="primary"
              icon={<IconCommon />}
              loading={calculating}
              onClick={handleBatchCalc}
            >
              一键核算
            </Button>
            <Button status="success" icon={<IconCheck />} onClick={handleLock}>
              锁定月考勤
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          data={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1300 }}
        />
      </Card>
    </div>
  )
}

export default AttendanceCalculationPage
