import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Message, Modal, Select, Space, Switch, Table, Tag, Typography } from '@arco-design/web-react'
import { createSalaryComponent, getSalaryComponents, updateSalaryComponent } from '@/api/payroll'

const { Title, Text } = Typography
const FormItem = Form.Item
const Option = Select.Option

const typeMap: Record<string, { text: string; color: string }> = {
  earning: { text: '应发', color: 'green' },
  deduction: { text: '扣款', color: 'red' },
  employer_contribution: { text: '公司承担', color: 'blue' },
}

function PayrollComponentsPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await getSalaryComponents()
      setData(res.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ type: 'earning', amountType: 'fixed', taxable: false, enabled: true, sortOrder: 0 })
    setVisible(true)
  }

  const openEdit = (record: any) => {
    setEditing(record)
    form.setFieldsValue(record)
    setVisible(true)
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    if (editing) {
      await updateSalaryComponent(editing.id, values)
      Message.success('薪资组件更新成功')
    } else {
      await createSalaryComponent(values)
      Message.success('薪资组件创建成功')
    }
    setVisible(false)
    loadData()
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title heading={5} style={{ margin: 0 }}>薪资组件</Title>
            <Button type="primary" onClick={openCreate}>新增组件</Button>
          </div>
          <Text type="secondary">参考 ERPNext 的 Earnings / Deductions 思路，把基本工资、津贴、扣款、个税等拆成可复用组件。</Text>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={[
            { title: '组件名称', dataIndex: 'name' },
            { title: '编码', dataIndex: 'code' },
            {
              title: '类型',
              dataIndex: 'type',
              render: (value) => {
                const info = typeMap[value] || { text: value, color: 'gray' }
                return <Tag color={info.color}>{info.text}</Tag>
              },
            },
            { title: '金额类型', dataIndex: 'amountType' },
            {
              title: '是否计税',
              dataIndex: 'taxable',
              render: (value) => <Tag color={value ? 'orange' : 'gray'}>{value ? '计税' : '不计税'}</Tag>,
            },
            {
              title: '状态',
              dataIndex: 'enabled',
              render: (value) => <Tag color={value ? 'green' : 'gray'}>{value ? '启用' : '停用'}</Tag>,
            },
            {
              title: '操作',
              width: 90,
              render: (_: unknown, record: any) => (
                <Button type="text" size="small" onClick={() => openEdit(record)}>
                  编辑
                </Button>
              ),
            },
          ]}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑薪资组件' : '新增薪资组件'}
        visible={visible}
        onOk={handleSubmit}
        onCancel={() => setVisible(false)}
        style={{ width: 560 }}
      >
        <Form form={form} layout="vertical">
          <FormItem label="组件名称" field="name" rules={[{ required: true, message: '请输入组件名称' }]}>
            <Input placeholder="例如：基本工资、迟到扣款、个税" />
          </FormItem>
          <FormItem label="组件编码" field="code" rules={[{ required: true, message: '请输入组件编码' }]}>
            <Input placeholder="例如：base_salary、late_deduction" disabled={Boolean(editing)} />
          </FormItem>
          <FormItem label="组件类型" field="type" rules={[{ required: true, message: '请选择组件类型' }]}>
            <Select>
              <Option value="earning">应发</Option>
              <Option value="deduction">扣款</Option>
              <Option value="employer_contribution">公司承担</Option>
            </Select>
          </FormItem>
          <FormItem label="金额类型" field="amountType" rules={[{ required: true, message: '请选择金额类型' }]}>
            <Select>
              <Option value="fixed">固定金额</Option>
              <Option value="formula">安全公式</Option>
              <Option value="attendance_based">按考勤折算</Option>
              <Option value="manual">手工录入</Option>
            </Select>
          </FormItem>
          <FormItem label="公式白名单" field="formula">
            <Input placeholder="仅支持 baseSalary 或 baseSalary/21.75" />
          </FormItem>
          <Space size="large">
            <FormItem label="是否计税" field="taxable" triggerPropName="checked">
              <Switch />
            </FormItem>
            <FormItem label="启用状态" field="enabled" triggerPropName="checked">
              <Switch />
            </FormItem>
            <FormItem label="排序" field="sortOrder">
              <InputNumber min={0} />
            </FormItem>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default PayrollComponentsPage
