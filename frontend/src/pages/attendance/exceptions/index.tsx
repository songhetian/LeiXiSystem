import { useCallback, useMemo, useState } from 'react'
import { Button, Card, Form, Message, Select, Space, Table, Tag } from '@arco-design/web-react'
import { IconCheckCircle, IconCloseCircle } from '@arco-design/web-react/icon'
import { getAttendanceExceptions, resolveAttendanceException } from '@/api/attendance'
import { batchResolveExceptions } from '@/api/attendance-exception'
import { PageHeader, FilterBar, ApprovalActionModal, StatusTag, employeeColumn, departmentColumn, BatchActions } from '@/components'
import { useTableData } from '@/hooks/useTableData'
import { useExport } from '@/hooks/useExport'
import { useBatchSelection } from '@/hooks/useBatchSelection'
import styles from './style.module.css'
const FormItem = Form.Item
const Option = Select.Option

const typeMap: Record<string, string> = {
  absent: '旷工',
  missing_checkin: '缺卡',
  missing_in: '缺少上班卡',
  missing_out: '缺少下班卡',
  late: '迟到',
  early: '早退',
}

interface ExceptionRecord {
  id: number
  employee: {
    user: {
      realName: string
      department: {
        name: string
      }
    }
  }
  date: string
  type: string
  status: string
  reason?: string
}

function AttendanceExceptionsPage() {
  const [detail, setDetail] = useState<ExceptionRecord | null>(null)
  const [visible, setVisible] = useState(false)
  const [batchVisible, setBatchVisible] = useState(false)
  const [batchAction, setBatchAction] = useState<'resolved' | 'rejected'>('resolved')
  const [form] = Form.useForm()
  const batch = useBatchSelection<ExceptionRecord>()
  const { handleExport: _handleExport, ExportButton } = useExport()
  const { data, total, page, loading, loadData, handleSearch, handleReset } = useTableData({
    fetcher: getAttendanceExceptions,
    form,
  })

  const openHandle = useCallback((record: any) => {
    setDetail(record)
    setVisible(true)
  }, [])

  const submitHandle = useCallback(async (values: { action?: string; comment?: string }) => {
    if (!detail?.id) return
    await resolveAttendanceException(detail.id, {
      status: (values.action || 'resolved') as 'resolved' | 'rejected',
      reason: values.comment,
    })
    Message.success('考勤异常已处理')
    setVisible(false)
    await loadData(page)
  }, [detail, loadData, page])

  const openBatchHandle = useCallback((action: 'resolved' | 'rejected') => {
    setBatchAction(action)
    setBatchVisible(true)
  }, [])

  const submitBatchHandle = useCallback(async (values: { action?: string; comment?: string }) => {
    if (batch.selectedIds.length === 0) return
    await batchResolveExceptions({
      ids: batch.selectedIds as number[],
      status: (values.action || batchAction) as 'resolved' | 'rejected',
      reason: values.comment,
    })
    Message.success(`成功处理 ${batch.selectedIds.length} 条考勤异常`)
    setBatchVisible(false)
    batch.clearSelection()
    await loadData(page)
  }, [batch, batchAction, loadData, page])

  const columns = useMemo(() => [
    employeeColumn(),
    departmentColumn(),
    { title: '日期', dataIndex: 'date' },
    {
      title: '类型',
      dataIndex: 'type',
      render: (value: string) => <Tag color="orange">{typeMap[value] || value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag preset="attendanceException" value={value} />,
    },
    { title: '原因', dataIndex: 'reason' },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, record: any) => (
        <Button type="text" size="small" disabled={record.status !== 'pending'} onClick={() => openHandle(record)}>
          处理
        </Button>
      ),
    },
  ], [openHandle])

  const batchActions = useMemo(() => (
    <Space>
      <Button
        type="primary"
        icon={<IconCheckCircle />}
        onClick={() => openBatchHandle('resolved')}
      >
        批量解决
      </Button>
      <Button
        status="warning"
        icon={<IconCloseCircle />}
        onClick={() => openBatchHandle('rejected')}
      >
        批量驳回
      </Button>
    </Space>
  ), [openBatchHandle])

  return (
    <div className={styles['attendance-exceptions']}>
      <Card bordered={false} className={styles['attendance-exceptions__card']}>
        <PageHeader
          title="考勤异常"
          description="集中处理缺卡、旷工等自动核算生成的异常，处理后会触发对应日期考勤重算。"
        />
      </Card>

      <Card bordered={false} className={styles['attendance-exceptions__card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="状态" field="status">
                <Select allowClear placeholder="全部状态" className={styles['attendance-exceptions__select']}>
                  <Option value="pending">待处理</Option>
                  <Option value="resolved">已解决</Option>
                  <Option value="rejected">已驳回</Option>
                </Select>
              </FormItem>
              <FormItem label="类型" field="type">
                <Select allowClear placeholder="全部类型" className={styles['attendance-exceptions__select']}>
                  {Object.entries(typeMap).map(([value, label]) => (
                    <Option key={value} value={value}>{label}</Option>
                  ))}
                </Select>
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
        />
        <div className={styles['attendance-exceptions__export']}>
          <ExportButton apiUrl="/api/attendance/exceptions/export/csv" />
        </div>
      </Card>

      <Card bordered={false}>
        <BatchActions
          selectedCount={batch.selectedCount}
          onClear={batch.clearSelection}
          actions={batchActions}
        />
        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={columns}
          rowSelection={batch.getRowSelection(data)}
          pagination={{
            total,
            current: page,
            pageSize: 10,
            onChange: (current) => loadData(current),
          }}
        />
      </Card>

      <ApprovalActionModal
        visible={visible}
        onOk={submitHandle}
        onCancel={() => setVisible(false)}
        title="处理考勤异常"
        actionOptions={[
          { label: '标记已解决', value: 'resolved' },
          { label: '驳回异常处理', value: 'rejected' },
        ]}
        initialAction="resolved"
        commentLabel="处理说明"
        commentPlaceholder="请输入处理说明"
        defaultComment={detail?.reason}
        commentRequired={false}
      />

      <ApprovalActionModal
        visible={batchVisible}
        onOk={submitBatchHandle}
        onCancel={() => setBatchVisible(false)}
        title={`批量${batchAction === 'resolved' ? '解决' : '驳回'}考勤异常`}
        actionOptions={[
          { label: '标记已解决', value: 'resolved' },
          { label: '驳回异常处理', value: 'rejected' },
        ]}
        initialAction={batchAction}
        commentLabel="处理说明"
        commentPlaceholder="请输入处理说明"
        commentRequired={false}
      />
    </div>
  )
}

export default AttendanceExceptionsPage
