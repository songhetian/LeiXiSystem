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
  DatePicker,
  Message,
  Tag,
  Typography,
  Progress,
  Divider,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconDelete,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import dayjs from 'dayjs'
import {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  type AnnualBudget,
} from '@/api/budget'
import { getDepartmentsList, type Department } from '@/api/organization'
import { EXPENSE_TYPES } from '@/api/expense-standard'
import './style.css'

const { Text } = Typography
const FormItem = Form.Item
const Option = Select.Option

function BudgetsPage() {
  const [data, setData] = useState<AnnualBudget[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [departments, setDepartments] = useState<Department[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchYear, setSearchYear] = useState(dayjs().year())

  const currentYear = dayjs().year()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  const loadData = useCallback(async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true)
    try {
      const res = await getBudgets({
        page: nextPage,
        pageSize: nextPageSize,
        keyword: searchKeyword || undefined,
        year: searchYear,
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
  }, [page, pageSize, searchKeyword, searchYear])

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
  }, [searchKeyword, searchYear])

  const handleOpen = (record?: AnnualBudget) => {
    form.resetFields()
    if (record) {
      setEditingId(record.id)
      form.setFieldsValue({
        year: record.year,
        departmentId: record.departmentId,
        totalBudget: record.totalBudget,
        description: record.description,
      })
    } else {
      setEditingId(null)
      form.setFieldsValue({
        year: currentYear,
        totalBudget: 0,
      })
    }
    setVisible(true)
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      if (editingId) {
        await updateBudget(editingId, {
          totalBudget: values.totalBudget,
          description: values.description,
        })
        Message.success('更新成功')
      } else {
        await createBudget({
          year: values.year,
          departmentId: values.departmentId,
          totalBudget: values.totalBudget,
          description: values.description,
          items: EXPENSE_TYPES.slice(0, 4).map((t) => ({
            type: t.value,
            budgetAmount: Math.round(values.totalBudget / 4),
          })),
        })
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
      await deleteBudget(id)
      Message.success('删除成功')
      loadData(page, pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const getStatusTag = (rate: number) => {
    if (rate >= 90) return <Tag color="red">预算紧张</Tag>
    if (rate >= 70) return <Tag color="orange">使用中</Tag>
    if (rate >= 30) return <Tag color="arcoblue">进行中</Tag>
    return <Tag color="green">充裕</Tag>
  }

  const columns: TableProps<AnnualBudget>['columns'] = [
    {
      title: '年度',
      dataIndex: 'year',
      width: 80,
      render: (val) => <Typography.Text className="financial-budgets__text-year">{val}年</Typography.Text>,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 150,
      render: (val: any) => val?.name || '-',
    },
    {
      title: '年度预算',
      dataIndex: 'totalBudget',
      width: 120,
      render: (val) => <Text className="tabular-nums">¥{val?.toLocaleString()}</Text>,
    },
    {
      title: '已使用',
      dataIndex: 'spentAmount',
      width: 120,
      render: (val) => <Text className="tabular-nums">¥{val?.toLocaleString()}</Text>,
    },
    {
      title: '可用余额',
      dataIndex: 'availableAmount',
      width: 120,
      render: (val, record) => (
        <Text className="tabular-nums" style={{ color: val > 0 ? '#0fbf60' : '#f53f3f' }}>
          ¥{val?.toLocaleString()}
        </Text>
      ),
    },
    {
      title: '使用率',
      dataIndex: 'usageRate',
      width: 180,
      render: (val) => (
        <Space size="small">
          <Progress percent={Math.min(val || 0, 100)} size="small" showText={false} />
          <Text className="tabular-nums financial-budgets__text-usage">{val?.toFixed(1)}%</Text>
          {getStatusTag(val || 0)}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'items',
      width: 80,
      render: (_, record) => (
        record.availableAmount && record.availableAmount > 0 ? (
          <Tag color="green">正常</Tag>
        ) : (
          <Tag color="red">超额</Tag>
        )
      ),
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
    <div className="financial-budgets">
      <Card bordered={false} className="financial-budgets__toolbar">
        <Form layout="inline">
          <FormItem label="年份">
            <Select
              className="financial-budgets__input-year"
              value={searchYear}
              onChange={(val) => setSearchYear(val)}
            >
              {years.map((y) => (
                <Option key={y} value={y}>{y}年</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="部门">
            <Input
              className="financial-budgets__input-dept"
              placeholder="部门名称"
              value={searchKeyword}
              onChange={setSearchKeyword}
              allowClear
            />
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
        <div className="financial-budgets__header">
          <span className="financial-budgets__title">年度预算管理</span>
          <Button type="primary" icon={<IconPlus />} onClick={() => handleOpen()}>
            新建预算
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
        title={editingId ? '编辑预算' : '新建年度预算'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        className="financial-budgets__modal"
      >
        <Form form={form} layout="vertical">
          <FormItem label="年份" field="year" rules={[{ required: true, message: '请选择年份' }]}>
            <Select placeholder="请选择年份" disabled={!!editingId}>
              {years.map((y) => (
                <Option key={y} value={y}>{y}年</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="部门" field="departmentId" rules={[{ required: true, message: '请选择部门' }]}>
            <Select placeholder="请选择部门" disabled={!!editingId}>
              {departments.map((d) => (
                <Option key={d.id} value={d.id}>{d.name}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="年度总预算" field="totalBudget" rules={[{ required: true, message: '请输入年度总预算' }]}>
            <InputNumber
              placeholder="请输入年度总预算"
              min={0}
              precision={2}
              prefix="¥"
              className="financial-budgets__input-full"
            />
          </FormItem>
          <FormItem label="备注" field="description">
            <Input.TextArea placeholder="备注说明" rows={3} />
          </FormItem>
          {!editingId && (
            <>
              <Divider orientation="left">自动分配分类预算</Divider>
              <Text type="secondary" className="financial-budgets__text-note">
                系统将自动按等比例分配差旅费、餐饮费、交通费、招待费四个分类预算
              </Text>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default BudgetsPage
