import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Form, Input, Message, Modal, Select, Space, Table, Tag } from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconCheck, IconPlus, IconRefresh } from '@arco-design/web-react/icon'
import { createHelpdeskTicket, getHelpdeskCategories, getHelpdeskTickets, updateHelpdeskTicket } from '@/api/helpdesk'
import { getEmployees } from '@/api/personnel'

const FormItem = Form.Item
const Option = Select.Option

type Ticket = {
  id: number
  ticketNo: string
  title: string
  priority: string
  status: string
  createdAt: string
  category?: { name: string }
  creator?: { realName: string }
  assignee?: { realName: string }
  employee?: {
    employeeNo: string
    user?: { realName: string }
  }
}

const priorityMap: Record<string, { text: string; color: string }> = {
  low: { text: '低', color: 'gray' },
  medium: { text: '中', color: 'blue' },
  high: { text: '高', color: 'orange' },
  urgent: { text: '紧急', color: 'red' },
}

const statusMap: Record<string, { text: string; color: string }> = {
  open: { text: '待处理', color: 'orange' },
  processing: { text: '处理中', color: 'blue' },
  resolved: { text: '已解决', color: 'green' },
  closed: { text: '已关闭', color: 'gray' },
  cancelled: { text: '已取消', color: 'red' },
}

function HelpdeskTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [form] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ticketRes, categoryRes, employeeRes]: any[] = await Promise.all([
        getHelpdeskTickets({ page: 1, pageSize: 100 }),
        getHelpdeskCategories(),
        getEmployees({ page: 1, pageSize: 100, status: 'active' }),
      ])
      setTickets(ticketRes?.data?.list || [])
      setCategories(categoryRes?.data || [])
      setEmployees(employeeRes?.data?.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = async () => {
    const values = await form.validate()
    await createHelpdeskTicket(values)
    Message.success('工单已提交')
    setVisible(false)
    form.resetFields()
    loadData()
  }

  const columns: TableProps<Ticket>['columns'] = [
    { title: '工单号', dataIndex: 'ticketNo', width: 150 },
    { title: '标题', dataIndex: 'title' },
    {
      title: '分类',
      width: 120,
      render: (_: any, record) => record.category?.name || '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (value) => {
        const info = priorityMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => {
        const info = statusMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '关联员工',
      width: 160,
      render: (_: any, record) => record.employee
        ? `${record.employee.user?.realName || '-'}（${record.employee.employeeNo}）`
        : '-',
    },
    {
      title: '创建人',
      width: 120,
      render: (_: any, record) => record.creator?.realName || '-',
    },
    {
      title: '处理人',
      width: 120,
      render: (_: any, record) => record.assignee?.realName || '-',
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, record) => record.status !== 'resolved' && record.status !== 'closed' ? (
        <Button
          size="small"
          type="text"
          icon={<IconCheck />}
          onClick={async () => {
            await updateHelpdeskTicket(record.id, { status: 'resolved' })
            Message.success('已标记解决')
            loadData()
          }}
        >
          解决
        </Button>
      ) : null,
    },
  ]

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>HR Help Desk</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>员工服务工单</Tag>
          </div>
          <Space>
            <Button icon={<IconRefresh />} onClick={loadData}>刷新</Button>
            <Button type="primary" icon={<IconPlus />} onClick={() => setVisible(true)}>提交工单</Button>
          </Space>
        </div>
        <Table rowKey="id" loading={loading} columns={columns} data={tickets} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="提交工单" visible={visible} onOk={handleCreate} onCancel={() => setVisible(false)} style={{ width: 620 }}>
        <Form form={form} layout="vertical" initialValues={{ priority: 'medium' }}>
          <FormItem label="标题" field="title" rules={[{ required: true, message: '请输入工单标题' }]}>
            <Input placeholder="例如：工资条金额疑问" />
          </FormItem>
          <FormItem label="分类" field="categoryId" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="请选择工单分类">
              {categories.map((category) => <Option key={category.id} value={category.id}>{category.name}</Option>)}
            </Select>
          </FormItem>
          <FormItem label="优先级" field="priority">
            <Select>
              <Option value="low">低</Option>
              <Option value="medium">中</Option>
              <Option value="high">高</Option>
              <Option value="urgent">紧急</Option>
            </Select>
          </FormItem>
          <FormItem label="关联员工" field="employeeId">
            <Select placeholder="可选，关联到员工档案" allowClear showSearch>
              {employees.map((employee) => (
                <Option key={employee.id} value={employee.id}>
                  {employee.realName}（{employee.employeeNo}）
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="问题描述" field="description">
            <Input.TextArea rows={4} placeholder="请描述问题背景、期望结果和相关单据编号" />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default HelpdeskTicketsPage
