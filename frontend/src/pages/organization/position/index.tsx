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
  getPositions,
  createPosition,
  updatePosition,
  deletePosition,
  getDepartmentTree,
} from '@/api/organization'
import type { Position, Department } from '@/api/organization'
import './position.css'

const FormItem = Form.Item
const Option = Select.Option

function PositionPage() {
  const [data, setData] = useState<Position[]>([])
  const [deptOptions, setDeptOptions] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const loadData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getPositions({
        page,
        pageSize,
        keyword: searchText || undefined,
        departmentId: searchDept ? Number(searchDept) : undefined,
      })
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, current: page, pageSize, total: res.data.total }))
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const loadDeptOptions = async () => {
    const res = await getDepartmentTree()
    setDeptOptions(res.data || [])
  }

  useEffect(() => {
    loadData(pagination.current, pagination.pageSize)
    loadDeptOptions()
  }, [])

  const flattenDepts = (depts: Department[], depth = 0): Array<{ id: number; name: string; depth: number }> => {
    const result: Array<{ id: number; name: string; depth: number }> = []
    for (const dept of depts) {
      result.push({ id: dept.id, name: dept.name, depth })
      if (dept.children?.length) {
        result.push(...flattenDepts(dept.children, depth + 1))
      }
    }
    return result
  }

  const flatDepts = flattenDepts(deptOptions)

  const columns: TableProps<Position>['columns'] = [
    { title: '岗位名称', dataIndex: 'name', width: 150 },
    {
      title: '所属部门',
      dataIndex: 'departmentName',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: '薪资范围',
      width: 160,
      render: (_: unknown, record: Position) => {
        if (!record.salaryMin && !record.salaryMax) return '-'
        return `${record.salaryMin ?? '-'} ~ ${record.salaryMax ?? '-'}`
      },
    },
    { title: '排序', dataIndex: 'sortOrder', width: 80, render: (v) => v ?? 0 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => (
        <Tag color={value === 'active' ? 'green' : 'gray'}>
          {value === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: Position) => (
        <Space size="small">
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除" content="确定要删除该岗位吗？" onOk={() => handleDelete(record.id)}>
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const handleEdit = (record: Position) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      departmentId: record.departmentId,
      description: record.description,
      requirements: record.requirements,
      responsibilities: record.responsibilities,
      salaryMin: record.salaryMin,
      salaryMax: record.salaryMax,
      sortOrder: record.sortOrder ?? 0,
      status: record.status,
    })
    setVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await deletePosition(id)
      Message.success('删除成功')
      loadData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      setSaving(true)
      if (editingId) {
        await updatePosition(editingId, values)
        Message.success('修改成功')
      } else {
        await createPosition(values)
        Message.success('新增成功')
      }
      setVisible(false)
      loadData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setSaving(false)
    }
  }

  const handleSearch = () => loadData(1, pagination.pageSize)

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
    loadData(1, pagination.pageSize)
  }

  const handlePageChange = (current: number, pageSize: number) => loadData(current, pageSize)

  return (
    <div className="org-position-page">
      <Card bordered={false} className="org-position-page__search-card">
        <Form layout="inline">
          <FormItem label="岗位名称">
            <Input
              className="org-position-page__search-input"
              placeholder="请输入岗位名称"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="部门">
            <Select
              className="org-position-page__dept-select"
              placeholder="请选择部门"
              value={searchDept}
              onChange={(val) => { setSearchDept(val); loadData(1, pagination.pageSize) }}
              allowClear
            >
              {flatDepts.map((d) => (
                <Option key={d.id} value={d.id}>{'　'.repeat(d.depth)}{d.name}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>搜索</Button>
              <Button icon={<IconRefresh />} onClick={handleReset}>重置</Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <div className="org-position-page__table-header">
          <div>
            <span className="org-position-page__table-title">岗位列表</span>
            <Tag color="blue" className="org-position-page__total-tag">共 {pagination.total} 个岗位</Tag>
          </div>
          <Button
            type="primary"
            icon={<IconPlus />}
            onClick={() => { setEditingId(null); form.resetFields(); form.setFieldsValue({ status: 'active', sortOrder: 0 }); setVisible(true) }}
          >
            新增岗位
          </Button>
        </div>

        <Spin loading={loading}>
          <Table
            columns={columns}
            data={data}
            rowKey="id"
            pagination={{ ...pagination, sizeOptions: [10, 20, 50], onChange: handlePageChange }}
          />
        </Spin>
      </Card>

      <Modal
        title={editingId ? '编辑岗位' : '新增岗位'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        confirmLoading={saving}
        className="org-position-page__modal"
      >
        <Form form={form} layout="vertical">
          <FormItem label="岗位名称" field="name" rules={[{ required: true, message: '请输入岗位名称' }]}>
            <Input placeholder="请输入岗位名称" />
          </FormItem>
          <FormItem label="所属部门" field="departmentId" rules={[{ required: true, message: '请选择部门' }]}>
            <Select placeholder="请选择部门">
              {flatDepts.map((d) => (
                <Option key={d.id} value={d.id}>{'　'.repeat(d.depth)}{d.name}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="岗位描述" field="description">
            <Input.TextArea placeholder="请输入岗位描述" rows={2} />
          </FormItem>
          <FormItem label="任职要求" field="requirements">
            <Input.TextArea placeholder="请输入任职要求" rows={2} />
          </FormItem>
          <FormItem label="岗位职责" field="responsibilities">
            <Input.TextArea placeholder="请输入岗位职责" rows={2} />
          </FormItem>
          <FormItem label="最低薪资" field="salaryMin">
            <Input type="number" placeholder="最低薪资" />
          </FormItem>
          <FormItem label="最高薪资" field="salaryMax">
            <Input type="number" placeholder="最高薪资" />
          </FormItem>
          <FormItem label="排序" field="sortOrder" initialValue={0}>
            <Input type="number" placeholder="数值越小越靠前" />
          </FormItem>
          <FormItem label="状态" field="status" initialValue="active">
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default PositionPage
