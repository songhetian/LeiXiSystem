import { useState, useCallback } from 'react'
import {
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Drawer,
} from '@arco-design/web-react'
import {
  IconEye,
  IconStop,
  IconDelete,
} from '@arco-design/web-react/icon'
import {
  getMessageTaskList,
  getMessageTaskDetail,
  getMessageTaskRecipients,
  cancelMessageTask,
  deleteMessageTask,
} from '@/api/message'
import { PageHeader, TableHeader, FilterBar } from '@/components'
import styles from './records.module.css'
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待发送', color: 'gray' },
  sending: { label: '发送中', color: 'blue' },
  sent: { label: '已发送', color: 'green' },
  failed: { label: '发送失败', color: 'red' },
  cancelled: { label: '已取消', color: 'default' },
}

const TYPE_OPTIONS = [
  { value: 'system', label: '系统通知' },
  { value: 'approval', label: '审批通知' },
  { value: 'attendance', label: '考勤通知' },
  { value: 'schedule', label: '排班通知' },
  { value: 'payroll', label: '薪资通知' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: '待发送' },
  { value: 'sending', label: '发送中' },
  { value: 'sent', label: '已发送' },
  { value: 'failed', label: '发送失败' },
  { value: 'cancelled', label: '已取消' },
]

export default function MessageRecords() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState<string | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()

  const [detailVisible, setDetailVisible] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [recipientsVisible, setRecipientsVisible] = useState(false)
  const [recipientsData, setRecipientsData] = useState<any[]>([])
  const [recipientsTotal, setRecipientsTotal] = useState(0)
  const [recipientsPage, setRecipientsPage] = useState(1)
  const [recipientsLoading, setRecipientsLoading] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMessageTaskList({
        page,
        pageSize,
        keyword: keyword || undefined,
        type: filterType,
        status: filterStatus,
      })
      if (res.code === 0) {
        setData(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, keyword, filterType, filterStatus])

  const handleSearch = () => {
    setPage(1)
    setTimeout(fetchData, 0)
  }

  const handleReset = () => {
    setKeyword('')
    setFilterType(undefined)
    setFilterStatus(undefined)
    setPage(1)
    setTimeout(fetchData, 0)
  }

  const handleViewDetail = async (item: any) => {
    setDetailLoading(true)
    try {
      const res = await getMessageTaskDetail(item.id)
      if (res.code === 0) {
        setDetailData(res.data)
        setDetailVisible(true)
      }
    } finally {
      setDetailLoading(false)
    }
  }

  const handleViewRecipients = async (taskId: number) => {
    setCurrentTaskId(taskId)
    setRecipientsLoading(true)
    try {
      const res = await getMessageTaskRecipients(taskId, { page: recipientsPage, pageSize: 20 })
      if (res.code === 0) {
        setRecipientsData(res.data.list)
        setRecipientsTotal(res.data.total)
      }
    } finally {
      setRecipientsLoading(false)
    }
    setRecipientsVisible(true)
  }

  const handleCancel = (item: any) => {
    Modal.confirm({
      title: '取消任务',
      content: `确定要取消任务「${item.title}」吗？`,
      onOk: async () => {
        try {
          await cancelMessageTask(item.id)
          Message.success('取消成功')
          fetchData()
        } catch {
          // ignore
        }
      },
    })
  }

  const handleDelete = (item: any) => {
    Modal.confirm({
      title: '删除任务',
      content: `确定要删除任务「${item.title}」吗？此操作不可恢复。`,
      status: 'warning',
      onOk: async () => {
        try {
          await deleteMessageTask(item.id)
          Message.success('删除成功')
          fetchData()
        } catch {
          // ignore
        }
      },
    })
  }

  const columns = [
    {
      title: '消息标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (v: string, record: any) => (
        <a onClick={() => handleViewDetail(record)} style={{ cursor: 'pointer' }}>{v}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (v: string) => {
        const opt = TYPE_OPTIONS.find(o => o.value === v)
        return opt ? opt.label : v
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          normal: 'gray',
          high: 'orange',
          urgent: 'red',
        }
        const labelMap: Record<string, string> = {
          normal: '普通',
          high: '高',
          urgent: '紧急',
        }
        return <Tag color={colorMap[v] || 'gray'}>{labelMap[v] || v}</Tag>
      },
    },
    {
      title: '发送方式',
      dataIndex: 'sendMode',
      width: 100,
      render: (v: string) => {
        const map: Record<string, string> = {
          immediate: '立即发送',
          scheduled: '定时发送',
          recurring: '周期发送',
        }
        return map[v] || v
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const info = STATUS_MAP[v] || { label: v, color: 'gray' }
        return <Tag color={info.color}>{info.label}</Tag>
      },
    },
    {
      title: '接收人数',
      dataIndex: 'totalReceivers',
      width: 100,
      render: (v: number, record: any) => (
        <a onClick={() => handleViewRecipients(record.id)} style={{ cursor: 'pointer' }}>
          {v} 人
        </a>
      ),
    },
    {
      title: '已发送',
      dataIndex: 'sentCount',
      width: 80,
    },
    {
      title: '创建人',
      dataIndex: ['createdBy', 'realName'],
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 180,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="text" size="small" icon={<IconEye />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {(record.status === 'pending') && (
            <Button type="text" size="small" status="warning" icon={<IconStop />} onClick={() => handleCancel(record)}>
              取消
            </Button>
          )}
          <Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const recipientColumns = [
    {
      title: '姓名',
      dataIndex: ['user', 'realName'],
      width: 120,
    },
    {
      title: '用户名',
      dataIndex: ['user', 'username'],
      width: 120,
    },
    {
      title: '部门',
      dataIndex: ['user', 'department', 'name'],
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const map: Record<string, { label: string; color: string }> = {
          pending: { label: '待发送', color: 'gray' },
          sent: { label: '已发送', color: 'green' },
          failed: { label: '失败', color: 'red' },
        }
        const info = map[v] || { label: v, color: 'gray' }
        return <Tag color={info.color}>{info.label}</Tag>
      },
    },
    {
      title: '是否已读',
      dataIndex: 'isRead',
      width: 100,
      render: (v: boolean) => v ? <Tag color="green">已读</Tag> : <Tag color="gray">未读</Tag>,
    },
    {
      title: '发送时间',
      dataIndex: 'sentAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
  ]

  return (
    <div className={styles['message-records']}>
      <PageHeader title="发送记录" description="查看所有消息发送任务的状态和详情。" />

      <FilterBar
        keyword={keyword}
        onKeywordChange={setKeyword}
        onSearch={handleSearch}
        onReset={handleReset}
        filters={[
          {
            label: '类型',
            field: 'type',
            type: 'select',
            value: filterType,
            onChange: setFilterType,
            options: TYPE_OPTIONS,
          },
          {
            label: '状态',
            field: 'status',
            type: 'select',
            value: filterStatus,
            onChange: setFilterStatus,
            options: STATUS_OPTIONS,
          },
        ]}
      />

      <TableHeader title="任务列表" total={total} />

      <Table
        loading={loading}
        columns={columns as any}
        data={data}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
          showTotal: true,
        }}
        border={false}
      />

      <Drawer
        title="消息详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={520}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : detailData ? (
          <div>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 16,
            }}>
              {detailData.title}
            </div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={STATUS_MAP[detailData.status]?.color || 'gray'}>
                {STATUS_MAP[detailData.status]?.label || detailData.status}
              </Tag>
              {detailData.priority === 'urgent' && <Tag color="red">紧急</Tag>}
              {detailData.priority === 'high' && <Tag color="orange">高优先级</Tag>}
              {detailData.requiresConfirm && <Tag color="gold">需确认</Tag>}
            </Space>
            <div style={{
              padding: 16,
              background: 'var(--color-fill-2)',
              borderRadius: 4,
              marginBottom: 16,
              lineHeight: 1.8,
            }}
              dangerouslySetInnerHTML={{ __html: detailData.content }}
            />
            <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 2 }}>
              <div>消息类型：{TYPE_OPTIONS.find(o => o.value === detailData.type)?.label || detailData.type}</div>
              <div>发送方式：{detailData.sendMode === 'immediate' ? '立即发送' : detailData.sendMode === 'scheduled' ? '定时发送' : '周期发送'}</div>
              <div>接收范围：{detailData.targetType}</div>
              <div>总接收人数：{detailData.totalReceivers} 人</div>
              <div>已发送：{detailData.sentCount} 人</div>
              <div>创建人：{detailData.createdBy?.realName || '-'}</div>
              <div>创建时间：{new Date(detailData.createdAt).toLocaleString('zh-CN')}</div>
              {detailData.sentAt && <div>发送时间：{new Date(detailData.sentAt).toLocaleString('zh-CN')}</div>}
            </div>
            <div style={{ marginTop: 16 }}>
              <Button type="outline" long onClick={() => handleViewRecipients(detailData.id)}>
                查看接收人列表 ({detailData.totalReceivers} 人)
              </Button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal focusLock
        title="接收人列表"
        visible={recipientsVisible}
        onCancel={() => setRecipientsVisible(false)}
        footer={null}
        style={{ width: 800 }}
      >
        <Table
          loading={recipientsLoading}
          columns={recipientColumns as any}
          data={recipientsData}
          pagination={{
            current: recipientsPage,
            pageSize: 10,
            total: recipientsTotal,
            onChange: async (p) => {
              setRecipientsPage(p)
              if (currentTaskId) {
                const res = await getMessageTaskRecipients(currentTaskId, { page: p, pageSize: 10 })
                if (res.code === 0) {
                  setRecipientsData(res.data.list)
                }
              }
            },
            showTotal: true,
            size: 'small',
          }}
          size="small"
          border={false}
        />
      </Modal>
    </div>
  )
}
