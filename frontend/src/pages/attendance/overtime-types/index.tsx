import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Message,
  Tag,
  Grid,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconDelete,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getOvertimeTypes,
  createOvertimeType,
  updateOvertimeType,
  deleteOvertimeType,
  type OvertimeType as OvertimeTypeType,
} from '@/api/attendance-overtime-type'
import './overtime-types.css'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TextArea = Input.TextArea

function OvertimeTypesPage() {
  const [loading, setLoading] = useState(false)
  const [types, setTypes] = useState<OvertimeTypeType[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [modalVisible, setModalVisible] = useState(false)
  const [editingType, setEditingType] = useState<OvertimeTypeType | null>(null)
  const [form] = Form.useForm()

  const fetchTypes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getOvertimeTypes({ page, pageSize })
      if (res.code === 0) {
        setTypes(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchTypes()
  }, [fetchTypes])

  const handleCreate = () => {
    setEditingType(null)
    form.resetFields()
    form.setFieldsValue({
      payRate: 1.5,
      minMinutes: 30,
      requireApproval: true,
      status: 'active',
      sortOrder: 0,
    })
    setModalVisible(true)
  }

  const handleEdit = (item: OvertimeTypeType) => {
    setEditingType(item)
    form.setFieldsValue({
      name: item.name,
      code: item.code,
      description: item.description,
      payRate: item.payRate,
      minMinutes: item.minMinutes,
      maxMinutes: item.maxMinutes,
      requireApproval: item.requireApproval,
      status: item.status,
      sortOrder: item.sortOrder,
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      if (editingType) {
        await updateOvertimeType(editingType.id, values)
        Message.success('更新成功')
      } else {
        await createOvertimeType(values)
        Message.success('创建成功')
      }
      setModalVisible(false)
      fetchTypes()
    } catch {
      // handled
    }
  }

  const handleDelete = async (item: OvertimeTypeType) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除加班类型「${item.name}」吗？`,
      onOk: async () => {
        await deleteOvertimeType(item.id)
        Message.success('删除成功')
        fetchTypes()
      },
    })
  }

  const columns: TableProps<OvertimeTypeType>['columns'] = [
    {
      title: '类型名称',
      dataIndex: 'name',
      render: (val) => <span className="overtime-types__text-bold">{val}</span>,
    },
    {
      title: '类型编码',
      dataIndex: 'code',
      width: 120,
      render: (val) => <Tag color="arcoblue">{val}</Tag>,
    },
    {
      title: '薪资倍率',
      dataIndex: 'payRate',
      width: 100,
      render: (val: number) => `${val}x`,
    },
    {
      title: '最小时长(分钟)',
      dataIndex: 'minMinutes',
      width: 120,
    },
    {
      title: '最大时长(分钟)',
      dataIndex: 'maxMinutes',
      width: 120,
      render: (val?: number) => val || '-',
    },
    {
      title: '需审批',
      dataIndex: 'requireApproval',
      width: 80,
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'gray'}>
          {val ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (val: string) => (
        <Tag color={val === 'active' ? 'green' : 'gray'}>
          {val === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 160,
      render: (_: any, record) => (
        <Space>
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="overtime-types">
      <Card
        bordered={false}
        title="加班类型配置"
        extra={
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            新建类型
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={types}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal
        title={editingType ? '编辑加班类型' : '新建加班类型'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        className="overtime-types__modal"
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="类型名称" field="name" rules={[{ required: true, message: '请输入类型名称' }]}>
                <Input placeholder="请输入类型名称" maxLength={100} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="类型编码" field="code" rules={[{ required: true, message: '请输入类型编码' }]}>
                <Input placeholder="如 workday_overtime" maxLength={50} />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="类型说明" field="description">
            <TextArea placeholder="请输入类型说明" rows={2} maxLength={500} />
          </FormItem>
          <Row gutter={16}>
            <Col span={8}>
              <FormItem label="薪资倍率" field="payRate" rules={[{ required: true, message: '请输入薪资倍率' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={10}
                  step={0.1}
                  placeholder="如 1.5"
                />
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="最小时长(分钟)" field="minMinutes">
                <InputNumber className="overtime-types__input-full" min={0} max={1440} />
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="最大时长(分钟)" field="maxMinutes">
                <InputNumber className="overtime-types__input-full" min={0} max={1440} placeholder="可选" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="需要审批" field="requireApproval" triggerPropName="checked">
                <Switch />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="排序" field="sortOrder">
                <InputNumber className="overtime-types__input-full" min={0} max={9999} defaultValue={0} />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="状态" field="status">
            <Select className="overtime-types__select-small" defaultValue="active">
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default OvertimeTypesPage
