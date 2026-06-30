import { useCallback, useMemo, useState } from 'react'
import { Button, Card, Form, Message, Select, Space, Table, Tag, Typography } from '@arco-design/web-react'
import { IconDownload } from '@arco-design/web-react/icon'
import { getAttendanceExceptions, resolveAttendanceException } from '@/api/attendance'
import ApprovalActionModal from '@/components/ApprovalActionModal'
import StatusTag from '@/components/StatusTag'
import { useTableData } from '@/hooks/useTableData'
import './style.css'

const { Title, Text } = Typography
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
  const [searchParams, setSearchParams] = useState<Record<string, any>>({})
  const [form] = Form.useForm()
  const { data, total, page, loading, loadData, handleSearch: originalSearch, handleReset: originalReset } = useTableData({
    fetcher: getAttendanceExceptions,
    form,
  })

  const handleSearch = () => {
    const values = form.getFieldsValue()
    setSearchParams(values || {})
    originalSearch()
  }

  const handleReset = () => {
    setSearchParams({})
    originalReset()
  }

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

  const handleExport = () => {
    const params = new URLSearchParams()
    const currentParams = searchParams || {}
    Object.entries(currentParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    const url = `/api/attendance/exceptions/export/csv${params.toString() ? '?' + params.toString() : ''}`
    window.open(url, '_blank')
  }

  const columns = useMemo(() => [
    {
      title: '员工',
      render: (_: unknown, record: any) => record.employee?.user?.realName || '-',
    },
    {
      title: '部门',
      render: (_: unknown, record: any) => record.employee?.user?.department?.name || '-',
    },
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

  return (
    <div className="attendance-exceptions">
      <Card bordered={false} className="attendance-exceptions__card">
        <Space direction="vertical" size={4}>
          <Title heading={5} className="attendance-exceptions__title">考勤异常</Title>
          <Text type="secondary">集中处理缺卡、旷工等自动核算生成的异常，处理后会触发对应日期考勤重算。</Text>
        </Space>
      </Card>

      <Card bordered={false} className="attendance-exceptions__card">
        <Form form={form} layout="inline">
          <FormItem label="状态" field="status">
            <Select allowClear placeholder="全部状态" className="attendance-exceptions__select">
              <Option value="pending">待处理</Option>
              <Option value="resolved">已解决</Option>
              <Option value="rejected">已驳回</Option>
            </Select>
          </FormItem>
          <FormItem label="类型" field="type">
            <Select allowClear placeholder="全部类型" className="attendance-exceptions__select">
              {Object.entries(typeMap).map(([value, label]) => (
                <Option key={value} value={value}>{label}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" onClick={handleSearch}>查询</Button>
              <Button onClick={handleReset}>重置</Button>
              <Button icon={<IconDownload />} onClick={handleExport}>导出</Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={columns}
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
    </div>
  )
}

export default AttendanceExceptionsPage
