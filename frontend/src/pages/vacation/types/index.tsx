import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Input,
  Space,
  Modal,
  Form,
  Message,
  Tag,
  Popconfirm,
  Card,
  Grid,
  Switch,
  Select,
  Spin,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconDelete,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getVacationTypes,
  createVacationType,
  updateVacationType,
  deleteVacationType,
} from '@/api/vacation'
import type { VacationType } from '@/api/vacation'
import './types.css'

const { Row, Col } = Grid
const Option = Select.Option
const FormItem = Form.Item

function Types() {
  const [data, setData] = useState<VacationType[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [filteredData, setFilteredData] = useState<VacationType[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getVacationTypes()
      setData(res.data)
      setFilteredData(res.data)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const columns: TableProps<VacationType>['columns'] = [
    {
      title: '假期名称',
      dataIndex: 'name',
      width: 120,
    },
    {
      title: '假期编码',
      dataIndex: 'code',
      width: 120,
      render: (value: string) => <Tag color="blue" className="vacation-types__code-tag">{value}</Tag>,
    },
    {
      title: '年度配额',
      width: 120,
      render: (_: unknown, record: VacationType) => (
        <span>{record.totalDays} {record.unit === 'day' ? '天' : '小时'}</span>
      ),
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
      render: (value: string) => (
        <Tag>{value === 'day' ? '按天' : '按小时'}</Tag>
      ),
    },
    {
      title: '带薪',
      dataIndex: 'isPaid',
      width: 80,
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'orange'}>{value ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '可结转',
      dataIndex: 'isCarryOver',
      width: 90,
      render: (value: boolean) => (
        <Tag color={value ? 'blue' : 'gray'}>{value ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '结转天数',
      dataIndex: 'carryOverDays',
      width: 90,
      render: (value: number) => `${value}天`,
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
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: VacationType) => (
        <Space size="small">
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
            content="确定要删除该假期类型吗？"
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

  const handleEdit = (record: VacationType) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteVacationType(id)
      Message.success('删除成功')
      fetchData()
    } catch {
      // error handled by interceptor
    }
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      setSaving(true)
      if (editingId) {
        await updateVacationType(editingId, values)
        Message.success('修改成功')
      } else {
        await createVacationType(values)
        Message.success('新增成功')
      }
      setVisible(false)
      fetchData()
    } catch {
      // error handled by interceptor
    } finally {
      setSaving(false)
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
    <div className="vacation-types">
      <Card bordered={false} className="vacation-types__search-card">
        <Form layout="inline">
          <FormItem label="假期名称">
            <Input
              className="vacation-types__search-input"
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

      <Card bordered={false} className="vacation-types__table-card">
        <div className="vacation-types__table-header">
          <div>
            <span className="vacation-types__table-title">假期类型</span>
            <Tag color="blue" className="vacation-types__total-tag">
              共 {filteredData.length} 种
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增类型
          </Button>
        </div>

        <Spin loading={loading}>
          <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
        </Spin>
      </Card>

      <Modal
        title={editingId ? '编辑假期类型' : '新增假期类型'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        confirmLoading={saving}
        className="vacation-types__modal"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="假期名称"
                field="name"
                rules={[{ required: true, message: '请输入假期名称' }]}
              >
                <Input placeholder="请输入假期名称" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="假期编码"
                field="code"
                rules={[{ required: true, message: '请输入假期编码' }]}
              >
                <Input placeholder="请输入假期编码" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="年度配额" field="totalDays" initialValue={0}>
                <Input type="number" placeholder="请输入配额" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="计算单位" field="unit" initialValue="day">
                <Select placeholder="请选择">
                  <Option value="day">天</Option>
                  <Option value="hour">小时</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <FormItem label="是否带薪" field="isPaid" initialValue={true}>
                <Switch />
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="可结转下年" field="isCarryOver" initialValue={false}>
                <Switch />
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="状态" field="status" initialValue="active">
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <FormItem label="描述" field="description">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default Types
