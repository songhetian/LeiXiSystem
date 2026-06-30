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
  Tabs,
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
import { getPendingApproval } from '@/api/approval'
import type { PendingApproval } from '@/api/approval'
import { approveLeave, rejectLeave } from '@/api/attendance'
import { approveReimbursement, rejectReimbursement } from '@/api/reimbursement'
import './pending.css'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

const typeMap: Record<string, { text: string; color: string }> = {
  leave: { text: '请假', color: 'blue' },
  overtime: { text: '加班', color: 'orange' },
  reimbursement: { text: '报销', color: 'green' },
}

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
}

function Pending() {
  const [data, setData] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<PendingApproval | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState('all')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [opinionForm] = Form.useForm()

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getPendingApproval({
        page,
        pageSize,
        type: activeTab !== 'all' ? activeTab : undefined,
      })
      let list = res.data.list
      if (searchText) {
        list = list.filter(
          (item: PendingApproval) =>
            item.title.includes(searchText) ||
            item.applicant.includes(searchText),
        )
      }
      if (searchType) {
        list = list.filter((item: PendingApproval) => item.type === searchType)
      }
      setData(list)
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

  const columns: TableProps<PendingApproval>['columns'] = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 200,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      render: (value: string) => {
        const info = typeMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      width: 100,
    },
    {
      title: '金额/天数',
      dataIndex: 'amount',
      width: 100,
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
      width: 160,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '操作',
      width: 180,
      render: (_: unknown, record: PendingApproval) => (
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
            onClick={() => handleApprove(record)}
          >
            通过
          </Button>
          <Button
            type="text"
            size="small"
            status="danger"
            icon={<IconClose />}
            onClick={() => handleReject(record)}
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ]

  const handleView = (record: PendingApproval) => {
    setCurrentRecord(record)
    setDetailVisible(true)
  }

  const handleApprove = (record: PendingApproval) => {
    Modal.confirm({
      title: '通过确认',
      content: `确定要通过该${typeMap[record.type]?.text || ''}申请吗？`,
      okText: '确认通过',
      cancelText: '取消',
      onOk: async () => {
        try {
          if (record.type === 'leave') {
            await approveLeave(record.id)
          } else if (record.type === 'reimbursement') {
            await approveReimbursement(record.id)
          }
          Message.success('审批通过')
          fetchData(pagination.current, pagination.pageSize)
        } catch {
          // error handled by interceptor
        }
      },
    })
  }

  const handleReject = (record: PendingApproval) => {
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
          if (record.type === 'leave') {
            await rejectLeave(record.id, { opinion: values.opinion })
          } else if (record.type === 'reimbursement') {
            await rejectReimbursement(record.id, { opinion: values.opinion })
          }
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
    <div className="approval-pending">
      <Card bordered={false} className="approval-pending__tabs-card">
        <Tabs activeTab={activeTab} onChange={handleTabChange}>
          <TabPane key="all" title={`全部 (${pagination.total})`} />
          <TabPane key="leave" title="请假" />
          <TabPane key="overtime" title="加班" />
          <TabPane key="reimbursement" title="报销" />
        </Tabs>
      </Card>

      <Card bordered={false} className="approval-pending__search-card">
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              className="approval-pending__search-input"
              placeholder="标题/申请人"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="类型">
            <Select
              className="approval-pending__type-select"
              placeholder="请选择"
              value={searchType}
              onChange={setSearchType}
              allowClear
            >
              <Option value="leave">请假</Option>
              <Option value="overtime">加班</Option>
              <Option value="reimbursement">报销</Option>
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

      <Card bordered={false} className="approval-pending__table-card">
        <div className="approval-pending__table-header">
          <span className="approval-pending__table-title">待审批列表</span>
          <Tag color="orange" className="approval-pending__total-tag">
            共 {data.length} 条待处理
          </Tag>
        </div>

        <Table
          loading={loading}
          columns={columns}
          data={data}
          rowKey={(record) => `${record.type}-${record.id}`}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
        />
      </Card>

      <Modal
        title="审批详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        className="approval-pending__modal"
      >
        {currentRecord && (
          <Descriptions
            border
            column={2}
            data={[
              { label: '标题', value: currentRecord.title },
              { label: '类型', value: typeMap[currentRecord.type]?.text || currentRecord.type },
              { label: '申请人', value: currentRecord.applicant },
              { label: '金额/天数', value: currentRecord.amount },
              { label: '状态', value: statusMap[currentRecord.status]?.text || currentRecord.status },
              { label: '申请时间', value: new Date(currentRecord.createdAt).toLocaleString() },
            ]}
          />
        )}
      </Modal>
    </div>
  )
}

export default Pending
