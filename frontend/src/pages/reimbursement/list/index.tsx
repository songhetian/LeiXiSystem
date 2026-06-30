import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  Message,
  Tag,
  Card,
  DatePicker,
  Grid,
  Upload,
  Steps,
  Descriptions,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEye,
  IconUpload,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import dayjs, { Dayjs } from 'dayjs'
import {
  getReimbursementList,
  applyReimbursement,
  cancelReimbursement,
  getReimbursementDetail,
} from '@/api/reimbursement'
import type { Reimbursement } from '@/api/reimbursement'
import { formatDate } from '@/utils/date'
import './list.css'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  pending: { text: '审批中', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  paid: { text: '已支付', color: 'blue' },
  cancelled: { text: '已撤销', color: 'gray' },
}

const reimbursementTypes = ['差旅费', '交通费', '餐饮费', '办公用品', '招待费', '其他']

function ListPage() {
  const [data, setData] = useState<Reimbursement[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentDetail, setCurrentDetail] = useState<{ id: number; title: string; type: string; amount: number; status: string; currentStep?: number; description?: string | null; expenseDate?: string; createdAt: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<Dayjs[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getReimbursementList({
        page,
        pageSize,
        keyword: searchText || undefined,
        status: searchStatus,
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

  const columns: TableProps<Reimbursement>['columns'] = [
    {
      title: '报销单标题',
      dataIndex: 'title',
      width: 180,
    },
    {
      title: '报销类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => <Tag color="blue" className="reimbursement-list__type-tag">{value}</Tag>,
    },
    {
      title: '金额(元)',
      dataIndex: 'amount',
      width: 100,
      render: (value: number) => <span className="reimbursement-list__amount">¥{value}</span>,
    },
    {
      title: '费用日期',
      dataIndex: 'expenseDate',
      width: 110,
      render: (value: string) => formatDate(value),
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
      width: 160,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: Reimbursement) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconEye />}
            onClick={() => handleView(record.id)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <Button
              type="text"
              size="small"
              status="danger"
              onClick={() => handleCancel(record.id)}
            >
              撤销
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    form.resetFields()
    setVisible(true)
  }

  const handleView = async (id: number) => {
    try {
      const res = await getReimbursementDetail(id)
      setCurrentDetail(res.data)
      setDetailVisible(true)
    } catch {
      // error handled by interceptor
    }
  }

  const handleCancel = async (id: number) => {
    Modal.confirm({
      title: '确认撤销',
      content: '确定要撤销该报销申请吗？',
      onOk: async () => {
        try {
          await cancelReimbursement(id)
          Message.success('撤销成功')
          fetchData(pagination.current, pagination.pageSize)
        } catch {
          // error handled by interceptor
        }
      },
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      setSaving(true)
      await applyReimbursement({
        ...values,
        expenseDate: values.expenseDate
          ? new Date(values.expenseDate).toISOString().split('T')[0]
          : undefined,
      })
      Message.success('申请成功')
      setVisible(false)
      fetchData(1, pagination.pageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setSaving(false)
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
    <div className="reimbursement-list">
      <Card bordered={false} className="reimbursement-list__search-card">
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              className="reimbursement-list__search-input"
              placeholder="标题"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              className="reimbursement-list__status-select"
              placeholder="请选择"
              value={searchStatus}
              onChange={setSearchStatus}
              allowClear
            >
              <Option value="draft">草稿</Option>
              <Option value="pending">审批中</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已驳回</Option>
              <Option value="paid">已支付</Option>
              <Option value="cancelled">已撤销</Option>
            </Select>
          </FormItem>
          <FormItem label="申请时间">
            <RangePicker
              className="reimbursement-list__date-picker"
              value={dateRange}
              onChange={(_, date) => setDateRange(date)}
            />
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<IconRefresh />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false} className="reimbursement-list__table-card">
        <div className="reimbursement-list__table-header">
          <div>
            <span className="reimbursement-list__table-title">我的报销</span>
            <Tag color="blue" className="reimbursement-list__total-tag">
              共 {pagination.total} 条
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新建报销
          </Button>
        </div>

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

      <Modal
        title="新建报销"
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        confirmLoading={saving}
        className="reimbursement-list__modal"
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="报销标题"
            field="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入报销标题" />
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="报销类型"
                field="type"
                rules={[{ required: true, message: '请选择类型' }]}
              >
                <Select placeholder="请选择">
                  {reimbursementTypes.map((type) => (
                    <Option key={type} value={type}>{type}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="报销金额"
                field="amount"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <Input type="number" placeholder="请输入金额" prefix="¥" />
              </FormItem>
            </Col>
          </Row>
          <FormItem
            label="费用日期"
            field="expenseDate"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker className="reimbursement-list__form-item" />
          </FormItem>
          <FormItem label="费用说明" field="description">
            <Input.TextArea placeholder="请输入费用说明" rows={3} />
          </FormItem>
          <FormItem label="凭证上传">
            <Upload
              listType="picture-card"
              multiple
              limit={5}
              customRequest={() => {}}
            >
              <div className="reimbursement-list__upload-wrapper">
                <IconUpload className="reimbursement-list__upload-icon" />
                <div className="reimbursement-list__upload-text">上传凭证</div>
              </div>
            </Upload>
          </FormItem>
        </Form>
      </Modal>

      <Modal
        title="报销详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        className="reimbursement-list__modal"
      >
        {currentDetail && (
          <Space direction="vertical" size={20} className="reimbursement-list__form-item">
            <Steps current={currentDetail.currentStep || 0} className="reimbursement-list__steps">
              <Steps.Step title="提交申请" />
              <Steps.Step title="部门审批" />
              <Steps.Step title="财务审核" />
              <Steps.Step title="完成支付" />
            </Steps>
            <Descriptions
              border
              column={2}
              data={[
                { label: '报销标题', value: currentDetail.title },
                { label: '报销类型', value: currentDetail.type },
                { label: '金额', value: `¥${currentDetail.amount}` },
                { label: '费用日期', value: currentDetail.expenseDate ? formatDate(currentDetail.expenseDate) : '-' },
                { label: '状态', value: (statusMap[currentDetail.status] || {}).text || currentDetail.status },
                { label: '申请时间', value: new Date(currentDetail.createdAt).toLocaleString() },
                { label: '费用说明', value: currentDetail.description || '-', span: 2 },
              ]}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default ListPage
