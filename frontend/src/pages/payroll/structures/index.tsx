import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from '@arco-design/web-react'
import { createSalaryStructure, getSalaryComponents, getSalaryStructures, updateSalaryStructure, SalaryComponent, SalaryStructure, SalaryStructureItem } from '@/api/payroll'
import { PageHeader } from '@/components'
import { formatDate, getToday } from '@/utils/date'
import { toast } from '@/utils/toast'
import styles from './index.module.css'
const { Text } = Typography
const FormItem = Form.Item
const Option = Select.Option

function SalaryStructuresPage() {
  const [data, setData] = useState<SalaryStructure[]>([])
  const [components, setComponents] = useState<SalaryComponent[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<SalaryStructure | null>(null)
  const [items, setItems] = useState<SalaryStructureItem[]>([])
  const [form] = Form.useForm()

  const loadData = async () => {
    setLoading(true)
    try {
      const [structureRes, componentRes]: any[] = await Promise.all([
        getSalaryStructures(),
        getSalaryComponents(),
      ])
      setData(structureRes.data || [])
      setComponents(componentRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setItems([])
    form.resetFields()
    form.setFieldsValue({
      payrollFrequency: 'monthly',
      status: 'active',
      effectiveFrom: getToday(),
    })
    setVisible(true)
  }

  const openEdit = (record: any) => {
    setEditing(record)
    setItems((record.items || []).map((item: any) => ({
      componentId: item.componentId,
      amount: Number(item.amount || 0),
      formula: item.formula,
      condition: item.condition,
      sortOrder: item.sortOrder || 0,
    })))
    form.setFieldsValue({
      name: record.name,
      payrollFrequency: record.payrollFrequency,
      status: record.status,
      effectiveFrom: record.effectiveFrom ? formatDate(record.effectiveFrom) : '',
      effectiveTo: record.effectiveTo ? formatDate(record.effectiveTo) : '',
    })
    setVisible(true)
  }

  const addItem = () => {
    setItems([...items, { componentId: undefined, amount: 0, sortOrder: items.length }])
  }

  const updateItem = (index: number, field: string, value: any) => {
    setItems(items.map((item, idx) => idx === index ? { ...item, [field]: value } : item))
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index))
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    const payload = {
      ...values,
      items: items.filter((item) => item.componentId).map((item) => ({
        ...item,
        componentId: Number(item.componentId),
        amount: Number(item.amount || 0),
        sortOrder: Number(item.sortOrder || 0),
      })),
    }

    if (editing) {
      await updateSalaryStructure(editing.id, payload)
      toast.success('薪资结构更新成功')
    } else {
      await createSalaryStructure(payload)
      toast.success('薪资结构创建成功')
    }

    setVisible(false)
    loadData()
  }

  return (
    <div className={styles['salary-structures']}>
      <Card bordered={false} className={styles['salary-structures__card']}>
        <PageHeader
          title="薪资结构"
          description="把薪资组件组合成可分配给员工的薪资结构，计算工资条时会读取这里的组件明细。"
          extra={<Button type="primary" onClick={openCreate}>新增结构</Button>}
        />
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={[
            { title: '结构名称', dataIndex: 'name' },
            { title: '发薪频率', dataIndex: 'payrollFrequency' },
            {
              title: '组件数',
              render: (_: unknown, record: any) => record.items?.length || 0,
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value: string) => {
                const statusMap: Record<string, { text: string; color: string }> = {
                  active: { text: '启用', color: 'green' },
                  inactive: { text: '停用', color: 'gray' },
                  draft: { text: '草稿', color: 'orange' },
                  archived: { text: '已归档', color: 'red' },
                }
                const info = statusMap[value]
                return info ? <Tag color={info.color}>{info.text}</Tag> : <Tag>{value}</Tag>
              },
            },
            { title: '生效日期', dataIndex: 'effectiveFrom' },
            {
              title: '操作',
              width: 90,
              render: (_: unknown, record: any) => (
                <Button type="text" size="small" onClick={() => openEdit(record)}>编辑</Button>
              ),
            },
          ]}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal focusLock
        title={editing ? '编辑薪资结构' : '新增薪资结构'}
        visible={visible}
        onOk={handleSubmit}
        onCancel={() => setVisible(false)}
        className={styles['salary-structures__modal']}
      >
        <Form form={form} layout="vertical">
          <FormItem label="结构名称" field="name" rules={[{ required: true, message: '请输入结构名称' }]}>
            <Input placeholder="例如：正式员工月薪结构" />
          </FormItem>
          <Space size="large" className={styles['salary-structures__space']}>
            <FormItem label="发薪频率" field="payrollFrequency" rules={[{ required: true, message: '请选择发薪频率' }]}>
              <Select className={styles['salary-structures__select']}>
                <Option value="monthly">月薪</Option>
                <Option value="weekly">周薪</Option>
                <Option value="daily">日薪</Option>
              </Select>
            </FormItem>
            <FormItem label="状态" field="status" rules={[{ required: true, message: '请选择状态' }]}>
              <Select className={styles['salary-structures__select--narrow']}>
                <Option value="active">启用</Option>
                <Option value="draft">草稿</Option>
                <Option value="disabled">停用</Option>
              </Select>
            </FormItem>
            <FormItem label="生效日期" field="effectiveFrom" rules={[{ required: true, message: '请输入生效日期' }]}>
              <Input className={styles['salary-structures__input']} placeholder="YYYY-MM-DD" />
            </FormItem>
            <FormItem label="失效日期" field="effectiveTo">
              <Input className={styles['salary-structures__input']} placeholder="YYYY-MM-DD" />
            </FormItem>
          </Space>
        </Form>

        <div className={styles['salary-structures__table-header']}>
          <Text className={styles['salary-structures__table-header-text']}>组件明细</Text>
          <Button size="small" onClick={addItem}>添加组件</Button>
        </div>

        <Table
          rowKey={(record) => String(record.componentId || record.sortOrder)}
          pagination={false}
          data={items}
          columns={[
            {
              title: '薪资组件',
              render: (_: unknown, record: any, index: number) => (
                <Select
                  value={record.componentId}
                  onChange={(value) => updateItem(index, 'componentId', value)}
                  className={styles['salary-structures__component-select']}
                  placeholder="选择组件"
                >
                  {components.map((component) => (
                    <Option key={component.id} value={component.id}>{component.name}</Option>
                  ))}
                </Select>
              ),
            },
            {
              title: '金额',
              render: (_: unknown, record: any, index: number) => (
                <InputNumber value={record.amount} onChange={(value) => updateItem(index, 'amount', value)} min={0} />
              ),
            },
            {
              title: '公式覆盖',
              render: (_: unknown, record: any, index: number) => (
                <Input value={record.formula} onChange={(value) => updateItem(index, 'formula', value)} placeholder="可留空" />
              ),
            },
            {
              title: '排序',
              render: (_: unknown, record: any, index: number) => (
                <InputNumber value={record.sortOrder} onChange={(value) => updateItem(index, 'sortOrder', value)} min={0} />
              ),
            },
            {
              title: '操作',
              width: 80,
              render: (_: unknown, __: any, index: number) => (
                <Button type="text" status="danger" size="small" onClick={() => removeItem(index)}>删除</Button>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  )
}

export default SalaryStructuresPage
