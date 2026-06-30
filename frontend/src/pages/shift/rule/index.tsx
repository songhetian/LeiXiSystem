import { useState, useEffect } from 'react'
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
import { getDepartmentsList, type Department } from '@/api/organization'
import './style.css'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

const STORAGE_KEY = 'shift_rules'

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

function loadRules(): ShiftRule[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveRules(rules: ShiftRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

function Rule() {
  const [data, setData] = useState<ShiftRule[]>([])
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [filteredData, setFilteredData] = useState<ShiftRule[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    const rules = loadRules()
    setData(rules)
    setFilteredData(rules)
    getDepartmentsList().then((res: any) => {
      setDepartments(res.data?.list || [])
    }).catch(() => {
      // error handled by interceptor
    })
  }, [])

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
      render: (_: unknown, record: ShiftRule) => (
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
    const newData = data.filter((item) => item.id !== id)
    setData(newData)
    setFilteredData(newData)
    saveRules(newData)
    Message.success('删除成功')
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      let newData: ShiftRule[]
      if (editingId) {
        newData = data.map((item) => (item.id === editingId ? { ...item, ...values } : item))
        Message.success('修改成功')
      } else {
        const newId = data.length > 0 ? Math.max(...data.map((d) => d.id)) + 1 : 1
        const newRecord: ShiftRule = {
          id: newId,
          createTime: new Date().toISOString().split('T')[0],
          ...values,
        }
        newData = [...data, newRecord]
        Message.success('新增成功')
      }
      setData(newData)
      setFilteredData(newData)
      saveRules(newData)
      setVisible(false)
    } catch {
      // validation error
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
    <div className="shift-rule">
      <Card bordered={false} className="shift-rule__toolbar">
        <Form layout="inline">
          <FormItem label="规则名称">
            <Input
              className="shift-rule__toolbar-input"
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
        <div className="shift-rule__header">
          <div>
            <span className="shift-rule__title">班次规则</span>
            <Tag color="blue" className="shift-rule__tag">
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
        className="shift-rule__modal"
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
            <Select mode="multiple" placeholder="请选择适用部门" className="shift-rule__select-full">
              {departments.map((dept) => (
                <Option key={dept.id} value={dept.name}>
                  {dept.name}
                </Option>
              ))}
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
