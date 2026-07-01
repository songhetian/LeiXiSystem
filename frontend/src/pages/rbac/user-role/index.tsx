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
import { IconUser } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getEmployees } from '@/api/personnel'
import { getRoles, getUserRoles, assignUserRoles } from '@/api/rbac'
import type { Role } from '@/api/rbac'
import { PageHeader, FilterBar } from '@/components'
import styles from './style.module.css'
const FormItem = Form.Item
const Option = Select.Option

interface EmployeeItem {
  id: number
  employeeNo: string
  realName: string
  departmentName?: string
  positionName?: string
  status: string
}

function UserRolePage() {
  const [data, setData] = useState<EmployeeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [currentUser, setCurrentUser] = useState<EmployeeItem | null>(null)
  const [allRoles, setAllRoles] = useState<Role[]>([])
  const [selectedRoles, setSelectedRoles] = useState<number[]>([])
  const [searchText, setSearchText] = useState('')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getEmployees({ page, pageSize, keyword: searchText || undefined })
      setData(res.data.list || [])
      setPagination({ current: res.data.page || page, pageSize: res.data.pageSize || pageSize, total: res.data.total || 0 })
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const res = await getRoles({ page: 1, pageSize: 100 })
      setAllRoles(res.data.list)
    } catch {
      // error handled by interceptor
    }
  }

  useEffect(() => {
    fetchData()
    fetchRoles()
  }, [])

  const columns: TableProps<EmployeeItem>['columns'] = [
    { title: '工号', dataIndex: 'employeeNo', width: 120 },
    { title: '姓名', dataIndex: 'realName', width: 100 },
    { title: '部门', dataIndex: 'departmentName', width: 120 },
    { title: '岗位', dataIndex: 'positionName', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => (
        <Tag color={value === 'active' ? 'green' : 'gray'}>
          {value === 'active' ? '在职' : value === 'probation' ? '试用期' : value === 'deleted' ? '已删除' : value}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 120,
      render: (_: unknown, record: EmployeeItem) => (
        <Button type="text" size="small" icon={<IconUser />} onClick={() => handleAssign(record)}>
          分配角色
        </Button>
      ),
    },
  ]

  const handleAssign = async (record: EmployeeItem) => {
    setCurrentUser(record)
    try {
      const res = await getUserRoles(record.id)
      setSelectedRoles(res.data.assignedRoles || [])
    } catch {
      setSelectedRoles([])
    }
    setVisible(true)
  }

  const handleOk = async () => {
    if (!currentUser) return
    try {
      await assignUserRoles(currentUser.id, selectedRoles)
      Message.success('角色分配成功')
      setVisible(false)
    } catch {
      // error handled by interceptor
    }
  }

  return (
    <div className={styles['user-role']}>
      <Card bordered={false} className={styles['user-role__card']}>
        <PageHeader title="用户角色分配" description="为员工分配系统角色，影响其可访问的功能和数据范围。" />
      </Card>

      <Card bordered={false} className={styles['user-role__card']}>
        <FilterBar
          filters={
            <FormItem label="关键字">
              <Input className={styles['user-role__toolbar-input']} placeholder="姓名/工号" value={searchText} onChange={setSearchText} allowClear />
            </FormItem>
          }
          onSearch={() => fetchData(1, pagination.pageSize)}
          onReset={() => { setSearchText(''); fetchData(1, pagination.pageSize) }}
        />
      </Card>

      <Card bordered={false}>
        <Table loading={loading} columns={columns} data={data} rowKey="id" pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, onChange: (page, pageSize) => fetchData(page, pageSize) }} />
      </Card>

      <Modal focusLock title={`分配角色 - ${currentUser?.realName}`} visible={visible} onOk={handleOk} onCancel={() => setVisible(false)} className={styles['user-role__modal']}>
        <Spin loading={allRoles.length === 0}>
          <Form layout="vertical">
            <FormItem label="选择角色">
              <Select mode="multiple" className={styles['user-role__select-full']} value={selectedRoles.map(String)} onChange={(vals) => setSelectedRoles(vals.map((v: string) => parseInt(v)))} placeholder="请选择角色">
                {allRoles.map((r) => (
                  <Option key={r.id} value={String(r.id)}>{r.name}</Option>
                ))}
              </Select>
            </FormItem>
          </Form>
        </Spin>
      </Modal>
    </div>
  )
}

export default UserRolePage
