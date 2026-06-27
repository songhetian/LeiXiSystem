import { useState } from 'react'
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
  Steps,
  Descriptions,
  Tabs,
} from '@arco-design/web-react'
import {
  IconSearch,
  IconRefresh,
  IconCheck,
  IconClose,
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

interface ApprovalItem {
  id: number
  title: string
  type: 'leave' | 'overtime' | 'reimbursement' | 'shift'
  applicant: string
  department: string
  amount?: number
  days?: number
  status: 'pending' | 'approved' | 'rejected'
  createTime: string
  currentStep: number
}

const typeMap: Record<string, { text: string; color: string }> = {
  leave: { text: '请假', color: 'blue' },
  overtime: { text: '加班', color: 'orange' },
  reimbursement: { text: '报销', color: 'green' },
  shift: { text: '调班', color: 'purple' },
}

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
}

const mockData: ApprovalItem[] = [
  { id: 1, title: '年假申请', type: 'leave', applicant: '张三', department: '技术部', days: 3, status: 'pending', createTime: '2024-06-20 10:30', currentStep: 1 },
  { id: 2, title: '加班申请', type: 'overtime', applicant: '李四', department: '产品部', status: 'pending', createTime: '2024-06-20 14:00', currentStep: 1 },
  { id: 3, title: '差旅费报销', type: 'reimbursement', applicant: '王五', department: '市场部', amount: 2500, status: 'pending', createTime: '2024-06-20 16:00', currentStep: 2 },
  { id: 4, title: '调班申请', type: 'shift', applicant: '赵六', department: '技术部', status: 'pending', createTime: '2024-06-21 09:00', currentStep: 1 },
  { id: 5, title: '病假申请', type: 'leave', applicant: '钱七', department: '人事部', days: 1, status: 'pending', createTime: '2024-06-21 10:00', currentStep: 1 },
]

function Pending() {
  const [data, setData] = useState<ApprovalItem[]>(mockData)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<ApprovalItem | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<ApprovalItem[]>(mockData)
  const [activeTab, setActiveTab] = useState('all')

  const columns: TableProps<ApprovalItem>['columns'] = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 180,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (value: string) => {
        const info = typeMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 100,
    },
    {
      title: '金额/天数',
      width: 100,
      render: (_: any, record: ApprovalItem) => (
        <span>
          {record.amount ? `¥${record.amount}` : record.days ? `${record.days}天` : '-'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => {
        const info = statusMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createTime',
      width: 150,
    },
    {
      title: '操作',
      width: 180,
      render: (_: any, record: ApprovalItem) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconEye />}
            onClick={() => handleView(record)}
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

  const handleView = (record: ApprovalItem) => {
    setCurrentRecord(record)
    setDetailVisible(true)
  }

  const handleApprove = (id: number) => {
    setData(data.map((item) => (item.id === id ? { ...item, status: 'approved' } : item)))
    setFilteredData(filteredData.map((item) => (item.id === id ? { ...item, status: 'approved' } : item)))
    Message.success('审批通过')
  }

  const handleReject = (id: number) => {
    Modal.confirm({
      title: '驳回确认',
      content: '请输入驳回原因：',
      okText: '确认驳回',
      cancelText: '取消',
      onOk: () => {
        setData(data.map((item) => (item.id === id ? { ...item, status: 'rejected' } : item)))
        setFilteredData(filteredData.map((item) => (item.id === id ? { ...item, status: 'rejected' } : item)))
        Message.success('已驳回')
      },
    })
  }

  const handleSearch = () => {
    let result = data
    if (activeTab !== 'all') {
      result = result.filter((item) => item.type === activeTab)
    }
    if (searchText) {
      result = result.filter(
        (item) =>
          item.title.includes(searchText) ||
          item.applicant.includes(searchText),
      )
    }
    if (searchType) {
      result = result.filter((item) => item.type === searchType)
    }
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchType(undefined)
    setFilteredData(data.filter((item) => activeTab === 'all' || item.type === activeTab))
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (key === 'all') {
      setFilteredData(data.filter((item) => item.status === 'pending'))
    } else {
      setFilteredData(data.filter((item) => item.type === key && item.status === 'pending'))
    }
  }

  const pendingCount = data.filter((d) => d.status === 'pending').length

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Tabs activeTab={activeTab} onChange={handleTabChange}>
          <TabPane key="all" title={`全部 (${pendingCount})`} />
          <TabPane key="leave" title={`请假 (${data.filter(d => d.type === 'leave' && d.status === 'pending').length})`} />
          <TabPane key="overtime" title={`加班 (${data.filter(d => d.type === 'overtime' && d.status === 'pending').length})`} />
          <TabPane key="reimbursement" title={`报销 (${data.filter(d => d.type === 'reimbursement' && d.status === 'pending').length})`} />
          <TabPane key="shift" title={`调班 (${data.filter(d => d.type === 'shift' && d.status === 'pending').length})`} />
        </Tabs>
      </Card>

      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              style={{ width: 180 }}
              placeholder="标题/申请人"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="类型">
            <Select
              style={{ width: 120 }}
              placeholder="请选择"
              value={searchType}
              onChange={setSearchType}
              allowClear
            >
              <Option value="leave">请假</Option>
              <Option value="overtime">加班</Option>
              <Option value="reimbursement">报销</Option>
              <Option value="shift">调班</Option>
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

      <Card bordered={false}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>待审批列表</span>
          <Tag color="orange" style={{ marginLeft: 8 }}>
            共 {filteredData.filter(d => d.status === 'pending').length} 条待处理
          </Tag>
        </div>

        <Table columns={columns} data={filteredData.filter(d => d.status === 'pending')} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title="审批详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        style={{ width: 600 }}
      >
        {currentRecord && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Steps current={currentRecord.currentStep}>
              <Steps.Step title="提交申请" description={currentRecord.createTime} />
              <Steps.Step title="部门审批" description="审批中" />
              <Steps.Step title="人事备案" />
              <Steps.Step title="完成" />
            </Steps>
            <Descriptions
              border
              column={2}
              data={[
                { label: '标题', value: currentRecord.title },
                { label: '类型', value: typeMap[currentRecord.type].text },
                { label: '申请人', value: currentRecord.applicant },
                { label: '部门', value: currentRecord.department },
                { label: '申请时间', value: currentRecord.createTime },
                {
                  label: '金额/天数',
                  value: currentRecord.amount ? `¥${currentRecord.amount}` : currentRecord.days ? `${currentRecord.days}天` : '-',
                },
              ]}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default Pending
