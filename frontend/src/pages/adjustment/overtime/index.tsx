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
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getAdjustmentOvertime,
  applyAdjustmentOvertime,
  cancelAdjustmentOvertime,
} from '@/api/adjustment'
import type { OvertimeAdjustment } from '@/api/adjustment'
import { getAllOvertimeTypes, type OvertimeType } from '@/api/attendance-overtime-type'
import { FilterBar, TableHeader } from '@/components'
import { useCrudModal } from '@/hooks/useCrudModal'
import { toast } from '@/utils/toast'
import styles from './overtime.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '审批中', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  cancelled: { text: '已撤销', color: 'gray' },
}

function Overtime() {
  const [data, setData] = useState<OvertimeAdjustment[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
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
      const res = await getAdjustmentOvertime({
        page,
        pageSize,
        status: searchStatus,
        keyword: searchText || undefined,
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
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { visible, openCreate, close, handleOk } = useCrudModal<OvertimeAdjustment>({
    form,
    onSubmit: async (values) => {
      let hours = values.hours
      if (!hours && values.startTime && values.endTime) {
        const [startH, startM] = values.startTime.split(':').map(Number)
        const [endH, endM] = values.endTime.split(':').map(Number)
        hours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60
      }

      await applyAdjustmentOvertime({
        overtimeType: values.overtimeType,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        hours: hours || 0,
        reason: values.reason,
      })
      toast.success('申请成功')
    },
    onSuccess: () => fetchData(pagination.current, pagination.pageSize),
  })

  const columns: TableProps<OvertimeAdjustment>['columns'] = [
    {
      title: '申请人',
      dataIndex: 'employeeName',
      width: 100,
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      width: 100,
    },
    {
      title: '加班类型',
      dataIndex: 'overtimeType',
      width: 110,
      render: (value: string) => {
        const type = overtimeTypes.find((t) => t.code === value)
        return <Tag color="orange">{type?.name || value}</Tag>
      },
    },
    {
      title: '加班日期',
      dataIndex: 'date',
      width: 110,
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      width: 100,
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      width: 100,
    },
    {
      title: '时长(h)',
      dataIndex: 'hours',
      width: 90,
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
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 140,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '操作',
      width: 120,
      render: (_: unknown, record: OvertimeAdjustment) => (
        <Space size="small">
          <Button type="text" size="small" icon={<IconEye />}>
            详情
          </Button>
          {record.status === 'pending' && (
            <Popconfirm
              title="确认撤销"
              content="确定要撤销该加班申请吗？"
              onOk={() => handleCancel(record.id)}
            >
              <Button type="text" size="small" status="danger">
                撤销
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const handleCancel = async (id: number) => {
    try {
      await cancelAdjustmentOvertime(id)
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
    fetchData(1, pagination.pageSize)
  }

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize)
  }

  return (
    <div className={styles['adjustment-overtime']}>
      <Card bordered={false} className={styles['adjustment-overtime__search-card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input
                  className={styles['adjustment-overtime__search-input']}
                  placeholder="姓名/工号"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="状态">
                <Select
                  className={styles['adjustment-overtime__status-select']}
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
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
        />
      </Card>

      <Card bordered={false} className={styles['adjustment-overtime__table-card']}>
        <TableHeader
          title="加班申请"
          total={pagination.total}
          totalText="条"
          extra={
            <Button type="primary" icon={<IconPlus />} onClick={openCreate}>
              申请加班
            </Button>
          }
        />

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
        title="申请加班"
        visible={visible}
        onOk={handleOk}
        onCancel={close}
        className={styles['adjustment-overtime__modal']}
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
                    <Option key={type.code} value={type.code}>
                      {type.name}
                    </Option>
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
                <DatePicker className={styles['adjustment-overtime__date-picker']} />
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
            <Input type="number" placeholder="自动计算" suffix="小时" />
          </FormItem>
          <FormItem
            label="加班原因"
            field="reason"
            rules={[{ required: true, message: '请输入加班原因' }]}
          >
            <Input.TextArea placeholder="请输入加班原因" rows={4} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default Overtime
