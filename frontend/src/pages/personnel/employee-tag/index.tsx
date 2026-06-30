import { useState, useCallback, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  InputNumber,
  Message,
  Tag,
  Popconfirm,
  Grid,
  Drawer,
  Transfer,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconDelete,
  IconUser,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getEmployeeTags,
  createEmployeeTag,
  updateEmployeeTag,
  deleteEmployeeTag,
  getTagEmployees,
  addEmployeesToTag,
  removeEmployeeFromTag,
  type EmployeeTag,
  type EmployeeTagAssignment,
} from '@/api/employee-tag'
import { getEmployees, type Employee } from '@/api/personnel'
import './index.css'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TextArea = Input.TextArea

const COLOR_OPTIONS = [
  '#165DFF',
  '#0FC6C2',
  '#14C9C9',
  '#00B42A',
  '#722ED1',
  '#F77234',
  '#FF7D00',
  '#F53F3F',
  '#F7BA1E',
  '#86909C',
]

function EmployeeTagPage() {
  const [loading, setLoading] = useState(false)
  const [tags, setTags] = useState<EmployeeTag[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  const [modalVisible, setModalVisible] = useState(false)
  const [editingTag, setEditingTag] = useState<EmployeeTag | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const [employeeDrawerVisible, setEmployeeDrawerVisible] = useState(false)
  const [currentTag, setCurrentTag] = useState<EmployeeTag | null>(null)
  const [tagEmployees, setTagEmployees] = useState<EmployeeTagAssignment[]>([])
  const [tagEmployeesLoading, setTagEmployeesLoading] = useState(false)
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [allEmployeesLoading, setAllEmployeesLoading] = useState(false)
  const [employeeKeyword, setEmployeeKeyword] = useState('')

  const fetchTags = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEmployeeTags({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: statusFilter,
      })
      if (res.code === 0) {
        setTags(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, keyword, statusFilter])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const handleCreate = () => {
    setEditingTag(null)
    form.resetFields()
    form.setFieldsValue({
      color: COLOR_OPTIONS[0],
      sortOrder: 0,
      status: 'active',
    })
    setModalVisible(true)
  }

  const handleEdit = (tag: EmployeeTag) => {
    setEditingTag(tag)
    form.setFieldsValue({
      name: tag.name,
      color: tag.color || COLOR_OPTIONS[0],
      description: tag.description,
      sortOrder: tag.sortOrder,
      status: tag.status,
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      setSaving(true)
      if (editingTag) {
        await updateEmployeeTag(editingTag.id, values)
        Message.success('更新成功')
      } else {
        await createEmployeeTag(values)
        Message.success('创建成功')
      }
      setModalVisible(false)
      fetchTags()
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tag: EmployeeTag) => {
    try {
      await deleteEmployeeTag(tag.id)
      Message.success('删除成功')
      fetchTags()
    } catch {
    }
  }

  const handleSearch = () => {
    setPage(1)
    fetchTags()
  }

  const handleReset = () => {
    setKeyword('')
    setStatusFilter(undefined)
    setPage(1)
  }

  const handleViewEmployees = async (tag: EmployeeTag) => {
    setCurrentTag(tag)
    setEmployeeDrawerVisible(true)
    setEmployeeKeyword('')
    await loadTagEmployees(tag.id)
    await loadAllEmployees()
  }

  const loadTagEmployees = async (tagId: number) => {
    setTagEmployeesLoading(true)
    try {
      const res = await getTagEmployees(tagId, { pageSize: 1000 })
      if (res.code === 0) {
        setTagEmployees(res.data.list || [])
      }
    } finally {
      setTagEmployeesLoading(false)
    }
  }

  const loadAllEmployees = async () => {
    setAllEmployeesLoading(true)
    try {
      const res = await getEmployees({ pageSize: 1000, status: 'formal,probation,contract' })
      if (res.code === 0) {
        setAllEmployees(res.data.list || [])
      }
    } finally {
      setAllEmployeesLoading(false)
    }
  }

  const handleRemoveEmployee = async (employeeId: number) => {
    if (!currentTag) return
    try {
      await removeEmployeeFromTag(currentTag.id, employeeId)
      Message.success('移除成功')
      loadTagEmployees(currentTag.id)
      fetchTags()
    } catch {
    }
  }

  const handleAddEmployees = (newTargetKeys: string[]) => {
    if (!currentTag) return
    const currentEmployeeIds = tagEmployees.map((item) => String(item.employeeId))
    const newKeys = newTargetKeys.filter((key) => !currentEmployeeIds.includes(key))
    if (newKeys.length === 0) return
    const employeeIds = newKeys.map(Number)
    addEmployeesToTag(currentTag.id, employeeIds)
      .then(() => {
        Message.success('添加成功')
        loadTagEmployees(currentTag.id)
        fetchTags()
      })
      .catch(() => {
      })
  }

  const transferDataSource = allEmployees.map((emp) => ({
    key: String(emp.id),
    value: `${emp.realName} (${emp.employeeNo})`,
  }))

  const targetKeys = tagEmployees.map((item) => String(item.employeeId))

  const columns: TableProps<EmployeeTag>['columns'] = [
    {
      title: '标签名称',
      dataIndex: 'name',
      render: (val, record) => (
        <Space>
          <Tag color={record.color}>{val}</Tag>
        </Space>
      ),
    },
    {
      title: '颜色',
      dataIndex: 'color',
      width: 100,
      render: (val) => (
        <Space>
          <span
            style={{
              display: 'inline-block',
              width: 16,
              height: 16,
              borderRadius: 2,
              backgroundColor: val || '#ccc',
            }}
          />
          <span className="employee-tag__text-small-muted">{val || '-'}</span>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (val) => val || '-',
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 80,
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
      title: '员工数量',
      dataIndex: 'employeeCount',
      width: 100,
      render: (val, record) => (
        <Button
          type="text"
          size="small"
          icon={<IconUser />}
          onClick={() => handleViewEmployees(record)}
        >
          {val || 0} 人
        </Button>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
    },
    {
      title: '操作',
      width: 160,
      render: (_: any, record) => (
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
            content={`确定要删除标签「${record.name}」吗？`}
            onOk={() => handleDelete(record)}
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

  const employeeColumns: TableProps<EmployeeTagAssignment>['columns'] = [
    {
      title: '员工姓名',
      dataIndex: 'employee',
      width: 120,
      render: (val, record) => val?.name || record.employeeId,
    },
    {
      title: '工号',
      dataIndex: 'employee',
      width: 120,
      render: (val) => val?.employeeNo || '-',
    },
    {
      title: '部门',
      dataIndex: 'employee',
      render: (val) => val?.department?.name || '-',
    },
    {
      title: '职位',
      dataIndex: 'employee',
      render: (val) => val?.position?.name || '-',
    },
    {
      title: '操作',
      width: 80,
      render: (_: any, record) => (
        <Button
          type="text"
          size="small"
          status="danger"
          onClick={() => handleRemoveEmployee(record.employeeId)}
        >
          移除
        </Button>
      ),
    },
  ]

  return (
    <div className="employee-tag">
      <Card bordered={false} className="employee-tag__search-card">
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              className="employee-tag__search-input"
              placeholder="请输入标签名称"
              value={keyword}
              onChange={setKeyword}
              allowClear
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              className="employee-tag__status-select"
              placeholder="请选择状态"
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val)
                setPage(1)
              }}
              allowClear
            >
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
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
        <div className="employee-tag__table-header">
          <div>
            <span className="employee-tag__table-title">标签列表</span>
            <Tag color="blue" className="employee-tag__total-tag">
              共 {total} 个标签
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            新建标签
          </Button>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={tags}
          pagination={{
            total,
            current: page,
            pageSize,
            sizeOptions: [10, 20, 50],
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal
        title={editingTag ? '编辑标签' : '新建标签'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={saving}
        className="employee-tag__modal--520"
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="标签名称"
                field="name"
                rules={[{ required: true, message: '请输入标签名称' }]}
              >
                <Input placeholder="请输入标签名称" maxLength={50} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="排序" field="sortOrder" initialValue={0}>
                <InputNumber className="employee-tag__date-picker-full" min={0} max={9999} />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="标签颜色" field="color">
            <div className="employee-tag__color-picker">
              {COLOR_OPTIONS.map((color) => (
                <div className={`employee-tag__color-swatch ${form.getFieldsValue().color === color ? 'employee-tag__color-option--active' : ''}`}
                  onClick={() => form.setFieldsValue({ color })}
                />
              ))}
            </div>
          </FormItem>
          <FormItem label="标签描述" field="description">
            <TextArea placeholder="请输入标签描述" rows={3} maxLength={200} />
          </FormItem>
          <FormItem label="状态" field="status" initialValue="active">
            <Select className="employee-tag__select--150">
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </FormItem>
        </Form>
      </Modal>

      <Drawer
        title={currentTag ? `标签员工 - ${currentTag.name}` : '标签员工'}
        visible={employeeDrawerVisible}
        onCancel={() => setEmployeeDrawerVisible(false)}
        width={900}
        footer={null}
      >
        <div className="employee-tag__employee-section">
          <div className="employee-tag__section-title">添加员工</div>
          <Input
            className="employee-tag__employee-search"
            placeholder="搜索员工姓名或工号"
            value={employeeKeyword}
            onChange={setEmployeeKeyword}
            allowClear
          />
          <Transfer
            dataSource={transferDataSource.filter((item) =>
              item.value.toLowerCase().includes(employeeKeyword.toLowerCase())
            )}
            targetKeys={targetKeys}
            onChange={handleAddEmployees}
            listStyle={{ width: '100%', height: 280 }}
            titleTexts={['可选员工', '已选员工']}
          />
        </div>

        <div className="employee-tag__employee-section">
          <div className="employee-tag__section-title">
            已添加员工 ({tagEmployees.length})
          </div>
          <Table
            rowKey="id"
            loading={tagEmployeesLoading}
            columns={employeeColumns}
            data={tagEmployees}
            pagination={false}
            size="small"
          />
        </div>
      </Drawer>
    </div>
  )
}

export default EmployeeTagPage
