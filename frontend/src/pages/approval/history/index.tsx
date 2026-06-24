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
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

interface ApprovalHistory {
  id: number
  title: string
  type: 'leave' | 'overtime' | 'reimbursement' | 'shift'
  applicant: string
  department: string
  amount?: number
  days?: number
  status: 'approved' | 'rejected'
  createTime: string
  approver: string
  approveTime: string
}

const typeMap: Record<string, { text: string; color: string }> = {
  leave: { text: '请假', color: 'blue' },
  overtime: { text: '加班', color: 'orange' },
  reimbursement: { text: '报销', color: 'green' },
  shift: { text: '调班', color: 'purple' },
}

const statusMap: Record<string, { text: string; color: string }> = {
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
}

const mockData: ApprovalHistory[] = [
  { id: 1, title: '年假申请', type: 'leave', applicant: '张三', department: '技术部', days: 3, status: 'approved', createTime: '2024-06-15 10:30', approver: '李经理', approveTime: '2024-06-16 09:00' },
  { id: 2, title: '加班申请', type: 'overtime', applicant: '李四', department: '产品部', status: 'approved', createTime: '2024-06-18 14:00', approver: '王总监', approveTime: '2024-06-18 16:00' },
  { id: 3, title: '差旅费报销', type: 'reimbursement', applicant: '王五', department: '市场部', amount: 2500, status: 'approved', createTime: '2024-06-10 16:00', approver: '张经理', approveTime: '2024-06-11 10:00' },
  { id: 4, title: '调班申请', type: 'shift', applicant: '赵六', department: '技术部', status: 'rejected', createTime: '2024-06-12 09:00', approver: '李经理', approveTime: '2024-06-12 14:00' },
  { id: 5, title: '病假申请', type: 'leave', applicant: '钱七', department: '人事部', days: 1, status: 'approved', createTime: '2024-06-19 10:00', approver: '孙主管', approveTime: '2024-06-19 11:00' },
]

function History() {
  const [data] = useState<ApprovalHistory[]>(mockData)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<ApprovalHistory | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<ApprovalHistory[]>(mockData)
  const [activeTab, setActiveTab] = useState('all')

  const columns: TableProps<ApprovalHistory>['columns'] = [
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
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => {
        const info = statusMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '审批人',
      dataIndex: 'approver',
      width: 100,
    },
    {
      title: '申请时间',
      dataIndex: 'createTime',
      width: 150,
    },
    {
      title: '审批时间',
      dataIndex: 'approveTime',
      width: 150,
    },
    {
      title: '操作',
      width: 80,
      render: (_: any, record: ApprovalHistory) => (
        <Button
          type="text"
          size="small"
          icon={<IconEye />}
          onClick={() => handleView(record)}
        >
          详情
        </Button>
      ),
    },
  ]

  const handleView = (record: ApprovalHistory) => {
    setCurrentRecord(record)
    setDetailVisible(true)
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
    if (searchStatus) {
      result = result.filter((item) => item.status === searchStatus)
    }
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchStatus(undefined)
    setFilteredData(data.filter((item) => activeTab === 'all' || item.status === activeTab))
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (key === 'all') {
      setFilteredData(data)
    } else {
      setFilteredData(data.filter((item) => item.status === key))
    }
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Tabs activeTab={activeTab} onChange={handleTabChange}>
          <TabPane key="all" title={`全部 (${data.length})`} />
          <TabPane key="approved" title={`已通过 (${data.filter(d => d.status === 'approved').length})`} />
          <TabPane key="rejected" title={`已驳回 (${data.filter(d => d.status === 'rejected').length})`} />
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
          <FormItem label="状态">
            <Select
              style={{ width: 120 }}
              placeholder="请选择"
              value={searchStatus}
              onChange={setSearchStatus}
              allowClear
            >
              <Option value="approved">已通过</Option>
              <Option value="rejected">已驳回</Option>
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
          <span style={{ fontSize: 16, fontWeight: 600 }}>审批历史</span>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            共 {filteredData.length} 条
          </Tag>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title="审批详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {currentRecord && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Steps current={4}>
              <Steps.Step title="提交申请" description={currentRecord.createTime} />
              <Steps.Step title="部门审批" description={currentRecord.approveTime} />
              <Steps.Step title="人事备案" description="已完成" />
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
                { label: '状态', value: statusMap[currentRecord.status].text },
                { label: '审批人', value: currentRecord.approver },
              ]}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default History
