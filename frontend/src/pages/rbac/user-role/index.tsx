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
  Card,
  Grid,
  Transfer,
} from '@arco-design/web-react'
import {
  IconSearch,
  IconRefresh,
  IconUser,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface UserRole {
  id: number
  username: string
  name: string
  employeeNo: string
  department: string
  roles: string[]
  status: 'active' | 'inactive'
}

const mockData: UserRole[] = [
  { id: 1, username: 'admin', name: '管理员', employeeNo: 'EMP000', department: '总经办', roles: ['SUPER_ADMIN', 'ADMIN'], status: 'active' },
  { id: 2, username: 'hr001', name: '张三', employeeNo: 'EMP001', department: '技术部', roles: ['EMPLOYEE'], status: 'active' },
  { id: 3, username: 'hr002', name: '李四', employeeNo: 'EMP002', department: '产品部', roles: ['EMPLOYEE'], status: 'active' },
  { id: 4, username: 'hr003', name: '王五', employeeNo: 'EMP003', department: '市场部', roles: ['EMPLOYEE'], status: 'active' },
  { id: 5, username: 'hr004', name: '赵六', employeeNo: 'EMP004', department: '技术部', roles: ['EMPLOYEE'], status: 'active' },
  { id: 6, username: 'hr005', name: '钱七', employeeNo: 'EMP005', department: '人事部', roles: ['HR_STAFF'], status: 'active' },
  { id: 7, username: 'hr006', name: '孙八', employeeNo: 'EMP006', department: '财务部', roles: ['FINANCE'], status: 'inactive' },
  { id: 8, username: 'hr007', name: '吴十', employeeNo: 'EMP008', department: '运营部', roles: ['EMPLOYEE'], status: 'active' },
]

const allRoles = [
  { key: 'SUPER_ADMIN', name: '超级管理员' },
  { key: 'ADMIN', name: '系统管理员' },
  { key: 'HR_MANAGER', name: '人事主管' },
  { key: 'HR_STAFF', name: '人事专员' },
  { key: 'DEPT_MANAGER', name: '部门经理' },
  { key: 'EMPLOYEE', name: '普通员工' },
  { key: 'FINANCE', name: '财务人员' },
]

function UserRolePage() {
  const [data, setData] = useState<UserRole[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserRole | null>(null)
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<UserRole[]>(mockData)

  const columns: TableProps<UserRole>['columns'] = [
    {
      title: '用户名',
      dataIndex: 'username',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 100,
    },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 200,
      render: (value: string[]) => (
        <Space size={4}>
          {value.map((role) => (
            <Tag key={role} color="blue" size="small">
              {allRoles.find((r) => r.key === role)?.name || role}
            </Tag>
          ))}
        </Space>
      ),
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
      width: 120,
      render: (_: any, record: UserRole) => (
        <Button
          type="text"
          size="small"
          icon={<IconUser />}
          onClick={() => handleAssign(record)}
        >
          分配角色
        </Button>
      ),
    },
  ]

  const handleAssign = (record: UserRole) => {
    setCurrentUser(record)
    setTargetKeys(record.roles)
    setVisible(true)
  }

  const handleOk = () => {
    if (currentUser) {
      setData(data.map((item) => (item.id === currentUser.id ? { ...item, roles: targetKeys } : item)))
      setFilteredData(filteredData.map((item) => (item.id === currentUser.id ? { ...item, roles: targetKeys } : item)))
      Message.success('角色分配成功')
    }
    setVisible(false)
  }

  const handleSearch = () => {
    let result = data
    if (searchText) {
      result = result.filter(
        (item) =>
          item.name.includes(searchText) ||
          item.username.includes(searchText) ||
          item.employeeNo.includes(searchText),
      )
    }
    if (searchDept) {
      result = result.filter((item) => item.department === searchDept)
    }
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
    setFilteredData(data)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              style={{ width: 180 }}
              placeholder="用户名/姓名/工号"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="部门">
            <Select
              style={{ width: 130 }}
              placeholder="请选择"
              value={searchDept}
              onChange={setSearchDept}
              allowClear
            >
              <Option value="总经办">总经办</Option>
              <Option value="技术部">技术部</Option>
              <Option value="产品部">产品部</Option>
              <Option value="市场部">市场部</Option>
              <Option value="人事部">人事部</Option>
              <Option value="财务部">财务部</Option>
              <Option value="运营部">运营部</Option>
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
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>用户列表</span>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            共 {filteredData.length} 人
          </Tag>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={`分配角色 - ${currentUser?.name}`}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        width={600}
      >
        <Transfer
          dataSource={allRoles}
          targetKeys={targetKeys}
          onChange={setTargetKeys as any}
          listStyle={{ width: 240, height: 300 }}
          render={(item) => item.name}
          titles={['可选角色', '已选角色']}
        />
      </Modal>
    </div>
  )
}

export default UserRolePage
