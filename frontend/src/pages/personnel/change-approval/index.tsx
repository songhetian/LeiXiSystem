import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
} from '@arco-design/web-react'
import type { DescriptionsProps } from '@arco-design/web-react'
import {
  getInfoChanges,
  getInfoChangeDetail,
  approveInfoChange,
  rejectInfoChange,
  EmployeeInfoChangeRequest,
} from '@/api/employee-change'
import { PageHeader, BatchActions } from '@/components'
import { useBatchSelection } from '@/hooks/useBatchSelection'
import './index.css'

const FormItem = Form.Item
const TabPane = Tabs.TabPane

const typeMap: Record<string, { text: string; color: string }> = {
  basic_info: { text: '基本信息', color: 'blue' },
  contact_info: { text: '联系信息', color: 'green' },
  position_info: { text: '职位信息', color: 'orange' },
  other: { text: '其他', color: 'gray' },
}

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  cancelled: { text: '已撤销', color: 'gray' },
}

function InfoChangeApprovalPage() {
  const [data, setData] = useState<EmployeeInfoChangeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [activeTab, setActiveTab] = useState('pending')
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<EmployeeInfoChangeRequest | null>(null)
  const [rejectVisible, setRejectVisible] = useState(false)
  const [form] = Form.useForm()
  const batch = useBatchSelection<EmployeeInfoChangeRequest>()

  const loadData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (activeTab === 'pending') {
        params.scope = 'pending_approval'
      } else if (activeTab === 'all') {
        params.scope = 'all'
      }

      const res = await getInfoChanges(params)
      setData(res.data.list || [])
      setPagination({
        current: res.data.page || page,
        pageSize: res.data.pageSize || pageSize,
        total: res.data.total || 0,
      })
    } catch (e: any) {
      Message.error(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    loadData()
    batch.clearSelection()
  }, [loadData, batch])

  const handlePageChange = (page: number, pageSize: number) => {
    loadData(page, pageSize)
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
  }

  const handleView = async (record: EmployeeInfoChangeRequest) => {
    try {
      const res = await getInfoChangeDetail(record.id)
      setCurrentRecord(res.data)
      setDetailVisible(true)
    } catch (e: any) {
      Message.error(e?.message || '加载详情失败')
    }
  }

  const handleApprove = async (record: EmployeeInfoChangeRequest) => {
    try {
      await approveInfoChange(record.id)
      Message.success('已通过申请')
      setDetailVisible(false)
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      Message.error(e?.message || '审批失败')
    }
  }

  const handleReject = async () => {
    try {
      const values = await form.validate()
      if (!currentRecord) return
      await rejectInfoChange(currentRecord.id, { approvalComment: values.comment })
      Message.success('已驳回申请')
      setRejectVisible(false)
      setDetailVisible(false)
      form.resetFields()
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      Message.error(e?.message || '驳回失败')
    }
  }

  // 批量审批
  const handleBatchApprove = async () => {
    const pendingItems = data.filter(
      (item) => item.status === 'pending' && batch.selectedIds.includes(item.id)
    )
    if (pendingItems.length === 0) {
      Message.warning('请选择待审批的申请')
      return
    }

    try {
      for (const item of pendingItems) {
        await approveInfoChange(item.id)
      }
      Message.success(`成功通过 ${pendingItems.length} 个申请`)
      batch.clearSelection()
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      Message.error(e?.message || '批量审批失败')
    }
  }

  const columns = [
    {
      title: '申请人',
      width: 120,
      render: (_: unknown, record: EmployeeInfoChangeRequest) =>
        record.employee?.user?.realName || '-',
    },
    {
      title: '工号',
      width: 100,
      render: (_: unknown, record: EmployeeInfoChangeRequest) =>
        record.employee?.employeeNo || '-',
    },
    {
      title: '部门',
      width: 120,
      render: (_: unknown, record: EmployeeInfoChangeRequest) =>
        record.employee?.user?.department?.name || '-',
    },
    {
      title: '变更类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => {
        const info = typeMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '变更内容',
      dataIndex: 'changeData',
      width: 200,
      render: (value: Record<string, any>) => {
        const keys = Object.keys(value).slice(0, 2)
        return keys.map((k) => `${k}: ${value[k]}`).join(', ') + (Object.keys(value).length > 2 ? '...' : '')
      },
    },
    {
      title: '申请原因',
      dataIndex: 'reason',
      width: 150,
      ellipsis: true,
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
      width: 120,
      render: (_: unknown, record: EmployeeInfoChangeRequest) => (
        <Space>
          <Button type="text" size="small" onClick={() => handleView(record)}>
            详情
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="info-change-approval">
      <Card bordered={false}>
        <PageHeader
          title="信息变更审批"
          description="审批员工提交的信息变更申请，审批通过后自动更新员工信息。"
        />
      </Card>

      <Card bordered={false}>
        <Tabs activeTab={activeTab} onChange={handleTabChange}>
          <TabPane key="pending" title="待审批" />
          <TabPane key="all" title="全部" />
        </Tabs>

        <BatchActions
          selectedCount={batch.selectedCount}
          onClear={batch.clearSelection}
          actions={
            <Button type="primary" onClick={handleBatchApprove}>
              批量通过
            </Button>
          }
        />

        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={columns}
          rowSelection={batch.getRowSelection(data)}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="变更申请详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          currentRecord?.status === 'pending' ? (
            <Space>
              <Button onClick={() => setDetailVisible(false)}>取消</Button>
              <Button status="danger" onClick={() => setRejectVisible(true)}>
                驳回
              </Button>
              <Button type="primary" onClick={() => handleApprove(currentRecord)}>
                通过
              </Button>
            </Space>
          ) : null
        }
      >
        {currentRecord && (
          <Descriptions
            column={2}
            bordered
            data={[
              { label: '申请人', value: currentRecord.employee?.user?.realName || '-' },
              { label: '工号', value: currentRecord.employee?.employeeNo || '-' },
              { label: '部门', value: currentRecord.employee?.user?.department?.name || '-' },
              { label: '变更类型', value: typeMap[currentRecord.type]?.text || currentRecord.type },
              {
                label: '状态',
                value: (
                  <Tag color={statusMap[currentRecord.status]?.color}>
                    {statusMap[currentRecord.status]?.text || currentRecord.status}
                  </Tag>
                ),
              },
              { label: '申请时间', value: new Date(currentRecord.createdAt).toLocaleString() },
              { label: '申请原因', value: currentRecord.reason || '-', span: 2 },
              {
                label: '原始数据',
                value: (
                  <Input.TextArea
                    value={JSON.stringify(currentRecord.originalData, null, 2)}
                    readOnly
                    autoSize={{ minRows: 2, maxRows: 4 }}
                  />
                ),
                span: 2,
              },
              {
                label: '变更数据',
                value: (
                  <Input.TextArea
                    value={JSON.stringify(currentRecord.changeData, null, 2)}
                    readOnly
                    autoSize={{ minRows: 2, maxRows: 4 }}
                  />
                ),
                span: 2,
              },
              { label: '审批意见', value: currentRecord.approvalComment || '-', span: 2 },
            ]}
          />
        )}
      </Modal>

      {/* 驳回弹窗 */}
      <Modal
        title="驳回申请"
        visible={rejectVisible}
        onOk={handleReject}
        onCancel={() => {
          setRejectVisible(false)
          form.resetFields()
        }}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="驳回原因"
            field="comment"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <Input.TextArea placeholder="请输入驳回原因" rows={3} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default InfoChangeApprovalPage
