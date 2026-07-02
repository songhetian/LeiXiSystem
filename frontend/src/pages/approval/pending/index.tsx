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
  DatePicker,
} from '@arco-design/web-react'
import {
  IconCheck,
  IconClose,
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import type { Dayjs } from 'dayjs'
import { getPendingApproval } from '@/api/approval'
import type { PendingApproval } from '@/api/approval'
import { approveLeave, rejectLeave, batchApproveLeave, batchRejectLeave, approveOvertime, rejectOvertime, batchApproveOvertime, batchRejectOvertime } from '@/api/attendance'
import { approveReimbursement, rejectReimbursement, batchApproveReimbursement, batchRejectReimbursement } from '@/api/reimbursement'
import { FilterBar, TableHeader, BatchActions } from '@/components'
import { useBatchSelection } from '@/hooks/useBatchSelection'
import { toast } from '@/utils/toast'
import styles from './pending.module.css'
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane
const { RangePicker } = DatePicker

const priorityOptions = [
  { value: 'urgent', label: '紧急' },
  { value: 'normal', label: '普通' },
]

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
  const [searchApplicant, setSearchApplicant] = useState('')
  const [searchDateRange, setSearchDateRange] = useState<Dayjs[]>([])
  const [searchPriority, setSearchPriority] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState('all')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [opinionForm] = Form.useForm()
  const [batchRejectVisible, setBatchRejectVisible] = useState(false)
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  const batch = useBatchSelection<PendingApproval>({
    keyField: 'id',
  })

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
      if (searchApplicant) {
        list = list.filter((item: PendingApproval) =>
          item.applicant.includes(searchApplicant),
        )
      }
      if (searchDateRange.length === 2) {
        const start = searchDateRange[0].startOf('day').valueOf()
        const end = searchDateRange[1].endOf('day').valueOf()
        list = list.filter((item: PendingApproval) => {
          const t = new Date(item.createdAt).getTime()
          return t >= start && t <= end
        })
      }
      if (searchPriority) {
        list = list.filter((item: PendingApproval) =>
          (item as any).priority === searchPriority,
        )
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
          } else if (record.type === 'overtime') {
            await approveOvertime(record.id)
          } else if (record.type === 'reimbursement') {
            await approveReimbursement(record.id)
          }
          toast.success('审批通过')
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
          } else if (record.type === 'overtime') {
            await rejectOvertime(record.id, { opinion: values.opinion })
          } else if (record.type === 'reimbursement') {
            await rejectReimbursement(record.id, { opinion: values.opinion })
          }
          toast.success('已驳回')
          fetchData(pagination.current, pagination.pageSize)
        } catch {
          // error handled by interceptor
          return false
        }
      },
    })
  }

  const handleBatchApprove = () => {
    Modal.confirm({
      title: '批量通过确认',
      content: `确定要通过选中的 ${batch.selectedCount} 条申请吗？`,
      okText: '确认通过',
      cancelText: '取消',
      onOk: async () => {
        try {
          setBatchSubmitting(true)
          const leaveIds = batch.selectedRows.filter(r => r.type === 'leave').map(r => r.id)
          const overtimeIds = batch.selectedRows.filter(r => r.type === 'overtime').map(r => r.id)
          const reimbursementIds = batch.selectedRows.filter(r => r.type === 'reimbursement').map(r => r.id)

          const promises = []
          if (leaveIds.length > 0) {
            promises.push(batchApproveLeave(leaveIds))
          }
          if (overtimeIds.length > 0) {
            promises.push(batchApproveOvertime(overtimeIds))
          }
          if (reimbursementIds.length > 0) {
            promises.push(batchApproveReimbursement(reimbursementIds))
          }

          await Promise.all(promises)
          toast.success(`成功通过 ${batch.selectedCount} 条申请`)
          batch.clearSelection()
          fetchData(pagination.current, pagination.pageSize)
        } catch {
          // error handled by interceptor
        } finally {
          setBatchSubmitting(false)
        }
      },
    })
  }

  const handleBatchReject = () => {
    opinionForm.resetFields()
    setBatchRejectVisible(true)
  }

  const handleBatchRejectOk = async () => {
    try {
      const values = await opinionForm.validate()
      setBatchSubmitting(true)

      const leaveIds = batch.selectedRows.filter(r => r.type === 'leave').map(r => r.id)
      const overtimeIds = batch.selectedRows.filter(r => r.type === 'overtime').map(r => r.id)
      const reimbursementIds = batch.selectedRows.filter(r => r.type === 'reimbursement').map(r => r.id)

      const promises = []
      if (leaveIds.length > 0) {
        promises.push(batchRejectLeave(leaveIds, values.opinion))
      }
      if (overtimeIds.length > 0) {
        promises.push(batchRejectOvertime(overtimeIds, values.opinion))
      }
      if (reimbursementIds.length > 0) {
        promises.push(batchRejectReimbursement(reimbursementIds, values.opinion))
      }

      await Promise.all(promises)
      toast.success(`成功驳回 ${batch.selectedCount} 条申请`)
      setBatchRejectVisible(false)
      batch.clearSelection()
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
      return false
    } finally {
      setBatchSubmitting(false)
    }
  }

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchType(undefined)
    setSearchApplicant('')
    setSearchDateRange([])
    setSearchPriority(undefined)
    fetchData(1, pagination.pageSize)
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    batch.clearSelection()
  }

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize)
  }

  const batchActions = (
    <>
      <Button
        type="primary"
        status="success"
        icon={<IconCheck />}
        onClick={handleBatchApprove}
        loading={batchSubmitting}
      >
        批量通过
      </Button>
      <Button
        status="danger"
        icon={<IconClose />}
        onClick={handleBatchReject}
        loading={batchSubmitting}
      >
        批量驳回
      </Button>
    </>
  )

  return (
    <div className={styles['approval-pending']}>
      <Card bordered={false} className={styles['approval-pending__tabs-card']}>
        <Tabs activeTab={activeTab} onChange={handleTabChange}>
          <TabPane key="all" title={`全部 (${pagination.total})`} />
          <TabPane key="leave" title="请假" />
          <TabPane key="overtime" title="加班" />
          <TabPane key="reimbursement" title="报销" />
        </Tabs>
      </Card>

      <Card bordered={false} className={styles['approval-pending__search-card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input
                  className={styles['approval-pending__search-input']}
                  placeholder="标题/申请人"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="类型">
                <Select
                  className={styles['approval-pending__type-select']}
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
              <FormItem label="申请人">
                <Input
                  placeholder="请输入申请人姓名"
                  value={searchApplicant}
                  onChange={setSearchApplicant}
                  allowClear
                />
              </FormItem>
              <FormItem label="申请时间">
                <RangePicker
                  value={searchDateRange}
                  onChange={(_, date) => setSearchDateRange(date)}
                />
              </FormItem>
              <FormItem label="优先级">
                <Select
                  placeholder="请选择优先级"
                  value={searchPriority}
                  onChange={setSearchPriority}
                  allowClear
                >
                  {priorityOptions.map((opt) => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
                </Select>
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
          searchText="搜索"
        />
      </Card>

      <Card bordered={false} className={styles['approval-pending__table-card']}>
        <TableHeader
          title="待审批列表"
          total={data.length}
          totalTagColor="orange"
          totalTagText={`共 ${data.length} 条待处理`}
        />

        <BatchActions
          selectedCount={batch.selectedCount}
          onClear={batch.clearSelection}
          actions={batchActions}
        />

        <Table
          loading={loading}
          columns={columns}
          data={data}
          rowKey={(record) => `${record.type}-${record.id}`}
          rowSelection={batch.getRowSelection(data)}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
        />
      </Card>

      <Modal focusLock
        title="审批详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        className={styles['approval-pending__modal']}
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

      <Modal focusLock
        title="批量驳回"
        visible={batchRejectVisible}
        onOk={handleBatchRejectOk}
        onCancel={() => setBatchRejectVisible(false)}
        confirmLoading={batchSubmitting}
        okText="确认驳回"
        cancelText="取消"
      >
        <Form form={opinionForm} layout="vertical">
          <FormItem
            label="驳回原因"
            field="opinion"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <Input.TextArea
              placeholder={`请输入驳回原因（将应用于选中的 ${batch.selectedCount} 条申请）`}
              rows={4}
            />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default Pending
