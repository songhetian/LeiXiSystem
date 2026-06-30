import { useState, useEffect, useMemo } from 'react'
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
  Grid,
  Tabs,
  Steps,
  Descriptions,
} from '@arco-design/web-react'
import {
  IconSearch,
  IconRefresh,
  IconCheck,
  IconClose,
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getPendingReimbursement,
  approveReimbursement,
  rejectReimbursement,
  getReimbursementDetail,
} from '@/api/reimbursement'
import type { PendingReimbursement } from '@/api/reimbursement'
import { formatDate } from '@/utils/date'
import './approval.css'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
}

const reimbursementTypes = [
  { value: '差旅费', label: '差旅费' },
  { value: '餐饮费', label: '餐费' },
  { value: '交通费', label: '交通费' },
  { value: '办公用品', label: '办公用品' },
  { value: '招待费', label: '招待费' },
  { value: '其他', label: '其他' },
]

function Approval() {
  const [data, setData] = useState<PendingReimbursement[]>([])
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentDetail, setCurrentDetail] = useState<{ id: number; title: string; type: string; amount: number; status: string; currentStep?: number; employee?: { user?: { realName: string; department?: { name: string } } }; description?: string | null; expenseDate?: string; createdAt: string } | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState('all')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [opinionForm] = Form.useForm()

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getPendingReimbursement({
        page,
        pageSize,
        type: activeTab !== 'all' ? activeTab : undefined,
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
  }, [activeTab])

  const filteredData = useMemo(() => {
    let result = data
    if (searchText) {
      result = result.filter(
        (item) =>
          item.title.includes(searchText) ||
          item.applicantName.includes(searchText),
      )
    }
    if (searchType) {
      result = result.filter((item) => item.type === searchType)
    }
    return result
  }, [data, searchText, searchType])

  const columns: TableProps<PendingReimbursement>['columns'] = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 180,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      width: 100,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      render: (value: number) => (
        <span className="reimbursement-approval__amount">¥{value}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => {
        const info = statusMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '操作',
      width: 180,
      render: (_: unknown, record: PendingReimbursement) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconEye />}
            onClick={() => handleView(record.id)}
          >
            详情
          </Button>
          <Button
            type="text"
            size="small"
            status="success"
            icon={<IconCheck />}
            onClick={() => handleApprove(record.id)}
          >
            通过
          </Button>
          <Button
            type="text"
            size="small"
            status="danger"
            icon={<IconClose />}
            onClick={() => handleReject(record.id)}
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ]

  const handleView = async (id: number) => {
    try {
      const res = await getReimbursementDetail(id)
      setCurrentDetail(res.data)
      setDetailVisible(true)
    } catch {
      // error handled by interceptor
    }
  }

  const handleApprove = async (id: number) => {
    Modal.confirm({
      title: '通过确认',
      content: '确定要通过该报销申请吗？',
      okText: '确认通过',
      cancelText: '取消',
      onOk: async () => {
        try {
          await approveReimbursement(id)
          Message.success('审批通过')
          fetchData(pagination.current, pagination.pageSize)
        } catch {
          // error handled by interceptor
        }
      },
    })
  }

  const handleReject = (id: number) => {
    opinionForm.resetFields()
    Modal.confirm({
      title: '驳回确认',
      content: (
        <Form form={opinionForm} layout="vertical">
          <FormItem label="驳回原因" field="opinion" rules={[{ required: true, message: '请输入驳回原因' }]}>
            <Input.TextArea placeholder="请输入驳回原因" rows={3} />
          </FormItem>
        </Form>
      ),
      okText: '确认驳回',
      cancelText: '取消',
      onOk: async () => {
        try {
          const values = await opinionForm.validate()
          await rejectReimbursement(id, { opinion: values.opinion })
          Message.success('已驳回')
          fetchData(pagination.current, pagination.pageSize)
        } catch {
          // error handled by interceptor
          return false
        }
      },
    })
  }

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchType(undefined)
    fetchData(1, pagination.pageSize)
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
  }

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize)
  }

  return (
    <div className="reimbursement-approval">
      <Card bordered={false} className="reimbursement-approval__tabs-card">
        <Tabs activeTab={activeTab} onChange={handleTabChange}>
          <TabPane key="all" title={`全部待审批 (${pagination.total})`} />
          {reimbursementTypes.map((type) => (
            <TabPane key={type.value} title={type.label} />
          ))}
        </Tabs>
      </Card>

      <Card bordered={false} className="reimbursement-approval__search-card">
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              className="reimbursement-approval__search-input"
              placeholder="标题/申请人"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="类型">
            <Select
              className="reimbursement-approval__type-select"
              placeholder="请选择"
              value={searchType}
              onChange={setSearchType}
              allowClear
            >
              {reimbursementTypes.map((type) => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
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

      <Card bordered={false} className="reimbursement-approval__table-card">
        <div className="reimbursement-approval__table-header">
          <span className="reimbursement-approval__table-title">报销审批</span>
          <Tag color="orange" className="reimbursement-approval__total-tag">
            共 {filteredData.length} 条待处理
          </Tag>
        </div>

        <Table
          loading={loading}
          columns={columns}
          data={filteredData}
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
        title="报销详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        className="reimbursement-approval__modal"
      >
        {currentDetail && (
          <Space direction="vertical" size={20} className="reimbursement-approval__detail-space">
            <Steps current={currentDetail.currentStep || 0}>
              <Steps.Step title="提交申请" />
              <Steps.Step title="部门审批" />
              <Steps.Step title="财务审核" />
              <Steps.Step title="完成支付" />
            </Steps>
            <Descriptions
              border
              column={2}
              data={[
                { label: '标题', value: currentDetail.title },
                { label: '类型', value: currentDetail.type },
                { label: '申请人', value: currentDetail.employee?.user?.realName || '-' },
                { label: '部门', value: currentDetail.employee?.user?.department?.name || '-' },
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

export default Approval
