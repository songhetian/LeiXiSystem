import { useState, useEffect, useCallback } from 'react'
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
  getOvertimeList,
  createOvertime,
  updateOvertime,
  cancelOvertime,
} from '@/api/attendance'
import type { OvertimeRequest } from '@/api/attendance'
import { toast } from '@/utils/toast'
import { formatDate } from '@/utils/date'
import { getAllOvertimeTypes, type OvertimeType } from '@/api/attendance-overtime-type'
import { FilterBar, PageHeader, flatEmployeeNameColumn, flatEmployeeNoColumn, flatDepartmentNameColumn } from '@/components'
import { useCrudModal } from '@/hooks/useCrudModal'
import styles from './overtime.module.css'
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

function Overtime() {
  const [data, setData] = useState<OvertimeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<Dayjs[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [overtimeTypes, setOvertimeTypes] = useState<OvertimeType[]>([])

  const fetchOvertimeTypes = useCallback(async () => {
    try {
      const res = await getAllOvertimeTypes()
      if (res.code === 0) {
        setOvertimeTypes(res.data)
      }
    } catch {
      // error handled by interceptor
    }
  }, [])

  useEffect(() => {
    fetchOvertimeTypes()
  }, [fetchOvertimeTypes])

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getOvertimeList({
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

  const { visible, editingId, saving, openCreate, openEdit, close, handleOk } = useCrudModal<OvertimeRequest>({
    form,
    mapRecordToForm: (record) => ({
      ...record,
      date: new Date(record.date),
    }),
    onSubmit: async (values, id) => {
      const submitData = {
        ...values,
        date: values.date ? formatDate(values.date) : undefined,
      }
      if (id) {
        await updateOvertime(id, submitData as any)
        toast.success('修改成功')
      } else {
        await createOvertime(submitData as any)
        toast.success('申请成功')
      }
    },
    onSuccess: () => fetchData(pagination.current, pagination.pageSize),
  })

  const columns: TableProps<OvertimeRequest>['columns'] = [
    flatEmployeeNameColumn(),
    flatEmployeeNoColumn(),
    flatDepartmentNameColumn(),
    {
      title: '加班类型',
      dataIndex: 'overtimeType',
      width: 110,
      render: (value: string) => {
        const type = overtimeTypes.find((t) => t.code === value)
        return <Tag color="orange" className={styles['attendance-overtime__type-tag']}>{type?.name || value}</Tag>
      },
    },
    {
      title: '加班日期',
      dataIndex: 'date',
      width: 110,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    { title: '开始时间', dataIndex: 'startTime', width: 100 },
    { title: '结束时间', dataIndex: 'endTime', width: 100 },
    {
      title: '时长(h)',
      dataIndex: 'hours',
      width: 90,
      render: (value: number) => (
        <span className={styles['attendance-overtime__hours']}>{value}</span>
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
      title: '操作',
      width: 150,
      render: (_: unknown, record: OvertimeRequest) => (
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
                content="确定要撤销该加班申请吗？"
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

  const handleEdit = (record: OvertimeRequest) => {
    openEdit(record)
  }

  const handleCancel = async (id: number) => {
    try {
      await cancelOvertime(id)
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
    <div className={styles['attendance-overtime']}>
      <Card bordered={false} className={styles['attendance-overtime__card']}>
        <PageHeader
          title="加班记录"
          extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>申请加班</Button>}
        />
      </Card>

      <Card bordered={false} className={styles['attendance-overtime__card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input
                  className={styles['attendance-overtime__search-input']}
                  placeholder="姓名/工号"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="状态">
                <Select
                  className={styles['attendance-overtime__status-select']}
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
              <FormItem label="加班日期">
                <RangePicker
                  className={styles['attendance-overtime__date-picker']}
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
        />
      </Card>

      <Modal focusLock
        title={editingId ? '编辑加班' : '申请加班'}
        visible={visible}
        onOk={handleOk}
        onCancel={close}
        confirmLoading={saving}
        className={styles['attendance-overtime__modal']}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="加班类型"
                field="overtimeType"
                rules={[{ required: true, message: '请选择加班类型' }]}
              >
                <Select placeholder="请选择">
                  {overtimeTypes.map((type) => (
                    <Option key={type.code} value={type.code}>{type.name}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="加班日期"
                field="date"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker className={styles['attendance-overtime__date-picker']} />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="开始时间"
                field="startTime"
                rules={[{ required: true, message: '请输入开始时间' }]}
              >
                <Input placeholder="如 18:30" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="结束时间"
                field="endTime"
                rules={[{ required: true, message: '请输入结束时间' }]}
              >
                <Input placeholder="如 21:00" />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="加班时长" field="hours">
            <Input type="number" placeholder="请输入时长" suffix="小时" />
          </FormItem>
          <FormItem label="加班原因" field="reason">
            <Input.TextArea placeholder="请输入加班原因" rows={4} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default Overtime
