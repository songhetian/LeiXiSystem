import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Message,
  Popconfirm,
  Input,
  Switch,
  Select,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconLink,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { isSafeHttpUrl, openSafeExternalUrl } from '@/utils/url'
import { createSsoApp, deleteSsoApp, getSsoApps, updateSsoApp } from '@/api/sso'
import './style.css'

const FormItem = Form.Item
const Option = Select.Option

interface AppInfo {
  id: number
  name: string
  code: string
  appUrl: string
  logo?: string
  description: string
  status: 'active' | 'inactive'
  createTime: string
}

function Apps() {
  const [data, setData] = useState<AppInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSsoApps({ page: 1, pageSize: 100 })
      const list = res?.data?.list || []
      setData(list.map((item: any) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        appUrl: item.appUrl,
        logo: item.logoUrl,
        description: item.description || '',
        status: item.status,
        createTime: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
      })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const columns: TableProps<AppInfo>['columns'] = [
    {
      title: '应用名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '应用编码',
      dataIndex: 'code',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '应用地址',
      dataIndex: 'appUrl',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => (
        <Tag color={value === 'active' ? 'green' : 'gray'}>
          {value === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 120,
    },
    {
      title: '操作',
      width: 180,
      render: (_: any, record: AppInfo) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconLink />}
            onClick={() => {
              if (!openSafeExternalUrl(record.appUrl)) {
                Message.error('应用地址不安全或格式不正确')
              }
            }}
          >
            访问
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
            content="确定要删除该应用吗？"
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

  const handleEdit = (record: AppInfo) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setVisible(true)
  }

  const handleDelete = (id: number) => {
    deleteSsoApp(id).then(() => {
      Message.success('删除成功')
      loadData()
    })
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      if (editingId) {
        await updateSsoApp(editingId, values)
        Message.success('修改成功')
      } else {
        await createSsoApp(values)
        Message.success('新增成功')
      }
      await loadData()
      setVisible(false)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="sso-apps">
      <Card bordered={false}>
        <div className="sso-apps__header">
          <div>
            <span className="sso-apps__title">应用管理</span>
            <Tag color="blue" className="sso-apps__tag">
              共 {data.length} 个应用
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增应用
          </Button>
        </div>

        <Table columns={columns} data={data} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑应用' : '新增应用'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        className="sso-apps__modal"
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="应用名称"
            field="name"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="请输入应用名称" />
          </FormItem>
          <FormItem
            label="应用编码"
            field="code"
            rules={[{ required: true, message: '请输入应用编码' }]}
          >
            <Input placeholder="请输入应用编码" />
          </FormItem>
          <FormItem
            label="应用地址"
            field="appUrl"
            rules={[
              { required: true, message: '请输入应用地址' },
              {
                validator: (value, callback) => {
                  if (!value || isSafeHttpUrl(value)) {
                    callback()
                    return
                  }
                  callback('仅支持 http 或 https 地址')
                },
              },
            ]}
          >
            <Input placeholder="https://example.com" />
          </FormItem>
          <FormItem label="描述" field="description">
            <Input.TextArea placeholder="请输入应用描述" rows={3} />
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

export default Apps
