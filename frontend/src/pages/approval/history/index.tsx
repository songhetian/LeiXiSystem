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
  Card,
  Tabs,
  Descriptions,
} from '@arco-design/web-react'
import {
  IconSearch,
  IconRefresh,
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getApprovalHistory } from '@/api/approval'
import './history.css'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

const typeMap: Record<string, { text: string; color: string }> = {
  leave: { text: '请假', color: 'blue' },
  overtime: { text: '加班', color: 'orange' },
  reimbursement: { text: '报销', color: 'green' },
}

const statusMap: Record<string, { text: string; color: string }> = {
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  cancelled: { text: '已撤销', color: 'gray' },
  paid: { text: '已支付', color: 'cyan' },
}

interface HistoryItem {
  id: number
  type: string
  title: string
  applicant: string
  status: string
  createdAt: string
  [key: string]: any
}

function History() {
  const [data, setData] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<HistoryItem | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState('all')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getApprovalHistory({ page, pageSize })
      let list = res.data.list as HistoryItem[]
      if (activeTab !== 'all') {
        list = list.filter((item) => item.status === activeTab)
      }
      if (searchText) {
        list = list.filter(
          (item) =>
            item.title?.includes(searchText) ||
            item.applicant?.includes(searchText),
        )
      }
      if (searchStatus) {
        list = list.filter((item) => item.status === searchStatus)
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

  const columns: TableProps<HistoryItem>['columns'] = [
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
      render: (value: string) => value ? new Date(value).toLocaleString() : '-',
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, record: HistoryItem) => (
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

  const handleView = (record: HistoryItem) => {
    setCurrentRecord(record)
    setDetailVisible(true)
  }

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchStatus(undefined)
    fetchData(1, pagination.pageSize)
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
  }

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize)
  }

  return (
    <div className="approval-history">
      <Card bordered={false} className="approval-history__tabs-card">
        <Tabs activeTab={activeTab} onChange={handleTabChange}>
          <TabPane key="all" title={`全部 (${pagination.total})`} />
          <TabPane key="approved" title="已通过" />
          <TabPane key="rejected" title="已驳回" />
        </Tabs>
      </Card>

      <Card bordered={false} className="approval-history__search-card">
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              className="approval-history__search-input"
              placeholder="标题/申请人"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              className="approval-history__status-select"
              placeholder="请选择"
              value={searchStatus}
              onChange={setSearchStatus}
              allowClear
            >
              <Option value="approved">已通过</Option>
              <Option value="rejected">已驳回</Option>
              <Option value="cancelled">已撤销</Option>
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

      <Card bordered={false} className="approval-history__table-card">
        <div className="approval-history__table-header">
          <span className="approval-history__table-title">审批历史</span>
          <Tag color="blue" className="approval-history__total-tag">
            共 {data.length} 条
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
        className="approval-history__modal"
      >
        {currentRecord && (
          <Descriptions
            border
            column={2}
            data={[
              { label: '标题', value: currentRecord.title || '-' },
              { label: '类型', value: typeMap[currentRecord.type]?.text || currentRecord.type || '-' },
              { label: '申请人', value: currentRecord.applicant || '-' },
              { label: '状态', value: statusMap[currentRecord.status]?.text || currentRecord.status || '-' },
              { label: '申请时间', value: currentRecord.createdAt ? new Date(currentRecord.createdAt).toLocaleString() : '-', span: 2 },
            ]}
          />
        )}
      </Modal>
    </div>
  )
}

export default History
