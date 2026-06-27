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

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

interface Reimbursement {
  id: number
  title: string
  type: string
  applicant: string
  department: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  createTime: string
  currentStep: number
}

const typeMap: Record<string, string> = {
  travel: '差旅费',
  meal: '餐费',
  transport: '交通费',
  office: '办公用品',
  entertainment: '招待费',
  other: '其他',
}

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
}

const mockData: Reimbursement[] = [
  { id: 1, title: '差旅费报销', type: 'travel', applicant: '张三', department: '技术部', amount: 2500, status: 'pending', createTime: '2024-06-20 10:30', currentStep: 1 },
  { id: 2, title: '办公用品采购', type: 'office', applicant: '李四', department: '产品部', amount: 800, status: 'pending', createTime: '2024-06-20 14:00', currentStep: 1 },
  { id: 3, title: '客户招待费', type: 'entertainment', applicant: '王五', department: '市场部', amount: 1200, status: 'pending', createTime: '2024-06-20 16:00', currentStep: 2 },
  { id: 4, title: '交通费报销', type: 'transport', applicant: '赵六', department: '技术部', amount: 350, status: 'pending', createTime: '2024-06-21 09:00', currentStep: 1 },
  { id: 5, title: '团建餐费', type: 'meal', applicant: '钱七', department: '人事部', amount: 600, status: 'pending', createTime: '2024-06-21 10:00', currentStep: 1 },
]

function Approval() {
  const [data, setData] = useState<Reimbursement[]>(mockData)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<Reimbursement | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<Reimbursement[]>(mockData)
  const [activeTab, setActiveTab] = useState('all')

  const columns: TableProps<Reimbursement>['columns'] = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 180,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => <Tag color="blue">{typeMap[value] || value}</Tag>,
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
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      render: (value: number) => (
        <span style={{ fontWeight: 600, color: '#F53F3F' }}>¥{value}</span>
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
      render: (_: any, record: Reimbursement) => (
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

  const handleView = (record: Reimbursement) => {
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
      result = result.filter((item) => item.status === activeTab)
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
    setFilteredData(data.filter((item) => activeTab === 'all' || item.status === activeTab))
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (key === 'all') {
      setFilteredData(data.filter((d) => d.status === 'pending'))
    } else {
      setFilteredData(data.filter((d) => d.type === key && d.status === 'pending'))
    }
  }

  const pendingCount = data.filter((d) => d.status === 'pending').length

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Tabs activeTab={activeTab} onChange={handleTabChange}>
          <TabPane key="all" title={`全部待审批 (${pendingCount})`} />
          <TabPane key="travel" title={`差旅费 (${data.filter(d => d.type === 'travel' && d.status === 'pending').length})`} />
          <TabPane key="meal" title={`餐费 (${data.filter(d => d.type === 'meal' && d.status === 'pending').length})`} />
          <TabPane key="transport" title={`交通费 (${data.filter(d => d.type === 'transport' && d.status === 'pending').length})`} />
          <TabPane key="office" title={`办公用品 (${data.filter(d => d.type === 'office' && d.status === 'pending').length})`} />
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
              <Option value="travel">差旅费</Option>
              <Option value="meal">餐费</Option>
              <Option value="transport">交通费</Option>
              <Option value="office">办公用品</Option>
              <Option value="entertainment">招待费</Option>
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
          <span style={{ fontSize: 16, fontWeight: 600 }}>报销审批</span>
          <Tag color="orange" style={{ marginLeft: 8 }}>
            共 {filteredData.filter(d => d.status === 'pending').length} 条待处理
          </Tag>
        </div>

        <Table columns={columns} data={filteredData.filter(d => d.status === 'pending')} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title="报销详情"
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
              <Steps.Step title="财务审核" />
              <Steps.Step title="完成支付" />
            </Steps>
            <Descriptions
              border
              column={2}
              data={[
                { label: '标题', value: currentRecord.title },
                { label: '类型', value: typeMap[currentRecord.type] },
                { label: '申请人', value: currentRecord.applicant },
                { label: '部门', value: currentRecord.department },
                { label: '金额', value: `¥${currentRecord.amount}` },
                { label: '状态', value: statusMap[currentRecord.status].text },
              ]}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default Approval
