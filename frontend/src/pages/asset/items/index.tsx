import { useCallback, useEffect, useState } from 'react'
import { Button, Card, DatePicker, Form, Input, InputNumber, Message, Modal, Popconfirm, Select, Space, Table, Tabs, Tag } from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconPlus, IconRefresh } from '@arco-design/web-react/icon'
import { assignAsset, createAssetItem, getAssetCategories, getAssetItems, returnAsset } from '@/api/asset'
import { getEmployees } from '@/api/personnel'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

type AssetItem = {
  id: number
  assetNo: string
  name: string
  brand?: string
  model?: string
  serialNo?: string
  status: string
  location?: string
  category?: { name: string }
  currentEmployee?: {
    employeeNo: string
    user?: { realName: string }
  }
}

const statusMap: Record<string, { text: string; color: string }> = {
  idle: { text: '闲置', color: 'green' },
  assigned: { text: '已领用', color: 'blue' },
  maintenance: { text: '维修中', color: 'orange' },
  retired: { text: '已报废', color: 'red' },
}

function AssetItemsPage() {
  const [list, setList] = useState<AssetItem[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [assignVisible, setAssignVisible] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null)
  const [form] = Form.useForm()
  const [assignForm] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [assetRes, categoryRes, employeeRes]: any[] = await Promise.all([
        getAssetItems({ page: 1, pageSize: 100 }),
        getAssetCategories(),
        getEmployees({ page: 1, pageSize: 100, status: 'active' }),
      ])
      setList(assetRes?.data?.list || [])
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
    await createAssetItem(values)
    Message.success('资产已入库')
    setVisible(false)
    form.resetFields()
    loadData()
  }

  const handleAssign = async () => {
    if (!selectedAsset) return
    const values = await assignForm.validate()
    await assignAsset(selectedAsset.id, values)
    Message.success('资产已领用')
    setAssignVisible(false)
    assignForm.resetFields()
    loadData()
  }

  const columns: TableProps<AssetItem>['columns'] = [
    { title: '资产编号', dataIndex: 'assetNo', width: 150 },
    { title: '资产名称', dataIndex: 'name', width: 160 },
    {
      title: '分类',
      width: 120,
      render: (_: any, record) => record.category?.name || '-',
    },
    {
      title: '规格',
      render: (_: any, record) => [record.brand, record.model, record.serialNo].filter(Boolean).join(' / ') || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value) => {
        const info = statusMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '当前领用人',
      width: 160,
      render: (_: any, record) => record.currentEmployee
        ? `${record.currentEmployee.user?.realName || '-'}（${record.currentEmployee.employeeNo}）`
        : '-',
    },
    { title: '位置', dataIndex: 'location', width: 120 },
    {
      title: '操作',
      width: 180,
      render: (_: any, record) => (
        <Space>
          <Button
            size="small"
            type="text"
            disabled={record.status === 'retired'}
            onClick={() => {
              setSelectedAsset(record)
              setAssignVisible(true)
            }}
          >
            领用
          </Button>
          {record.currentEmployee ? (
            <Popconfirm
              title="确认归还"
              content="确认将该资产归还为空闲状态吗？"
              onOk={async () => {
                await returnAsset(record.id)
                Message.success('已归还')
                loadData()
              }}
            >
              <Button size="small" type="text">归还</Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>资产台账</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>共 {list.length} 项</Tag>
          </div>
          <Space>
            <Button icon={<IconRefresh />} onClick={loadData}>刷新</Button>
            <Button type="primary" icon={<IconPlus />} onClick={() => setVisible(true)}>资产入库</Button>
          </Space>
        </div>

        <Tabs defaultActiveTab="items">
          <TabPane key="items" title="资产列表">
            <Table rowKey="id" loading={loading} columns={columns} data={list} pagination={{ pageSize: 10 }} />
          </TabPane>
        </Tabs>
      </Card>

      <Modal title="资产入库" visible={visible} onOk={handleCreate} onCancel={() => setVisible(false)} style={{ width: 620 }}>
        <Form form={form} layout="vertical" initialValues={{ status: 'idle' }}>
          <FormItem label="资产编号" field="assetNo" rules={[{ required: true, message: '请输入资产编号' }]}>
            <Input placeholder="例如：LX-202601-001" />
          </FormItem>
          <FormItem label="资产名称" field="name" rules={[{ required: true, message: '请输入资产名称' }]}>
            <Input placeholder="例如：MacBook Pro" />
          </FormItem>
          <FormItem label="资产分类" field="categoryId" rules={[{ required: true, message: '请选择资产分类' }]}>
            <Select placeholder="请选择资产分类">
              {categories.map((category) => <Option key={category.id} value={category.id}>{category.name}</Option>)}
            </Select>
          </FormItem>
          <FormItem label="品牌" field="brand"><Input /></FormItem>
          <FormItem label="型号" field="model"><Input /></FormItem>
          <FormItem label="序列号" field="serialNo"><Input /></FormItem>
          <FormItem label="采购日期" field="purchaseDate"><DatePicker style={{ width: '100%' }} /></FormItem>
          <FormItem label="采购金额" field="purchaseAmount"><InputNumber min={0} style={{ width: '100%' }} /></FormItem>
          <FormItem label="存放位置" field="location"><Input /></FormItem>
          <FormItem label="备注" field="remark"><Input.TextArea rows={3} /></FormItem>
        </Form>
      </Modal>

      <Modal title="资产领用" visible={assignVisible} onOk={handleAssign} onCancel={() => setAssignVisible(false)} style={{ width: 520 }}>
        <Form form={assignForm} layout="vertical">
          <FormItem label="资产">
            <Input value={selectedAsset ? `${selectedAsset.assetNo} - ${selectedAsset.name}` : ''} disabled />
          </FormItem>
          <FormItem label="领用员工" field="employeeId" rules={[{ required: true, message: '请选择领用员工' }]}>
            <Select placeholder="请选择员工" showSearch>
              {employees.map((employee) => (
                <Option key={employee.id} value={employee.id}>
                  {employee.realName}（{employee.employeeNo}）
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="备注" field="note">
            <Input.TextArea rows={3} placeholder="领用说明" />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default AssetItemsPage
