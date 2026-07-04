import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
  Typography,
} from '@arco-design/web-react'
import { IconPlus, IconEdit, IconDelete, IconExport } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { get, post } from '@/api/request'
import { PageHeader, TableHeader } from '@/components'
import { toast } from '@/utils/toast'
import './index.css'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane
const { Text } = Typography

interface ReportTemplate {
  id: number
  name: string
  type: string
  description?: string
  config: any
  isDefault: boolean
  status: string
  createdAt: string
  createdByUser?: { realName: string }
}

const typeMap: Record<string, { text: string; color: string }> = {
  attendance: { text: '考勤报表', color: 'arcoblue' },
  payroll: { text: '薪资报表', color: 'green' },
  vacation: { text: '假期报表', color: 'orange' },
  employee: { text: '员工报表', color: 'purple' },
  custom: { text: '自定义报表', color: 'gray' },
}

const dimensionOptions = {
  attendance: ['date', 'employeeName', 'department'],
  payroll: ['period', 'employeeName', 'department'],
  vacation: ['employeeName', 'department', 'vacationType'],
  employee: ['employeeNo', 'employeeName', 'department', 'position'],
}

const metricOptions = {
  attendance: [
    { field: 'workHours', aggregation: 'sum', label: '总工时' },
    { field: 'lateCount', aggregation: 'count', label: '迟到次数' },
    { field: 'earlyCount', aggregation: 'count', label: '早退次数' },
    { field: 'absentCount', aggregation: 'count', label: '旷工次数' },
  ],
  payroll: [
    { field: 'grossPay', aggregation: 'sum', label: '应发工资' },
    { field: 'totalDeduction', aggregation: 'sum', label: '总扣款' },
    { field: 'netPay', aggregation: 'sum', label: '实发工资' },
  ],
  vacation: [
    { field: 'total', aggregation: 'sum', label: '总额度' },
    { field: 'used', aggregation: 'sum', label: '已使用' },
    { field: 'balance', aggregation: 'sum', label: '剩余' },
  ],
  employee: [
    { field: 'count', aggregation: 'count', label: '人数' },
  ],
}

function ReportTemplatePage() {
  const [data, setData] = useState<ReportTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [createVisible, setCreateVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<ReportTemplate | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  const loadData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const res = await get<any>('/report-templates', { params: { page, pageSize } })
      setData(res.data?.list || [])
      setPagination({
        current: res.data?.page || page,
        pageSize: res.data?.pageSize || pageSize,
        total: res.data?.total || 0,
      })
    } catch (e: any) {
      toast.error(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePageChange = (page: number, pageSize: number) => {
    loadData(page, pageSize)
  }

  const handleCreate = async () => {
    try {
      const values = await form.validate()
      await post('/report-templates', values)
      toast.success('创建成功')
      setCreateVisible(false)
      form.resetFields()
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      toast.error(e?.message || '创建失败')
    }
  }

  const handleEdit = (record: ReportTemplate) => {
    setCurrentRecord(record)
    editForm.setFieldsValue({
      name: record.name,
      type: record.type,
      description: record.description,
      config: record.config,
      isDefault: record.isDefault,
      status: record.status,
    })
    setEditVisible(true)
  }

  const handleUpdate = async () => {
    if (!currentRecord) return
    try {
      const values = await editForm.validate()
      await post(`/report-templates/${currentRecord.id}`, values)
      toast.success('更新成功')
      setEditVisible(false)
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      toast.error(e?.message || '更新失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await post(`/report-templates/${id}`, {}, { method: 'DELETE' })
      toast.success('删除成功')
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      toast.error(e?.message || '删除失败')
    }
  }

  const handleExport = async (id: number) => {
    try {
      const res = await post<any>(`/report-templates/${id}/export`, { format: 'csv' })
      // 创建下载链接
      const blob = new Blob([res as any], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `report_${id}_${Date.now()}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(e?.message || '导出失败')
    }
  }

  const columns: TableProps<ReportTemplate>['columns'] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 180,
      render: (value, record) => (
        <Space>
          <Text bold>{value}</Text>
          {record.isDefault && <Tag color="arcoblue">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '报表类型',
      dataIndex: 'type',
      width: 100,
      render: (value) => {
        const info = typeMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value) => (
        <Tag color={value === 'active' ? 'green' : 'gray'}>
          {value === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'createdByUser',
      width: 100,
      render: (value) => value?.realName || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value) => new Date(value).toLocaleString(),
    },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, record) => (
        <Space>
          <Button type="text" size="small" icon={<IconExport />} onClick={() => handleExport(record.id)}>
            导出
          </Button>
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="report-template-page">
      <Card bordered={false}>
        <PageHeader
          title="报表模板"
          description="创建和管理自定义报表模板，支持多维度数据分析和导出。"
        />
      </Card>

      <Card bordered={false}>
        <TableHeader
          title="报表模板列表"
          total={pagination.total}
          extra={
            <Button type="primary" icon={<IconPlus />} onClick={() => setCreateVisible(true)}>
              创建模板
            </Button>
          }
        />

        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={columns}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
        />
      </Card>

      {/* 创建弹窗 */}
      <Modal
        title="创建报表模板"
        visible={createVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateVisible(false)
          form.resetFields()
        }}
        width={700}
      >
        <Form form={form} layout="vertical">
          <FormItem label="模板名称" field="name" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="请输入模板名称" />
          </FormItem>

          <FormItem label="报表类型" field="type" rules={[{ required: true, message: '请选择报表类型' }]}>
            <Select placeholder="请选择报表类型">
              <Option value="attendance">考勤报表</Option>
              <Option value="payroll">薪资报表</Option>
              <Option value="vacation">假期报表</Option>
              <Option value="employee">员工报表</Option>
              <Option value="custom">自定义报表</Option>
            </Select>
          </FormItem>

          <FormItem label="描述" field="description">
            <Input.TextArea placeholder="请输入描述" rows={2} />
          </FormItem>

          <FormItem label="设为默认" field="isDefault" triggerPropName="checked">
            <Input type="checkbox" />
          </FormItem>
        </Form>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑报表模板"
        visible={editVisible}
        onOk={handleUpdate}
        onCancel={() => setEditVisible(false)}
        width={700}
      >
        <Form form={editForm} layout="vertical">
          <FormItem label="模板名称" field="name" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="请输入模板名称" />
          </FormItem>

          <FormItem label="描述" field="description">
            <Input.TextArea placeholder="请输入描述" rows={2} />
          </FormItem>

          <FormItem label="状态" field="status">
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">禁用</Option>
            </Select>
          </FormItem>

          <FormItem label="设为默认" field="isDefault" triggerPropName="checked">
            <Input type="checkbox" />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default ReportTemplatePage
