import { useState } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  Message,
  Tag,
  Popconfirm,
  Card,
  Grid,
  Switch,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconDelete,
  IconSettings,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface ShiftRule {
  id: number
  name: string
  code: string
  applicableDept: string[]
  applicablePosition: string[]
  effectiveDate: string
  workDayRule: string
  restDayRule: string
  isAutoAssign: boolean
  status: 'active' | 'inactive'
  createTime: string
}

const mockData: ShiftRule[] = [
  { id: 1, name: '技术部班次规则', code: 'TECH_RULE', applicableDept: ['技术部'], applicablePosition: ['全部'], effectiveDate: '2024-01-01', workDayRule: '标准早班', restDayRule: '双休', isAutoAssign: true, status: 'active', createTime: '2024-01-01' },
  { id: 2, name: '客服部轮班规则', code: 'SERVICE_ROTATE', applicableDept: ['客服部'], applicablePosition: ['客服专员'], effectiveDate: '2024-02-01', workDayRule: '早晚轮班', restDayRule: '调休', isAutoAssign: true, status: 'active', createTime: '2024-01-20' },
  { id: 3, name: '行政班规则', code: 'ADMIN_RULE', applicableDept: ['人事部', '财务部', '总经办'], applicablePosition: ['全部'], effectiveDate: '2024-01-01', workDayRule: '标准早班', restDayRule: '双休', isAutoAssign: false, status: 'active', createTime: '2024-01-01' },
  { id: 4, name: '运营部弹性规则', code: 'OPS_FLEX', applicableDept: ['运营部'], applicablePosition: ['全部'], effectiveDate: '2024-03-01', workDayRule: '弹性工作制', restDayRule: '大小周', isAutoAssign: true, status: 'inactive', createTime: '2024-02-25' },
]

function Rule() {
  const [data, setData] = useState<ShiftRule[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [filteredData, setFilteredData] = useState<ShiftRule[]>(mockData)

  const columns: TableProps<ShiftRule>['columns'] = [
    {
      title: '规则名称',
      dataIndex: 'name',
      width: 180,
    },
    {
      title: '规则编码',
      dataIndex: 'code',
      width: 140,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '适用部门',
      dataIndex: 'applicableDept',
      width: 180,
      render: (value: string[]) => (
        <Space size={4} wrap>
          {value.map((dept) => (
            <Tag key={dept} size="small">{dept}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '工作日规则',
      dataIndex: 'workDayRule',
      width: 120,
    },
    {
      title: '休息日规则',
      dataIndex: 'restDayRule',
      width: 120,
    },
    {
      title: '自动分配',
      dataIndex: 'isAutoAssign',
      width: 90,
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'gray'}>{value ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '生效日期',
      dataIndex: 'effectiveDate',
      width: 110,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value: string) => (
        <Tag color={value === 'active' ? 'green' : 'gray'}>
          {value === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: ShiftRule) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconSettings />}
          >
            配置
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            content="确定要删除该规则吗？"
            onOk={() => handleDelete(record.id)}
          >
            <Button
              type="text"
              size="small"
              status="danger"
              icon={<IconDelete />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    setEditingId(null)
    form.resetFields()
    setVisible(true)
  }

  const handleEdit = (record: ShiftRule) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setVisible(true)
  }

  const handleDelete = (id: number) => {
    setData(data.filter((item) => item.id !== id))
    setFilteredData(filteredData.filter((item) => item.id !== id))
    Message.success('删除成功')
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      if (editingId) {
        setData(data.map((item) => (item.id === editingId ? { ...item, ...values } : item)))
        setFilteredData(filteredData.map((item) => (item.id === editingId ? { ...item, ...values } : item)))
        Message.success('修改成功')
      } else {
        const newId = Math.max(...data.map((d) => d.id)) + 1
        const newRecord = {
          id: newId,
          createTime: new Date().toLocaleDateString(),
          ...values,
        } as ShiftRule
        setData([...data, newRecord])
        setFilteredData([...filteredData, newRecord])
        Message.success('新增成功')
      }
      setVisible(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSearch = () => {
    let result = data
    if (searchText) {
      result = result.filter(
        (item) =>
          item.name.includes(searchText) ||
          item.code.includes(searchText),
      )
    }
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setFilteredData(data)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="规则名称">
            <Input
              style={{ width: 200 }}
              placeholder="请输入名称/编码"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<IconRefresh />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>班次规则</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {filteredData.length} 条规则
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增规则
          </Button>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑规则' : '新增规则'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="规则名称"
                field="name"
                rules={[{ required: true, message: '请输入规则名称' }]}
              >
                <Input placeholder="请输入规则名称" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="规则编码"
                field="code"
                rules={[{ required: true, message: '请输入规则编码' }]}
              >
                <Input placeholder="请输入规则编码" />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="适用部门" field="applicableDept">
            <Select mode="multiple" placeholder="请选择适用部门" style={{ width: '100%' }}>
              <Option value="总经办">总经办</Option>
              <Option value="技术部">技术部</Option>
              <Option value="产品部">产品部</Option>
              <Option value="市场部">市场部</Option>
              <Option value="人事部">人事部</Option>
              <Option value="财务部">财务部</Option>
              <Option value="运营部">运营部</Option>
            </Select>
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="工作日规则" field="workDayRule">
                <Select placeholder="请选择">
                  <Option value="标准早班">标准早班</Option>
                  <Option value="早晚轮班">早晚轮班</Option>
                  <Option value="弹性工作制">弹性工作制</Option>
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="休息日规则" field="restDayRule">
                <Select placeholder="请选择">
                  <Option value="双休">双休</Option>
                  <Option value="单休">单休</Option>
                  <Option value="大小周">大小周</Option>
                  <Option value="调休">调休</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="自动分配班次" field="isAutoAssign" initialValue={false}>
                <Switch />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="状态" field="status" initialValue="active">
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default Rule
