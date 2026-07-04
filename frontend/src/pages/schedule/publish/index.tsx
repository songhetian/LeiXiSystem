import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Grid,
  Tabs,
  Statistic,
  Input,
  Select,
  DatePicker,
} from '@arco-design/web-react'
import { toast } from '@/utils/toast'
import {
  IconCheck,
  IconClose,
} from '@arco-design/web-react/icon'
import type { Dayjs } from 'dayjs'
import type { TableProps } from '@arco-design/web-react'
import {
  getConfirmations,
  getAppeals,
  handleAppeal,
  confirmBatch,
  type ScheduleConfirmationItem,
  type ScheduleAppealItem,
} from '@/api/schedule'
import { formatDate } from '@/utils/date'
import styles from './style.module.css'
const { Row, Col } = Grid
const Option = Select.Option
const TabPane = Tabs.TabPane

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待确认', color: 'orange' },
  confirmed: { text: '已确认', color: 'green' },
  appealed: { text: '申诉中', color: 'blue' },
  auto_confirmed: { text: '自动确认', color: 'gray' },
}

function PublishPage() {
  const [loading, setLoading] = useState(false)
  const [confirmations, setConfirmations] = useState<ScheduleConfirmationItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [stats, setStats] = useState<Record<string, number>>({})

  const [appealLoading, setAppealLoading] = useState(false)
  const [appeals, setAppeals] = useState<ScheduleAppealItem[]>([])
  const [appealTotal, setAppealTotal] = useState(0)
  const [appealPage, setAppealPage] = useState(1)

  const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([])

  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [dateRange, setDateRange] = useState<Dayjs[]>([])

  const fetchConfirmations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getConfirmations({
        page,
        pageSize,
        status: searchStatus,
        keyword: searchKeyword || undefined,
        startDate: dateRange[0]?.format?.('YYYY-MM-DD'),
        endDate: dateRange[1]?.format?.('YYYY-MM-DD'),
      })
      if (res.code === 0) {
        setConfirmations(res.data.list)
        setTotal(res.data.total)
        setStats(res.data.stats)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchStatus, searchKeyword, dateRange])

  const fetchAppeals = useCallback(async () => {
    setAppealLoading(true)
    try {
      const res = await getAppeals({ page: appealPage, pageSize: 20, status: 'pending' })
      if (res.code === 0) {
        setAppeals(res.data.list)
        setAppealTotal(res.data.total)
      }
    } finally {
      setAppealLoading(false)
    }
  }, [appealPage])

  useEffect(() => {
    fetchConfirmations()
  }, [fetchConfirmations])

  useEffect(() => {
    fetchAppeals()
  }, [fetchAppeals])

  const handleBatchConfirm = async () => {
    if (selectedRowKeys.length === 0) {
      toast.warning('请先选择要确认的排班')
      return
    }
    await confirmBatch(selectedRowKeys as number[])
    toast.success('批量确认成功')
    setSelectedRowKeys([])
    fetchConfirmations()
  }

  const handleAppealAction = async (id: number, status: 'approved' | 'rejected') => {
    await handleAppeal(id, { status })
    toast.success(status === 'approved' ? '已批准申诉' : '已驳回申诉')
    fetchAppeals()
  }

  const confirmationColumns: TableProps<ScheduleConfirmationItem>['columns'] = [
    {
      title: '员工',
      dataIndex: 'user',
      width: 100,
      render: (_: any, record: ScheduleConfirmationItem) => (
        <div>
          <div className={styles['schedule-publish__cell-name']}>{record.user?.realName}</div>
          <div className={styles['schedule-publish__cell-dept']}>{record.user?.department?.name}</div>
        </div>
      ),
    },
    {
      title: '日期',
      dataIndex: 'schedule',
      width: 110,
      render: (_: any, record: ScheduleConfirmationItem) => record.schedule?.scheduleDate ? formatDate(record.schedule.scheduleDate) : '',
    },
    {
      title: '班次',
      dataIndex: 'schedule',
      width: 100,
      render: (_: any, record: ScheduleConfirmationItem) => (
        <Tag color={record.schedule?.shift?.color || 'arcoblue'}>{record.schedule?.shift?.name}</Tag>
      ),
    },
    {
      title: '班次时间',
      width: 140,
      render: (_: any, record: ScheduleConfirmationItem) => {
        const shift = record.schedule?.shift
        return shift?.startTime && shift?.endTime
          ? `${shift.startTime} - ${shift.endTime}`
          : '-'
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (val: string) => {
        const s = statusMap[val] || { text: val, color: 'gray' }
        return <Tag color={s.color}>{s.text}</Tag>
      },
    },
    {
      title: '确认时间',
      dataIndex: 'confirmAt',
      width: 160,
      render: (val: string) => val ? val.replace('T', ' ').slice(0, 19) : '-',
    },
  ]

  const appealColumns: TableProps<ScheduleAppealItem>['columns'] = [
    {
      title: '员工',
      dataIndex: 'user',
      width: 100,
      render: (_: any, record: ScheduleAppealItem) => (
        <div>
          <div className={styles['schedule-publish__cell-name']}>{record.user?.realName}</div>
          <div className={styles['schedule-publish__cell-dept']}>{record.user?.department?.name}</div>
        </div>
      ),
    },
    {
      title: '原排班',
      dataIndex: 'schedule',
      width: 200,
      render: (_: any, record: ScheduleAppealItem) => (
        <div>
          <div>{record.schedule?.scheduleDate ? formatDate(record.schedule.scheduleDate) : ''}</div>
          <Tag color={record.schedule?.shift?.color}>{record.schedule?.shift?.name}</Tag>
        </div>
      ),
    },
    {
      title: '期望调整',
      width: 200,
      render: (_: any, record: ScheduleAppealItem) => (
        <div>
          {record.expectedDate && <div>日期: {record.expectedDate}</div>}
          {record.expectedShiftName && <Tag color="arcoblue">{record.expectedShiftName}</Tag>}
        </div>
      ),
    },
    {
      title: '申诉原因',
      dataIndex: 'reason',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (val: string) => {
        const map: Record<string, string> = { pending: '待处理', approved: '已批准', rejected: '已驳回' }
        const colorMap: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red' }
        return <Tag color={colorMap[val]}>{map[val]}</Tag>
      },
    },
    {
      title: '操作',
      width: 150,
      render: (_, record) => record.status === 'pending' ? (
        <Space>
          <Button type="text" size="small" status="success" icon={<IconCheck />} onClick={() => handleAppealAction(record.id, 'approved')}>
            批准
          </Button>
          <Button type="text" size="small" status="danger" icon={<IconClose />} onClick={() => handleAppealAction(record.id, 'rejected')}>
            驳回
          </Button>
        </Space>
      ) : (
        <span className={styles['schedule-publish__text-secondary']}>{record.handler?.realName} {record.handledAt ? formatDate(record.handledAt) : ''}</span>
      ),
    },
  ]

  return (
    <div className={styles['schedule-publish']}>
      <Card bordered={false} title="排班发布与确认">
        <Tabs defaultActiveTab="confirmations">
          <TabPane title="确认管理" key="confirmations">
            <Row gutter={16} className={styles['schedule-publish__row-margin']}>
              <Col span={6}>
                <Statistic title="待确认" value={stats.pending || 0} />
              </Col>
              <Col span={6}>
                <Statistic title="已确认" value={stats.confirmed || 0} />
              </Col>
              <Col span={6}>
                <Statistic title="申诉中" value={stats.appealed || 0} />
              </Col>
              <Col span={6}>
                <Statistic title="自动确认" value={stats.auto_confirmed || 0} />
              </Col>
            </Row>

            <Space className={styles['schedule-publish__space-margin']} wrap>
              <Input.Search placeholder="搜索员工" className={styles['schedule-publish__search']} onSearch={setSearchKeyword} allowClear />
              <Select placeholder="状态" className={styles['schedule-publish__select-status']} allowClear onChange={setSearchStatus}>
                <Option value="pending">待确认</Option>
                <Option value="confirmed">已确认</Option>
                <Option value="appealed">申诉中</Option>
                <Option value="auto_confirmed">自动确认</Option>
              </Select>
              <DatePicker.RangePicker onChange={(d: any) => setDateRange(d ? [d[0], d[1]] : [])} />
              <Button type="primary" icon={<IconCheck />} onClick={handleBatchConfirm} disabled={selectedRowKeys.length === 0}>
                批量确认 ({selectedRowKeys.length})
              </Button>
            </Space>

            <Table
              rowKey="id"
              loading={loading}
              columns={confirmationColumns}
              data={confirmations}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
              pagination={{
                total,
                current: page,
                pageSize,
                onChange: (p, ps) => { setPage(p); setPageSize(ps) },
              }}
            />
          </TabPane>

          <TabPane title={`申诉待处理 (${appealTotal})`} key="appeals">
            <Table
              rowKey="id"
              loading={appealLoading}
              columns={appealColumns}
              data={appeals}
              pagination={{
                total: appealTotal,
                current: appealPage,
                pageSize: 20,
                onChange: setAppealPage,
              }}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default PublishPage
