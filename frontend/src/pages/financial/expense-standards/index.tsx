import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Message,
  Tag,
  Typography,
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
  getExpenseStandards,
  createExpenseStandard,
  updateExpenseStandard,
  deleteExpenseStandard,
  EXPENSE_TYPES,
  type ExpenseStandard,
} from '@/api/expense-standard'
import { getDepartmentsList, type Department } from '@/api/organization'
import './style.css'

const { Text } = Typography
const FormItem = Form.Item
const Option = Select.Option

function ExpenseStandardsPage() {
  const [data, setData] = useState<ExpenseStandard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [departments, setDepartments] = useState<Department[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>(undefined)
  const [searchStatus, setSearchStatus] = useState<string | undefined>('active')

  const loadData = useCallback(async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true)
    try {
      const res = await getExpenseStandards({
        page: nextPage,
        pageSize: nextPageSize,
        keyword: searchKeyword || undefined,
        type: searchType,
        status: searchStatus,
      })
      setData(res.data?.list || [])
      setTotal(res.data?.total || 0)
      setPage(nextPage)
      setPageSize(nextPageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchKeyword, searchType, searchStatus])

  const loadDepartments = useCallback(async () => {
    try {
      const res = await getDepartmentsList()
      setDepartments(res.data || [])
    } catch {
      // error handled by interceptor
    }
  }, [])

  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  useEffect(() => {
    loadData(1, pageSize)
  }, [searchKeyword, searchType, searchStatus])

  const handleOpen = (record?: ExpenseStandard) => {
    form.resetFields()
    if (record) {
      setEditingId(record.id)
      form.setFieldsValue({
        name: record.name,
        type: record.type,
        amountLimit: record.amountLimit,
        dailyLimit: record.dailyLimit,
        monthlyLimit: record.monthlyLimit,
        departmentId: record.departmentId,
        requireInvoice: record.requireInvoice,
        description: record.description,
        status: record.status,
        sortOrder: record.sortOrder,
      })
    } else {
      setEditingId(null)
      form.setFieldsValue({
        requireInvoice: true,
        status: 'active',
        sortOrder: 0,
      })
    }
    setVisible(true)
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      if (editingId) {
        await updateExpenseStandard(editingId, values)
        Message.success('更新成功')
      } else {
        await createExpenseStandard(values)
        Message.success('创建成功')
      }
      setVisible(false)
      loadData(page, pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteExpenseStandard(id)
      Message.success('删除成功')
      loadData(page, pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const getTypeTag = (type: string) => {
    const colors: Record<string, string> = {
      '差旅费': 'arcoblue',
      '餐饮费': 'green',
      '交通费': 'orange',
      '招待费': 'red',
      '办公用品': 'purple',
      '通讯费': 'cyan',
      '培训费': 'pinkpurple',
      '其他': 'gray',
    }
    return <Tag color={colors[type] || 'arcoblue'}>{type}</Tag>
  }

  const columns: TableProps<ExpenseStandard>['columns'] = [
    {
      title: '标准名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '费用类型',
      dataIndex: 'type',
      width: 100,
      render: (val) => getTypeTag(val),
    },
    {
      title: '适用部门',
      dataIndex: 'department',
      width: 120,
      render: (val: any) => val?.name || <Text type="secondary">全部部门</Text>,
    },
    {
      title: '单笔上限',
      dataIndex: 'amountLimit',
      width: 120,
      render: (val) => <Text className="tabular-nums">¥{val?.toLocaleString()}</Text>,
    },
    {
      title: '日上限',
      dataIndex: 'dailyLimit',
      width: 100,
      render: (val) => val ? <Text className="tabular-nums">¥{val?.toLocaleString()}</Text> : '-',
    },
    {
      title: '月上限',
      dataIndex: 'monthlyLimit',
      width: 100,
      render: (val) => val ? <Text className="tabular-nums">¥{val?.toLocaleString()}</Text> : '-',
    },
    {
      title: '必须发票',
      dataIndex: 'requireInvoice',
      width: 90,
      render: (val) => val ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (val) => val === 'active' ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>,
    },
    {
      title: '操作',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleOpen(record)}>
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            status="danger"
            icon={<IconDelete />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="financial-expense-standards">
      <Card bordered={false} className="financial-expense-standards__toolbar">
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              className="financial-expense-standards__input-keyword"
              placeholder="名称"
              value={searchKeyword}
              onChange={setSearchKeyword}
              allowClear
            />
          </FormItem>
          <FormItem label="类型">
            <Select
              className="financial-expense-standards__select-type"
              placeholder="全部"
              value={searchType}
              onChange={setSearchType}
              allowClear
            >
              {EXPENSE_TYPES.map((t) => (
                <Option key={t.value} value={t.value}>{t.label}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="状态">
            <Select
              className="financial-expense-standards__select-status"
              placeholder="全部"
              value={searchStatus}
              onChange={setSearchStatus}
              allowClear
            >
              <Option value="active">启用</Option>
              <Option value="inactive">禁用</Option>
            </Select>
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button type="primary" icon={<IconSearch />} onClick={() => loadData(1, pageSize)}>
                搜索
              </Button>
              <Button icon={<IconRefresh />} onClick={() => loadData(page, pageSize)}>
                重置
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <div className="financial-expense-standards__header">
          <span className="financial-expense-standards__title">费用标准配置</span>
          <Button type="primary" icon={<IconPlus />} onClick={() => handleOpen()}>
            新建标准
          </Button>
        </div>

        <Table
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: true,
            sizeCanChange: true,
            onChange: (p, ps) => loadData(p, ps),
          }}
        />
      </Card>

      <Modal
        title={editingId ? '编辑费用标准' : '新建费用标准'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        className="financial-expense-standards__modal"
      >
        <Form form={form} layout="vertical">
          <FormItem label="标准名称" field="name" rules={[{ required: true, message: '请输入标准名称' }]}>
            <Input placeholder="如：高管差旅标准、普通员工餐饮标准" maxLength={100} />
          </FormItem>
          <FormItem label="费用类型" field="type" rules={[{ required: true, message: '请选择费用类型' }]}>
            <Select placeholder="请选择费用类型">
              {EXPENSE_TYPES.map((t) => (
                <Option key={t.value} value={t.value}>{t.label}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="适用部门" field="departmentId" tooltip="留空表示适用于所有部门">
            <Select placeholder="全部部门" allowClear>
              {departments.map((d) => (
                <Option key={d.id} value={d.id}>{d.name}</Option>
              ))}
            </Select>
          </FormItem>
          <Space>
            <FormItem label="单笔上限" field="amountLimit" rules={[{ required: true, message: '请输入单笔上限' }]}>
              <InputNumber
                placeholder="0"
                min={0}
                precision={2}
                prefix="¥"
                className="financial-expense-standards__input-number"
              />
            </FormItem>
            <FormItem label="日上限" field="dailyLimit">
              <InputNumber
                placeholder="0"
                min={0}
                precision={2}
                prefix="¥"
                className="financial-expense-standards__input-number"
              />
            </FormItem>
            <FormItem label="月上限" field="monthlyLimit">
              <InputNumber
                placeholder="0"
                min={0}
                precision={2}
                prefix="¥"
                className="financial-expense-standards__input-number"
              />
            </FormItem>
          </Space>
          <FormItem label="必须上传发票" field="requireInvoice" triggerPropName="checked">
            <Switch />
          </FormItem>
          <FormItem label="状态" field="status">
            <Select placeholder="请选择状态" defaultValue="active" className="financial-expense-standards__select-type">
              <Option value="active">启用</Option>
              <Option value="inactive">禁用</Option>
            </Select>
          </FormItem>
          <FormItem label="排序" field="sortOrder">
            <InputNumber placeholder="数字越小越靠前" min={0} max={9999} defaultValue={0} className="financial-expense-standards__select-type" />
          </FormItem>
          <FormItem label="说明" field="description">
            <Input.TextArea placeholder="补充说明" rows={2} maxLength={500} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default ExpenseStandardsPage
