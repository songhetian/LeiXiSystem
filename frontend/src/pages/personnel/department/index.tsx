import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Modal,
  Form,
  Message,
  Tag,
  Card,
  Spin,
} from '@arco-design/web-react'
import {
  IconPlus,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getDepartmentsList,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentTree,
} from '@/api/organization'
import type { Department } from '@/api/organization'
import { FilterBar, TableHeader, ActionButtons } from '@/components'
import { useCrudModal } from '@/hooks/useCrudModal'
import styles from './department.module.css'
const FormItem = Form.Item
const Option = Select.Option

function DepartmentPage() {
  const [data, setData] = useState<Department[]>([])
  const [deptOptions, setDeptOptions] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getDepartmentsList({
        keyword: searchText || undefined,
        status: searchStatus,
      })
      setData(res.data)
      setPagination((prev) => ({ ...prev, total: res.data.length }))
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
    loadData()
    loadDeptOptions()
  }, [])

  const { visible, editingId, saving, openCreate, openEdit, close, handleOk } = useCrudModal<Department>({
    form,
    initialValues: { status: 'active', sortOrder: 0 },
    mapRecordToForm: (record) => ({
      name: record.name,
      parentId: record.parentId,
      description: record.description,
      managerId: record.managerId,
      sortOrder: record.sortOrder ?? 0,
      status: record.status,
    }),
    onSubmit: async (values, id) => {
      if (id) {
        await updateDepartment(id, values)
        Message.success('修改成功')
      } else {
        await createDepartment(values)
        Message.success('新增成功')
      }
    },
    onSuccess: () => {
      loadData()
      loadDeptOptions()
    },
  })

  const columns: TableProps<Department>['columns'] = [
    {
      title: '部门名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '上级部门',
      dataIndex: 'parentName',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: '部门负责人',
      dataIndex: 'managerName',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 80,
      render: (v) => v ?? 0,
    },
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
      render: (_: unknown, record: Department) => (
        <ActionButtons
          onEdit={() => openEdit(record)}
          onDelete={() => handleDelete(record.id)}
          deleteContent="确定要删除该部门吗？"
        />
      ),
    },
  ]

  const handleDelete = async (id: number) => {
    try {
      await deleteDepartment(id)
      Message.success('删除成功')
      loadData()
    } catch {
      // error handled by interceptor
    }
  }

  const handleSearch = () => {
    loadData()
  }

  const handleReset = () => {
    setSearchText('')
    setSearchStatus(undefined)
    loadData()
  }

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

  return (
    <div className={styles['department-page']}>
      <Card bordered={false} className={styles['department-page__search-card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="部门名称">
                <Input
                  className={styles['department-page__search-input']}
                  placeholder="请输入部门名称"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="状态">
                <Select
                  className={styles['department-page__status-select']}
                  placeholder="请选择状态"
                  value={searchStatus}
                  onChange={(val) => {
                    setSearchStatus(val)
                    loadData()
                  }}
                  allowClear
                >
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
        />
      </Card>

      <Card bordered={false}>
        <TableHeader
          title="部门列表"
          total={pagination.total}
          totalText="个部门"
          extra={
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={openCreate}
            >
              新增部门
            </Button>
          }
        />

        <Spin loading={loading}>
          <Table
            columns={columns}
            data={data}
            rowKey="id"
            pagination={{
              ...pagination,
              sizeOptions: [10, 20, 50],
              onChange: (current, pageSize) => {
                setPagination((prev) => ({ ...prev, current, pageSize }))
              },
            }}
          />
        </Spin>
      </Card>

      <Modal focusLock
        title={editingId ? '编辑部门' : '新增部门'}
        visible={visible}
        onOk={handleOk}
        onCancel={close}
        confirmLoading={saving}
        className={styles['department-page__modal']}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="部门名称"
            field="name"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </FormItem>
          <FormItem label="上级部门" field="parentId">
            <Select placeholder="请选择上级部门（可选）" allowClear>
              {flatDepts.map((d) => (
                <Option key={d.id} value={d.id}>
                  {'　'.repeat(d.depth)}{d.name}
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="部门负责人" field="managerId">
            <Input type="number" placeholder="负责人用户ID" />
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

export default DepartmentPage
