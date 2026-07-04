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
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getAdjustmentLeave,
  applyAdjustmentLeave,
  cancelAdjustmentLeave,
} from '@/api/adjustment'
import type { LeaveAdjustment } from '@/api/adjustment'
import { getVacationTypes } from '@/api/vacation'
import type { VacationType } from '@/api/vacation'
import { FilterBar, TableHeader } from '@/components'
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

function Leave() {
  const [data, setData] = useState<LeaveAdjustment[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [vacationTypes, setVacationTypes] = useState<VacationType[]>([])

  const fetchVacationTypes = async () => {
    try {
      const res = await getVacationTypes()
      setVacationTypes(res.data)
    } catch {
      // error handled by interceptor
    }
  }

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getAdjustmentLeave({
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
    fetchVacationTypes()
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { visible, openCreate, close, handleOk } = useCrudModal<LeaveAdjustment>({
    form,
    onSubmit: async (values) => {
      const startDate = values.dateRange[0]
      const endDate = values.dateRange[1]
      const days =
        Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1

      await applyAdjustmentLeave({
        leaveType: values.leaveType,
        startDate,
        endDate,
        days: values.days || days,
        reason: values.reason,
      })
      toast.success('申请成功')
    },
    onSuccess: () => fetchData(pagination.current, pagination.pageSize),
  })

  const columns: TableProps<LeaveAdjustment>['columns'] = [
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
      title: '假别',
      dataIndex: 'leaveType',
      width: 90,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '开始时间',
      dataIndex: 'startDate',
      width: 110,
    },
    {
      title: '结束时间',
      dataIndex: 'endDate',
      width: 110,
    },
    {
      title: '天数',
      dataIndex: 'days',
      width: 80,
      render: (value: number) => `${value} 天`,
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
      render: (_: unknown, record: LeaveAdjustment) => (
        <Space size="small">
          <Button type="text" size="small" icon={<IconEye />}>
            详情
          </Button>
          {record.status === 'pending' && (
            <Popconfirm
              title="确认撤销"
              content="确定要撤销该请假申请吗？"
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
      await cancelAdjustmentLeave(id)
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
    <div className={styles['adjustment-leave']}>
      <Card bordered={false} className={styles['adjustment-leave__search-card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input
                  className={styles['adjustment-leave__search-input']}
                  placeholder="姓名/工号"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="状态">
                <Select
                  className={styles['adjustment-leave__status-select']}
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

      <Card bordered={false} className={styles['adjustment-leave__table-card']}>
        <TableHeader
          title="请假申请"
          total={pagination.total}
          totalText="条"
          extra={
            <Button type="primary" icon={<IconPlus />} onClick={openCreate}>
              申请请假
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
        title="申请请假"
        visible={visible}
        onOk={handleOk}
        onCancel={close}
        className={styles['adjustment-leave__modal']}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="假别"
            field="leaveType"
            rules={[{ required: true, message: '请选择假别' }]}
          >
            <Select placeholder="请选择假别">
              {vacationTypes.map((type) => (
                <Option key={type.code} value={type.code}>
                  {type.name}
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem
            label="请假时间"
            field="dateRange"
            rules={[{ required: true, message: '请选择请假时间' }]}
          >
            <RangePicker className={styles['adjustment-leave__range-picker']} />
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="请假天数" field="days">
                <Input type="number" placeholder="自动计算" suffix="天" />
              </FormItem>
            </Col>
          </Row>
          <FormItem
            label="请假原因"
            field="reason"
            rules={[{ required: true, message: '请输入请假原因' }]}
          >
            <Input.TextArea placeholder="请输入请假原因" rows={4} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default Leave
