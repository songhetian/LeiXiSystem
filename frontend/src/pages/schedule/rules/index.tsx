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
import {
  getScheduleRules,
  createScheduleRule,
  updateScheduleRule,
  deleteScheduleRule,
  getRuleShifts,
  type ScheduleRule,
} from '@/api/schedule'
import { getShifts, Shift } from '@/api/shift'
import { getDepartmentsList, Department } from '@/api/organization'
import './style.css'

const { Text } = Typography
const FormItem = Form.Item
const Option = Select.Option

interface RuleWithShifts extends ScheduleRule {
  shiftList?: Array<{ id: number; name: string; color?: string }>
}

function RulesPage() {
  const [data, setData] = useState<RuleWithShifts[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [allShifts, setAllShifts] = useState<Shift[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedShifts, setSelectedShifts] = useState<number[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()

  const loadData = useCallback(async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true)
    try {
      const res = await getScheduleRules({
        page: nextPage,
        pageSize: nextPageSize,
        keyword: searchKeyword || undefined,
        status: searchStatus,
      })
      const list = res.data?.list || []

      // 获取每个规则的班次列表
      const rulesWithShifts = await Promise.all(
        list.map(async (rule: ScheduleRule) => {
          try {
            const shiftRes: any = await getRuleShifts(rule.id)
            return { ...rule, shiftList: shiftRes.data || [] }
          } catch {
            return { ...rule, shiftList: [] }
          }
        })
      )

      setData(rulesWithShifts)
      setTotal(res.data?.total || 0)
      setPage(nextPage)
      setPageSize(nextPageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchKeyword, searchStatus])

  const loadShifts = useCallback(async () => {
    try {
      const res = await getShifts({ page: 1, pageSize: 100, status: 'active' })
      setAllShifts(res.data?.list || [])
    } catch {
      // error handled by interceptor
    }
  }, [])

  const loadDepartments = useCallback(async () => {
    try {
      const res = await getDepartmentsList()
      setDepartments(res.data || [])
    } catch {
      // error handled by interceptor
    }
  }, [])

  useEffect(() => {
    loadShifts()
    loadDepartments()
  }, [loadShifts, loadDepartments])

  useEffect(() => {
    loadData(1, pageSize)
  }, [searchKeyword, searchStatus])

  const handleOpen = (record?: ScheduleRule) => {
    form.resetFields()
    setSelectedShifts([])
    if (record) {
      setEditingId(record.id)
      form.setFieldsValue({
        name: record.name,
        code: record.code,
        departmentId: record.departmentId,
        maxWorkHoursPerWeek: record.maxWorkHoursPerWeek,
        maxConsecutiveDays: record.maxConsecutiveDays,
        minRestHoursBetween: record.minRestHoursBetween,
        maxNightShiftsPerWeek: record.maxNightShiftsPerWeek,
        priority: record.priority,
        fairnessWeight: record.fairnessWeight,
        preferenceEnabled: record.preferenceEnabled,
        status: record.status,
        sortOrder: record.sortOrder,
      })
      const shiftIds = record.shiftIds.split(',').map(Number).filter(Boolean)
      setSelectedShifts(shiftIds)
    } else {
      setEditingId(null)
    }
    setVisible(true)
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      if (selectedShifts.length === 0) {
        Message.error('请至少选择一个班次')
        return
      }
      const data = {
        ...values,
        shiftIds: selectedShifts.join(','),
        preferenceEnabled: values.preferenceEnabled ?? true,
      }
      if (editingId) {
        await updateScheduleRule(editingId, data)
        Message.success('更新成功')
      } else {
        await createScheduleRule(data)
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
      await deleteScheduleRule(id)
      Message.success('删除成功')
      loadData(page, pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handleShiftChange = (values: number[]) => {
    setSelectedShifts(values)
  }

  const columns: TableProps<RuleWithShifts>['columns'] = [
    {
      title: '规则名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '编码',
      dataIndex: 'code',
      width: 120,
    },
    {
      title: '适用部门',
      dataIndex: 'department',
      width: 120,
      render: (val: any) => val?.name || <Text type="secondary">全部部门</Text>,
    },
    {
      title: '关联班次',
      dataIndex: 'shiftList',
      width: 200,
      render: (shifts: any[]) => (
        <Space size="small" wrap>
          {shifts?.slice(0, 3).map((s) => (
            <Tag key={s.id} color={s.color || 'arcoblue'}>
              {s.name}
            </Tag>
          ))}
          {shifts?.length > 3 && (
            <Tag>+{shifts.length - 3}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (val) => val || 0,
    },
    {
      title: '公平性权重',
      dataIndex: 'fairnessWeight',
      width: 100,
      render: (val) => `${val || 0}%`,
    },
    {
      title: '启用偏好',
      dataIndex: 'preferenceEnabled',
      width: 100,
      render: (val) => (val ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (val) => (val === 'active' ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>),
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
    <div className="schedule-rules">
      <Card bordered={false} className="schedule-rules__toolbar">
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              className="schedule-rules__input-keyword"
              placeholder="名称/编码"
              value={searchKeyword}
              onChange={setSearchKeyword}
              allowClear
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              className="schedule-rules__select-status"
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
        <div className="schedule-rules__header">
          <span className="schedule-rules__title">排班规则</span>
          <Button type="primary" icon={<IconPlus />} onClick={() => handleOpen()}>
            新建规则
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
        title={editingId ? '编辑规则' : '新建规则'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        className="schedule-rules__modal-large"
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left">基本信息</Divider>
          <FormItem label="规则名称" field="name" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="请输入规则名称" maxLength={100} />
          </FormItem>
          <FormItem label="规则编码" field="code" rules={[{ required: true, message: '请输入规则编码' }]}>
            <Input placeholder="请输入规则编码，如 weekly_rotation" maxLength={50} disabled={!!editingId} />
          </FormItem>
          <FormItem label="适用部门" field="departmentId">
            <Select placeholder="留空表示适用于所有部门" allowClear className="schedule-rules__select-full">
              {departments.map((d) => (
                <Option key={d.id} value={d.id}>
                  {d.name}
                </Option>
              ))}
            </Select>
          </FormItem>

          <Divider orientation="left">关联班次</Divider>
          <FormItem label="选择班次" required>
            <Select
              mode="multiple"
              placeholder="请选择该规则关联的班次"
              value={selectedShifts}
              onChange={handleShiftChange}
              className="schedule-rules__select-full"
            >
              {allShifts.map((s) => (
                <Option key={s.id} value={s.id}>
                  <Space>
                    <span className="schedule-rules__shift-dot" />
                    {s.name} ({s.startTime} - {s.endTime})
                  </Space>
                </Option>
              ))}
            </Select>
          </FormItem>

          <Divider orientation="left">合规规则</Divider>
          <Space wrap>
            <FormItem label="周工时上限" field="maxWorkHoursPerWeek" className="schedule-rules__form-item">
              <InputNumber placeholder="小时" min={1} max={168} suffix="小时" />
            </FormItem>
            <FormItem label="最大连班天数" field="maxConsecutiveDays" className="schedule-rules__form-item">
              <InputNumber placeholder="天数" min={1} max={30} suffix="天" />
            </FormItem>
            <FormItem label="最短休息间隔" field="minRestHoursBetween" className="schedule-rules__form-item">
              <InputNumber placeholder="小时" min={0} max={24} suffix="小时" />
            </FormItem>
            <FormItem label="周夜班上限" field="maxNightShiftsPerWeek" className="schedule-rules__form-item">
              <InputNumber placeholder="次数" min={0} max={7} suffix="次" />
            </FormItem>
          </Space>

          <Divider orientation="left">智能参数</Divider>
          <Space wrap>
            <FormItem label="优先级" field="priority" className="schedule-rules__form-item">
              <InputNumber placeholder="0-100" min={0} max={100} defaultValue={0} />
            </FormItem>
            <FormItem label="公平性权重" field="fairnessWeight" className="schedule-rules__form-item">
              <InputNumber placeholder="0-100" min={0} max={100} defaultValue={50} suffix="%" />
            </FormItem>
            <FormItem label="启用员工偏好" field="preferenceEnabled" className="schedule-rules__form-item">
              <Switch defaultChecked />
            </FormItem>
          </Space>

          <Divider orientation="left">其他设置</Divider>
          <Space wrap>
            <FormItem label="排序" field="sortOrder" className="schedule-rules__form-item">
              <InputNumber placeholder="数字越小越靠前" min={0} max={9999} defaultValue={0} />
            </FormItem>
            <FormItem label="状态" field="status" className="schedule-rules__form-item">
              <Select defaultValue="active" className="schedule-rules__select-status-form">
                <Option value="active">启用</Option>
                <Option value="inactive">禁用</Option>
              </Select>
            </FormItem>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default RulesPage
