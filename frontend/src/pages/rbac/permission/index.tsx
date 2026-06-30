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
  Tree,
  Grid,
  Spin,
} from '@arco-design/web-react'
import {
  IconSearch,
  IconRefresh,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getPermissions } from '@/api/rbac'
import type { Permission } from '@/api/rbac'
import './style.css'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

const typeMap: Record<string, { text: string; color: string }> = {
  menu: { text: '菜单', color: 'blue' },
  button: { text: '按钮', color: 'green' },
  api: { text: '接口', color: 'orange' },
}

function PermissionPage() {
  const [data, setData] = useState<Permission[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>()
  const [showTree, setShowTree] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getPermissions()
      let list = res.data
      if (searchText) {
        list = list.filter(
          (item: any) =>
            item.name.includes(searchText) ||
            item.code.includes(searchText),
        )
      }
      if (searchType) {
        list = list.filter((item: any) => item.action === searchType)
      }
      setData(list)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns: TableProps<Permission>['columns'] = [
    {
      title: '权限名称',
      dataIndex: 'name',
      width: 180,
    },
    {
      title: '权限编码',
      dataIndex: 'code',
      width: 200,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '模块',
      dataIndex: 'module',
      width: 120,
    },
    {
      title: '资源',
      dataIndex: 'resource',
      width: 120,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 80,
    },
  ]

  const handleSearch = () => {
    fetchData()
  }

  const handleReset = () => {
    setSearchText('')
    setSearchType(undefined)
    fetchData()
  }

  const treeData = data.map((p) => ({
    key: String(p.id),
    title: p.name,
    children: p.children?.map((c) => ({
      key: String(c.id),
      title: c.name,
      children: c.children?.map((cc) => ({
        key: String(cc.id),
        title: cc.name,
      })),
    })),
  }))

  return (
    <div className="permission">
      <Card bordered={false} className="permission__toolbar">
        <Form layout="inline">
          <FormItem label="权限名称">
            <Input
              className="permission__toolbar-input"
              placeholder="请输入权限名称"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="类型">
            <Select
              className="permission__toolbar-select"
              placeholder="请选择"
              value={searchType}
              onChange={setSearchType}
              allowClear
            >
              <Option value="view">查看</Option>
              <Option value="create">创建</Option>
              <Option value="edit">编辑</Option>
              <Option value="delete">删除</Option>
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
        <div className="permission__header">
          <div>
            <span className="permission__title">权限列表</span>
            <Tag color="blue" className="permission__tag">
              共 {data.length} 个权限
            </Tag>
          </div>
          <Button type="text" onClick={() => setShowTree(!showTree)}>
            {showTree ? '表格视图' : '树形视图'}
          </Button>
        </div>

        <Spin loading={loading}>
          {showTree ? (
            <Tree treeData={treeData} />
          ) : (
            <Table
              columns={columns}
              data={data}
              rowKey="id"
              pagination={{ pageSize: 20 }}
            />
          )}
        </Spin>
      </Card>
    </div>
  )
}

export default PermissionPage
