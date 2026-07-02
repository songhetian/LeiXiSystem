import { useEffect, useState } from 'react'
import { Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from '@arco-design/web-react'
import { getAuditLogDetail, getAuditLogs } from '@/api/security'
import { PageHeader } from '@/components'
import styles from './audit-logs.module.css'
const FormItem = Form.Item
const Option = Select.Option

const moduleColor: Record<string, string> = {
  payroll: 'red',
  attendance: 'orange',
  auth: 'blue',
  rbac: 'purple',
  security: 'gray',
}

function AuditLogsPage() {
  const [data, setData] = useState<{ id: number; createdAt: string; username: string; module: string; action: string; ipAddress?: string; status: string; requestSummary?: string }[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [detail, setDetail] = useState<{ id: number; createdAt: string; username?: string; module: string; action: string; ipAddress?: string; status: string; requestData?: Record<string, unknown>; responseData?: Record<string, unknown>; userAgent?: string } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [form] = Form.useForm()

  const loadData = async (nextPage = page, nextFilters = filters) => {
    setLoading(true)
    try {
      const res = await getAuditLogs({ page: nextPage, pageSize: 20, ...nextFilters })
      setData(res.data?.list || [])
      setTotal(res.data?.total || 0)
      setPage(nextPage)
      setFilters(nextFilters)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(1, {})
  }, [])

  const handleSearch = async () => {
    const values = form.getFieldsValue()
    await loadData(1, values)
  }

  const handleReset = async () => {
    form.resetFields()
    await loadData(1, {})
  }

  const openDetail = async (record: any) => {
    setVisible(true)
    setDetailLoading(true)
    const res = await getAuditLogDetail(record.id)
    setDetail(res.data as any)
    setDetailLoading(false)
  }

  return (
    <div className={styles['security-audit-logs']}>
      <Card bordered={false} className={styles['security-audit-logs__header-card']}>
        <PageHeader
          title="安全审计日志"
          description="集中查看登录、打卡、薪资、工资条查看、权限变更等敏感操作，敏感字段已在后端脱敏。"
        />
      </Card>

      <Card bordered={false} className={styles['security-audit-logs__header-card']}>
        <Form form={form} layout="inline">
          <FormItem label="模块" field="module">
            <Select className={styles['security-audit-logs__search-select']} allowClear placeholder="全部模块">
              <Option value="payroll">薪资</Option>
              <Option value="attendance">考勤</Option>
              <Option value="auth">认证</Option>
              <Option value="rbac">权限</Option>
              <Option value="security">安全</Option>
            </Select>
          </FormItem>
          <FormItem label="动作" field="action">
            <Input className={styles['security-audit-logs__search-input']} placeholder="例如 payslip" allowClear />
          </FormItem>
          <FormItem label="用户" field="username">
            <Input className={styles['security-audit-logs__search-input--sm']} placeholder="用户名" allowClear />
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" onClick={handleSearch}>查询</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={[
            { title: '时间', dataIndex: 'createdAt', width: 180 },
            { title: '用户', dataIndex: 'username', width: 120 },
            {
              title: '模块',
              dataIndex: 'module',
              width: 110,
              render: (value) => <Tag color={moduleColor[value] || 'gray'}>{value}</Tag>,
            },
            { title: '动作', dataIndex: 'action', width: 220 },
            { title: 'IP', dataIndex: 'ipAddress', width: 140 },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value) => <Tag color={value === 'success' ? 'green' : 'red'}>{value}</Tag>,
            },
            {
              title: '请求摘要',
              dataIndex: 'requestSummary',
              render: (value) => value ? <code>{String(value).slice(0, 120)}</code> : '-',
            },
            {
              title: '操作',
              width: 90,
              render: (_: unknown, record: any) => (
                <Button type="text" size="small" onClick={() => openDetail(record)}>
                  详情
                </Button>
              ),
            },
          ]}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: (current) => loadData(current, filters),
          }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal focusLock
        title="审计日志详情"
        visible={visible}
        footer={null}
        onCancel={() => setVisible(false)}
        className={styles['security-audit-logs__modal']}
      >
        {detailLoading && <Typography.Text type="secondary">正在加载详情...</Typography.Text>}
        {detail && !detailLoading && (
          <Space direction="vertical" className={styles['security-audit-logs__modal-content']}>
            <Descriptions
              column={2}
              data={[
                { label: '时间', value: detail.createdAt },
                { label: '用户', value: detail.username || '-' },
                { label: '模块', value: detail.module },
                { label: '动作', value: detail.action },
                { label: 'IP', value: detail.ipAddress || '-' },
                { label: '状态', value: detail.status },
              ]}
            />
            <span className={styles['security-audit-logs__section-title']}>请求数据</span>
            <Input.TextArea
              value={JSON.stringify(detail.requestData || {}, null, 2)}
              autoSize={{ minRows: 5, maxRows: 10 }}
              readOnly
            />
            <span className={styles['security-audit-logs__section-title']}>响应数据</span>
            <Input.TextArea
              value={JSON.stringify(detail.responseData || {}, null, 2)}
              autoSize={{ minRows: 5, maxRows: 10 }}
              readOnly
            />
            <span className={styles['security-audit-logs__section-title']}>User-Agent</span>
            <Input.TextArea
              value={detail.userAgent || '-'}
              autoSize={{ minRows: 2, maxRows: 4 }}
              readOnly
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default AuditLogsPage
