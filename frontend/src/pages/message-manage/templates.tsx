import { useState, useCallback } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Drawer,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconEye,
} from '@arco-design/web-react/icon'
import {
  getMessageTemplateList,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  previewMessageTemplate,
} from '@/api/messageTemplate'
import { PageHeader, TableHeader, FilterBar } from '@/components'
import { toast } from '@/utils/toast'
import styles from './templates.module.css'
const FormItem = Form.Item
const Option = Select.Option
const TextArea = Input.TextArea

const TYPE_OPTIONS = [
  { value: 'system', label: '系统通知' },
  { value: 'approval', label: '审批通知' },
  { value: 'attendance', label: '考勤通知' },
  { value: 'schedule', label: '排班通知' },
  { value: 'payroll', label: '薪资通知' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '禁用' },
]

export default function MessageTemplates() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState<string | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()

  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [form] = Form.useForm()

  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMessageTemplateList({
        page,
        pageSize,
        keyword: keyword || undefined,
        type: filterType,
        status: filterStatus,
      })
      if (res.code === 0) {
        setData(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, keyword, filterType, filterStatus])

  const handleSearch = () => {
    setPage(1)
    setTimeout(fetchData, 0)
  }

  const handleReset = () => {
    setKeyword('')
    setFilterType(undefined)
    setFilterStatus(undefined)
    setPage(1)
    setTimeout(fetchData, 0)
  }

  const handleCreate = () => {
    setEditingItem(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (item: any) => {
    setEditingItem(item)
    form.setFieldsValue({
      name: item.name,
      code: item.code,
      type: item.type,
      title: item.title,
      content: item.content,
      status: item.status,
    })
    setModalVisible(true)
  }

  const handleDelete = (item: any) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除模板「${item.name}」吗？`,
      onOk: async () => {
        try {
          await deleteMessageTemplate(item.id)
          toast.success('删除成功')
          fetchData()
        } catch {
          // ignore
        }
      },
    })
  }

  const handlePreview = async (item: any) => {
    setPreviewLoading(true)
    try {
      const variables = item.variables || {}
      const sampleVars: Record<string, string> = {}
      if (Array.isArray(variables)) {
        variables.forEach((v: any) => {
          sampleVars[v.name] = v.defaultValue || `{${v.label || v.name}}`
        })
      }
      const res = await previewMessageTemplate(item.id, sampleVars)
      if (res.code === 0) {
        setPreviewData(res.data)
        setPreviewVisible(true)
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      if (editingItem) {
        await updateMessageTemplate(editingItem.id, values)
        toast.success('更新成功')
      } else {
        await createMessageTemplate(values)
        toast.success('创建成功')
      }
      setModalVisible(false)
      fetchData()
    } catch {
      // ignore
    }
  }

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '模板编码',
      dataIndex: 'code',
      width: 150,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (v: string) => {
        const opt = TYPE_OPTIONS.find(o => o.value === v)
        return opt ? opt.label : v
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => (
        <Tag color={v === 'active' ? 'green' : 'gray'}>
          {v === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '系统模板',
      dataIndex: 'isSystem',
      width: 100,
      render: (v: boolean) => v ? <Tag color="gold">系统</Tag> : '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 180,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="text" size="small" icon={<IconEye />} onClick={() => handlePreview(record)}>
            预览
          </Button>
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            status="danger"
            icon={<IconDelete />}
            onClick={() => handleDelete(record)}
            disabled={record.isSystem}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles['message-templates']}>
      <PageHeader title="消息模板" description="管理消息通知模板，支持变量替换，按权限维护。" />

      <FilterBar
        onSearch={handleSearch}
        onReset={handleReset}
        filters={[
          {
            label: '类型',
            field: 'type',
            type: 'select',
            value: filterType,
            onChange: setFilterType,
            options: TYPE_OPTIONS,
          },
          {
            label: '状态',
            field: 'status',
            type: 'select',
            value: filterStatus,
            onChange: setFilterStatus,
            options: STATUS_OPTIONS,
          },
        ] as any}
      />

      <TableHeader
        title="模板列表"
        total={total}
        extra={
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            新建模板
          </Button>
        }
      />

      <Table
        loading={loading}
        columns={columns as any}
        data={data}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
          showTotal: true,
        }}
        border={false}
      />

      <Modal focusLock
        title={editingItem ? '编辑模板' : '新建模板'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        style={{ width: 600 }}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <FormItem label="模板名称" field="name" rules={[{ required: true }]}>
            <Input placeholder="请输入模板名称" />
          </FormItem>
          <FormItem label="模板编码" field="code" rules={[{ required: true }]}>
            <Input placeholder="请输入模板编码（英文唯一标识）" disabled={!!editingItem?.isSystem} />
          </FormItem>
          <div style={{ display: 'flex', gap: 16 }}>
            <FormItem label="消息类型" field="type" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select placeholder="请选择">
                {TYPE_OPTIONS.map(opt => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            </FormItem>
            <FormItem label="状态" field="status" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select defaultValue="active">
                {STATUS_OPTIONS.map(opt => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            </FormItem>
          </div>
          <FormItem label="消息标题" field="title" rules={[{ required: true }]}>
            <Input placeholder="请输入消息标题，支持 {{变量名}} 语法" />
          </FormItem>
          <FormItem label="消息内容" field="content" rules={[{ required: true }]}>
            <TextArea
              placeholder="请输入消息内容，支持 {{变量名}} 语法"
              autoSize={{ minRows: 6, maxRows: 12 }}
            />
          </FormItem>
        </Form>
      </Modal>

      <Drawer
        title="模板预览"
        visible={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={500}
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : previewData ? (
          <div>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid var(--color-border-2)',
            }}>
              {previewData.title}
            </div>
            <div
              style={{ fontSize: 14, lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: previewData.content }}
            />
            <div style={{
              marginTop: 24,
              paddingTop: 12,
              borderTop: '1px solid var(--color-border-2)',
              fontSize: 12,
              color: 'var(--color-text-3)',
            }}>
              原始标题：{previewData.originalTitle}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
