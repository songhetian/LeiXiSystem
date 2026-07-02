import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  Tag,
  Popconfirm,
  Card,
  DatePicker,
  Grid,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import type { Dayjs } from 'dayjs'
import {
  getLeaveList,
  createLeave,
  updateLeave,
  cancelLeave,
} from '@/api/attendance'
import type { LeaveRequest } from '@/api/attendance'
import { formatDate } from '@/utils/date'
import { FilterBar, PageHeader, flatEmployeeNameColumn, flatEmployeeNoColumn, flatDepartmentNameColumn } from '@/components'
import { useCrudModal } from '@/hooks/useCrudModal'
import { toast } from '@/utils/toast'
import styles from './leave.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '审批中', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  cancelled: { text: '已撤销', color: 'gray' },
}

const leaveTypes = ['年假', '事假', '病假', '婚假', '产假', '丧假', '调休']

function Leave() {
  const [data, setData] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<Dayjs[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getLeaveList({
        page,
        pageSize,
        keyword: searchText || undefined,
        status: searchStatus,
        startDate: dateRange[0]?.format('YYYY-MM-DD'),
        endDate: dateRange[1]?.format('YYYY-MM-DD'),
      })
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, current: page, pageSize, total: res.data.total }))
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(pagination.current, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { visible, editingId, saving, openCreate, openEdit, close, handleOk } = useCrudModal<LeaveRequest>({
    form,
    mapRecordToForm: (record) => ({
      ...record,
      dateRange: [new Date(record.startDate), new Date(record.endDate)],
    }),
    onSubmit: async (values, id) => {
      const startDate = values.dateRange?.[0]
        ? formatDate(values.dateRange[0])
        : undefined
      const endDate = values.dateRange?.[1]
        ? formatDate(values.dateRange[1])
        : undefined

      const submitData = {
        leaveType: values.leaveType,
        startDate,
        endDate,
        days: values.days,
        reason: values.reason,
      }

      if (id) {
        await updateLeave(id, submitData)
        toast.success('修改成功')
      } else {
        await createLeave(submitData as { leaveType: string; startDate: string; endDate: string; days: number; reason: string })
        toast.success('申请成功')
      }
    },
    onSuccess: () => fetchData(pagination.current, pagination.pageSize),
  })

  const columns: TableProps<LeaveRequest>['columns'] = [
    flatEmployeeNameColumn(),
    flatEmployeeNoColumn(),
    flatDepartmentNameColumn(),
    {
      title: '假别',
      dataIndex: 'leaveType',
      width: 90,
      render: (value: string) => <Tag color="blue" className={styles['attendance-leave__type-tag']}>{value}</Tag>,
    },
    {
      title: '开始时间',
      dataIndex: 'startDate',
      width: 110,
      render: (value: string) => formatDate(value),
    },
    {
      title: '结束时间',
      dataIndex: 'endDate',
      width: 110,
      render: (value: string) => formatDate(value),
    },
    {
      title: '天数',
      dataIndex: 'days',
      width: 80,
      render: (value: number) => (
        <span className={styles['attendance-leave__days']}>{value} 天</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const info = statusMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: LeaveRequest) => (
        <Space size="small">
          <Button type="text" size="small" icon={<IconEye />}>
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="text"
                size="small"
                icon={<IconEdit />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
              <Popconfirm
                title="确认撤销"
                content="确定要撤销该请假申请吗？"
                onOk={() => handleCancel(record.id)}
              >
                <Button type="text" size="small" status="danger">
                  撤销
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  const handleEdit = (record: LeaveRequest) => {
    openEdit(record)
  }

  const handleCancel = async (id: number) => {
    try {
      await cancelLeave(id)
      toast.success('撤销成功')
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchStatus(undefined)
    setDateRange([])
    fetchData(1, pagination.pageSize)
  }

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize)
  }

  return (
    <div className={styles['attendance-leave']}>
      <Card bordered={false} className={styles['attendance-leave__card']}>
        <PageHeader
          title="请假记录"
          extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>申请请假</Button>}
        />
      </Card>

      <Card bordered={false} className={styles['attendance-leave__card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input
                  className={styles['attendance-leave__search-input']}
                  placeholder="姓名/工号"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="状态">
                <Select
                  className={styles['attendance-leave__status-select']}
                  placeholder="请选择"
                  value={searchStatus}
                  onChange={setSearchStatus}
                  allowClear
                >
                  <Option value="pending">审批中</Option>
                  <Option value="approved">已通过</Option>
                  <Option value="rejected">已驳回</Option>
                  <Option value="cancelled">已撤销</Option>
                </Select>
              </FormItem>
              <FormItem label="请假时间">
                <RangePicker
                  className={styles['attendance-leave__date-picker']}
                  value={dateRange}
                  onChange={(_, date) => setDateRange(date)}
                />
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
          searchText="搜索"
        />
      </Card>

      <Card bordered={false}>
        <Table
          loading={loading}
          columns={columns}
          data={data}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal focusLock
        title={editingId ? '编辑请假' : '申请请假'}
        visible={visible}
        onOk={handleOk}
        onCancel={close}
        confirmLoading={saving}
        className={styles['attendance-leave__modal']}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="假别"
            field="leaveType"
            rules={[{ required: true, message: '请选择假别' }]}
          >
            <Select placeholder="请选择假别">
              {leaveTypes.map((type) => (
                <Option key={type} value={type}>{type}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem
            label="请假时间"
            field="dateRange"
            rules={[{ required: true, message: '请选择请假时间' }]}
          >
            <RangePicker className={styles['attendance-leave__range-picker']} />
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="请假天数" field="days">
                <Input type="number" placeholder="请输入天数" suffix="天" />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="请假原因" field="reason">
            <Input.TextArea placeholder="请输入请假原因" rows={4} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default Leave
