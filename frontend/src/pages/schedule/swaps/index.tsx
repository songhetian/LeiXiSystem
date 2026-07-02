import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Tabs,
  Popconfirm,
  Typography,
} from '@arco-design/web-react'
import { toast } from '@/utils/toast'
import {
  IconCheck,
  IconClose,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import dayjs from 'dayjs'
import {
  getShiftSwaps,
  approveShiftSwap,
  rejectShiftSwap,
  cancelShiftSwap,
  type ShiftSwapRequest,
} from '@/api/schedule'
import styles from './style.module.css'
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

function SwapsPage() {
  const [data, setData] = useState<ShiftSwapRequest[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [activeTab, setActiveTab] = useState('my')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ShiftSwapRequest | null>(null)
  const [rejectRemark, setRejectRemark] = useState('')
  const [rejectVisible, setRejectVisible] = useState(false)

  const loadData = useCallback(async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true)
    try {
      const res = await getShiftSwaps({
        page: nextPage,
        pageSize: nextPageSize,
        type: activeTab,
        status: statusFilter,
      })
      setData(res.data?.list || [])
      setTotal(res.data?.total || 0)
      setPage(nextPage)
      setPageSize(nextPageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, activeTab, statusFilter])

  useEffect(() => {
    loadData(1, pageSize)
  }, [activeTab, statusFilter])

  const handleView = (record: ShiftSwapRequest) => {
    setSelectedItem(record)
    setDetailVisible(true)
  }

  const handleApprove = async (id: number) => {
    try {
      await approveShiftSwap(id)
      toast.success('已批准换班申请')
      setDetailVisible(false)
      loadData(page, pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handleReject = async () => {
    if (!selectedItem) return
    try {
      await rejectShiftSwap(selectedItem.id, rejectRemark)
      toast.success('已拒绝换班申请')
      setRejectVisible(false)
      setRejectRemark('')
      setDetailVisible(false)
      loadData(page, pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handleCancel = async (id: number) => {
    try {
      await cancelShiftSwap(id)
      toast.success('已取消换班申请')
      loadData(page, pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      pending: { color: 'orange', text: '待审批' },
      approved: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已拒绝' },
      cancelled: { color: 'gray', text: '已取消' },
    }
    const { color, text } = map[status] || { color: 'gray', text: status }
    return <Tag color={color}>{text}</Tag>
  }

  const columns: TableProps<ShiftSwapRequest>['columns'] = [
    {
      title: '单号',
      dataIndex: 'requestNo',
      width: 160,
    },
    {
      title: '申请人',
      dataIndex: 'requester',
      width: 100,
      render: (val: any) => (
        <Space direction="vertical" size={4}>
          <span>{val?.realName}</span>
          <span className={styles['schedule-swaps__cell-secondary']}>{val?.department?.name}</span>
        </Space>
      ),
    },
    {
      title: '被申请人',
      dataIndex: 'target',
      width: 100,
      render: (val: any) => (
        <Space direction="vertical" size={4}>
          <span>{val?.realName}</span>
          <span className={styles['schedule-swaps__cell-secondary']}>{val?.department?.name}</span>
        </Space>
      ),
    },
    {
      title: '申请人班次',
      dataIndex: 'requesterSchedule',
      width: 120,
      render: (val: any) => (
        <Tag color={val?.shift?.color || 'arcoblue'}>{val?.shift?.name}</Tag>
      ),
    },
    {
      title: '被申请人班次',
      dataIndex: 'targetSchedule',
      width: 120,
      render: (val: any) => (
        <Tag color={val?.shift?.color || 'arcoblue'}>{val?.shift?.name}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val) => getStatusTag(val),
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="text" size="small" onClick={() => handleView(record)}>
            详情
          </Button>
          {record.status === 'pending' && record.requesterId !== record.requesterId && (
            <Popconfirm
              title="确定要取消此申请吗？"
              onOk={() => handleCancel(record.id)}
            >
              <Button type="text" size="small" status="danger">
                取消
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className={styles['schedule-swaps']}>
      <Card bordered={false} className={styles['schedule-swaps__toolbar']}>
        <Space>
          <Tabs activeTab={activeTab} onChange={setActiveTab} size="small">
            <TabPane key="my" title="我的申请" />
            <TabPane key="target" title="收到的申请" />
          </Tabs>
          <Select
            className={styles['schedule-swaps__select-status']}
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
          >
            <Option value="pending">待审批</Option>
            <Option value="approved">已通过</Option>
            <Option value="rejected">已拒绝</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: true,
            sizeCanChange: true,
            onChange: (p, ps) => loadData(p, ps),
          }}
        />
      </Card>

      <Modal focusLock
        title="换班申请详情"
        visible={detailVisible}
        onOk={() => setDetailVisible(false)}
        onCancel={() => setDetailVisible(false)}
        footer={
          selectedItem?.status === 'pending' && (
            <Space>
              <Button type="primary" icon={<IconCheck />} onClick={() => handleApprove(selectedItem.id)}>
                批准
              </Button>
              <Button icon={<IconClose />} status="danger" onClick={() => setRejectVisible(true)}>
                拒绝
              </Button>
            </Space>
          )
        }
      >
        {selectedItem && (
          <Space direction="vertical" className={styles['schedule-swaps__modal-space']} size="large">
            <div>
              <Typography.Text type="secondary">单号：</Typography.Text>
              <span className={styles['schedule-swaps__modal-text']}>{selectedItem.requestNo}</span>
            </div>
            <div>
              <Typography.Text type="secondary">状态：</Typography.Text>
              {getStatusTag(selectedItem.status)}
            </div>

            <div className={styles['schedule-swaps__modal-cards']}>
              <Card size="small" title="申请人">
                <Space direction="vertical">
                  <span>{selectedItem.requester?.realName}</span>
                  <Typography.Text type="secondary">{selectedItem.requester?.department?.name}</Typography.Text>
                </Space>
              </Card>
              <Card size="small" title="被申请人">
                <Space direction="vertical">
                  <span>{selectedItem.target?.realName}</span>
                  <Typography.Text type="secondary">{selectedItem.target?.department?.name}</Typography.Text>
                </Space>
              </Card>
            </div>

            <div className={styles['schedule-swaps__modal-cards']}>
              <Card size="small" title="申请人原班次">
                <Tag color={selectedItem.requesterSchedule?.shift?.color || 'arcoblue'}>
                  {selectedItem.requesterSchedule?.shift?.name}
                </Tag>
              </Card>
              <Card size="small" title="被申请人原班次">
                <Tag color={selectedItem.targetSchedule?.shift?.color || 'arcoblue'}>
                  {selectedItem.targetSchedule?.shift?.name}
                </Tag>
              </Card>
            </div>

            {selectedItem.reason && (
              <div>
                <Typography.Text type="secondary">换班原因：</Typography.Text>
                <span>{selectedItem.reason}</span>
              </div>
            )}

            {selectedItem.approveRemark && (
              <div>
                <Typography.Text type="secondary">审批备注：</Typography.Text>
                <span>{selectedItem.approveRemark}</span>
              </div>
            )}
          </Space>
        )}
      </Modal>

      <Modal focusLock
        title="拒绝换班申请"
        visible={rejectVisible}
        onOk={handleReject}
        onCancel={() => {
          setRejectVisible(false)
          setRejectRemark('')
        }}
      >
        <Form layout="vertical">
          <FormItem label="拒绝原因" required>
            <Input.TextArea
              placeholder="请输入拒绝原因"
              value={rejectRemark}
              onChange={setRejectRemark}
              rows={3}
              className={styles['schedule-swaps__textarea']}
            />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default SwapsPage
