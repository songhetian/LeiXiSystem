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
  Card,
  Spin,
} from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getPositions,
  createPosition,
  updatePosition,
  deletePosition,
  getDepartmentTree,
} from '@/api/organization'
import type { Position, Department } from '@/api/organization'
import { FilterBar, TableHeader, ActionButtons } from '@/components'
import { useCrudModal } from '@/hooks/useCrudModal'
import styles from './position.module.css'
const FormItem = Form.Item
const Option = Select.Option

function PositionPage() {
  const [data, setData] = useState<Position[]>([])
  const [deptOptions, setDeptOptions] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
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

  const { visible, editingId, saving, openCreate, openEdit, close, handleOk } = useCrudModal<Position>({
    form,
    initialValues: { status: 'active', sortOrder: 0 },
    mapRecordToForm: (record) => ({
      name: record.name,
      departmentId: record.departmentId,
      description: record.description,
      requirements: record.requirements,
      responsibilities: record.responsibilities,
      salaryMin: record.salaryMin,
      salaryMax: record.salaryMax,
      sortOrder: record.sortOrder ?? 0,
      status: record.status,
    }),
    onSubmit: async (values, id) => {
      if (id) {
        await updatePosition(id, values)
        Message.success('修改成功')
      } else {
        await createPosition(values)
        Message.success('新增成功')
      }
    },
    onSuccess: () => loadData(pagination.current, pagination.pageSize),
  })

  const columns: TableProps<Position>['columns'] = [
    { title: '岗位名称', dataIndex: 'name', width: 150 },
    { title: '所属部门', dataIndex: 'departmentName', width: 120, render: (v) => v || '-' },
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
        <ActionButtons
          onEdit={() => openEdit(record)}
          onDelete={() => handleDelete(record.id)}
          deleteContent="确定要删除该岗位吗？"
        />
      ),
    },
  ]

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

  const handleDelete = async (id: number) => {
    try {
      await deletePosition(id)
      Message.success('删除成功')
      loadData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  return (
    <div className={styles['position-page']}>
      <Card bordered={false} className={styles['position-page__card']}>
        <PageHeader title="岗位管理" description="管理系统中的岗位信息，包括岗位名称、所属部门、薪资范围等。" extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>新增岗位</Button>} />
      </Card>

      <Card bordered={false} className={styles['position-page__card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="岗位名称">
                <Input className={styles['position-page__search-input']} placeholder="请输入岗位名称" value={searchText} onChange={setSearchText} allowClear />
              </FormItem>
              <FormItem label="部门">
                <Select className={styles['position-page__dept-select']} placeholder="请选择部门" value={searchDept} onChange={setSearchDept} allowClear>
                  {flatDepts.map((d) => (
                    <Option key={d.id} value={d.id}>{'　'.repeat(d.depth)}{d.name}</Option>
                  ))}
                </Select>
              </FormItem>
            </>
          }
          onSearch={() => loadData(1, pagination.pageSize)}
          onReset={() => { setSearchText(''); setSearchDept(undefined); loadData(1, pagination.pageSize) }}
        />
      </Card>

      <Card bordered={false}>
        <TableHeader title="岗位列表" total={pagination.total} totalText="个岗位" />

        <Spin loading={loading}>
          <Table columns={columns} data={data} rowKey="id" pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, sizeOptions: [10, 20, 50], onChange: (current, pageSize) => loadData(current, pageSize) }} />
        </Spin>
      </Card>

      <Modal focusLock title={editingId ? '编辑岗位' : '新增岗位'} visible={visible} onOk={handleOk} onCancel={close} confirmLoading={saving} className={styles['position-page__modal']}>
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
          <Space>
            <FormItem label="薪资范围" field="salaryMin">
              <Input type="number" placeholder="最低薪资" />
            </FormItem>
            <FormItem label="~" field="salaryMax">
              <Input type="number" placeholder="最高薪资" />
            </FormItem>
          </Space>
          <Space>
            <FormItem label="排序" field="sortOrder">
              <Input type="number" placeholder="数值越小越靠前" />
            </FormItem>
            <FormItem label="状态" field="status">
              <Select>
                <Option value="active">启用</Option>
                <Option value="inactive">停用</Option>
              </Select>
            </FormItem>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default PositionPage
