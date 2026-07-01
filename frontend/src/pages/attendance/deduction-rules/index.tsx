import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Message,
  Tag,
  Grid,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconExperiment,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getDeductionRules,
  createDeductionRule,
  updateDeductionRule,
  deleteDeductionRule,
  calculateDeduction,
  type DeductionRule,
  type DeductionCalculateResult,
} from '@/api/attendance'
import styles from './deduction-rules.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TextArea = Input.TextArea

const DEDUCTION_TYPES = [
  { value: 'late', label: '迟到' },
  { value: 'early', label: '早退' },
  { value: 'absent', label: '旷工' },
  { value: 'missing', label: '缺打卡' },
]

const DEDUCTION_METHODS = [
  { value: 'fixed', label: '固定金额' },
  { value: 'percentage', label: '日薪比例' },
  { value: 'multiplier', label: '日薪倍数' },
  { value: 'leave', label: '抵扣假期' },
]

const LEAVE_TYPES = [
  { value: 'annual', label: '年假' },
  { value: 'sick', label: '病假' },
  { value: 'personal', label: '事假' },
]

function DeductionRulesPage() {
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState<DeductionRule[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filterType, setFilterType] = useState<string | undefined>(undefined)
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined)

  const [modalVisible, setModalVisible] = useState(false)
  const [editingRule, setEditingRule] = useState<DeductionRule | null>(null)
  const [form] = Form.useForm()
  const [deductionType, setDeductionType] = useState<string>('fixed')

  const [calcModalVisible, setCalcModalVisible] = useState(false)
  const [calcForm] = Form.useForm()
  const [calcResult, setCalcResult] = useState<DeductionCalculateResult | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDeductionRules({ page, pageSize, type: filterType, status: filterStatus })
      if (res.code === 0) {
        setRules(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filterType, filterStatus])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleCreate = () => {
    setEditingRule(null)
    setDeductionType('fixed')
    form.resetFields()
    form.setFieldsValue({
      type: 'late',
      minMinutes: 0,
      deductionType: 'fixed',
      deductionValue: 0,
      affectAttendance: true,
      sortOrder: 0,
      status: 'active',
    })
    setModalVisible(true)
  }

  const handleEdit = (rule: DeductionRule) => {
    setEditingRule(rule)
    setDeductionType(rule.deductionType)
    form.setFieldsValue({
      name: rule.name,
      type: rule.type,
      minMinutes: rule.minMinutes,
      maxMinutes: rule.maxMinutes ?? undefined,
      deductionType: rule.deductionType,
      deductionValue: rule.deductionValue,
      salaryMultiplier: rule.salaryMultiplier ?? undefined,
      affectAttendance: rule.affectAttendance,
      leaveType: rule.leaveType ?? undefined,
      sortOrder: rule.sortOrder,
      status: rule.status,
      description: rule.description ?? undefined,
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      if (editingRule) {
        await updateDeductionRule(editingRule.id, values)
        Message.success('更新成功')
      } else {
        await createDeductionRule(values)
        Message.success('创建成功')
      }
      setModalVisible(false)
      fetchRules()
    } catch {
      // validation error
    }
  }

  const handleDelete = (rule: DeductionRule) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除规则「${rule.name}」吗？`,
      onOk: async () => {
        await deleteDeductionRule(rule.id)
        Message.success('删除成功')
        fetchRules()
      },
    })
  }

  const handleDeductionTypeChange = (value: string) => {
    setDeductionType(value)
  }

  const handleOpenCalc = () => {
    setCalcResult(null)
    calcForm.resetFields()
    calcForm.setFieldsValue({
      type: 'late',
      minutes: 0,
      dailySalary: 0,
    })
    setCalcModalVisible(true)
  }

  const handleCalculate = async () => {
    try {
      const values = await calcForm.validate()
      setCalcLoading(true)
      const res = await calculateDeduction(values)
      if (res.code === 0) {
        setCalcResult(res.data)
      }
    } catch {
      // calculation error
    } finally {
      setCalcLoading(false)
    }
  }

  const renderDeductionType = (type: string, value: number, multiplier?: number | null, leaveType?: string | null) => {
    const method = DEDUCTION_METHODS.find((m) => m.value === type)
    if (!method) return '-'
    switch (type) {
      case 'fixed':
        return `固定 ¥${value}`
      case 'percentage':
        return `日薪 ${value}%`
      case 'multiplier':
        return `日薪 ${multiplier || value} 倍`
      case 'leave':
        return `抵扣 ${leaveType ? LEAVE_TYPES.find((l) => l.value === leaveType)?.label : '假期'} ${value} 天`
      default:
        return method.label
    }
  }

  const columns: TableProps<DeductionRule>['columns'] = [
    {
      title: '规则名称',
      dataIndex: 'name',
      render: (val) => <span className={styles['deduction-rules__text-bold']}>{val}</span>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (val: string) => {
        const type = DEDUCTION_TYPES.find((t) => t.value === val)
        return <Tag>{type?.label || val}</Tag>
      },
    },
    {
      title: '分钟范围',
      dataIndex: 'minMinutes',
      width: 140,
      render: (val, record) => {
        if (record.maxMinutes !== null && record.maxMinutes !== undefined) {
          return `${val} - ${record.maxMinutes} 分钟`
        }
        return `≥ ${val} 分钟`
      },
    },
    {
      title: '扣款方式',
      dataIndex: 'deductionType',
      width: 180,
      render: (val: string, record) => (
        <span>
          {renderDeductionType(val, record.deductionValue, record.salaryMultiplier, record.leaveType)}
        </span>
      ),
    },
    {
      title: '影响出勤',
      dataIndex: 'affectAttendance',
      width: 100,
      render: (val: boolean) => (
        <Tag color={val ? 'orange' : 'gray'}>
          {val ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (val: string) => (
        <Tag color={val === 'active' ? 'green' : 'gray'}>
          {val === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 160,
      render: (_: unknown, record) => (
        <Space>
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles['deduction-rules']}>
      <Card
        bordered={false}
        title="扣款规则配置"
        extra={
          <Space>
            <Button icon={<IconExperiment />} onClick={handleOpenCalc}>
              测试计算
            </Button>
            <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
              新建规则
            </Button>
          </Space>
        }
      >
        <div className={styles['deduction-rules__filter']}>
          <Space>
            <span>类型：</span>
            <Select
              placeholder="全部类型"
              style={{ width: 140 }}
              allowClear
              value={filterType}
              onChange={(v) => {
                setFilterType(v as string | undefined)
                setPage(1)
              }}
            >
              {DEDUCTION_TYPES.map((t) => (
                <Option key={t.value} value={t.value}>{t.label}</Option>
              ))}
            </Select>
            <span>状态：</span>
            <Select
              placeholder="全部状态"
              style={{ width: 140 }}
              allowClear
              value={filterStatus}
              onChange={(v) => {
                setFilterStatus(v as string | undefined)
                setPage(1)
              }}
            >
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Space>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={rules}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal focusLock
        title={editingRule ? '编辑规则' : '新建规则'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        className={styles['deduction-rules__modal']}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="规则名称" field="name" rules={[{ required: true, message: '请输入规则名称' }]}>
                <Input placeholder="请输入规则名称" maxLength={100} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="类型" field="type" rules={[{ required: true, message: '请选择类型' }]}>
                <Select placeholder="请选择">
                  {DEDUCTION_TYPES.map((t) => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="起始分钟数" field="minMinutes" rules={[{ required: true, message: '请输入起始分钟数' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={1440}
                  placeholder="从多少分钟开始"
                />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="结束分钟数" field="maxMinutes">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={1440}
                  placeholder="为空表示无限大"
                />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="扣款方式" field="deductionType" rules={[{ required: true, message: '请选择扣款方式' }]}>
                <Select placeholder="请选择" onChange={handleDeductionTypeChange}>
                  {DEDUCTION_METHODS.map((m) => (
                    <Option key={m.value} value={m.value}>{m.label}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label={
                  deductionType === 'fixed' ? '扣款金额(元)' :
                  deductionType === 'percentage' ? '扣款比例(%)' :
                  deductionType === 'leave' ? '抵扣天数' :
                  '扣款值'
                }
                field="deductionValue"
                rules={[{ required: true, message: '请输入扣款值' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="请输入"
                />
              </FormItem>
            </Col>
          </Row>
          {deductionType === 'multiplier' && (
            <Row gutter={16}>
              <Col span={12}>
                <FormItem label="日薪倍数" field="salaryMultiplier">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    step={0.5}
                    placeholder="请输入日薪倍数"
                  />
                </FormItem>
              </Col>
            </Row>
          )}
          {deductionType === 'leave' && (
            <Row gutter={16}>
              <Col span={12}>
                <FormItem label="抵扣假期类型" field="leaveType">
                  <Select placeholder="请选择假期类型">
                    {LEAVE_TYPES.map((l) => (
                      <Option key={l.value} value={l.value}>{l.label}</Option>
                    ))}
                  </Select>
                </FormItem>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="是否影响出勤" field="affectAttendance" triggerPropName="checked">
                <Switch />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="排序" field="sortOrder">
                <InputNumber className={styles['deduction-rules__input-full']} min={0} max={9999} defaultValue={0} />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="状态" field="status">
            <Select className={styles['deduction-rules__select-small']} defaultValue="active">
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </FormItem>
          <FormItem label="描述" field="description">
            <TextArea placeholder="请输入描述" rows={2} maxLength={500} />
          </FormItem>
        </Form>
      </Modal>

      <Modal focusLock
        title="测试扣款计算"
        visible={calcModalVisible}
        onOk={handleCalculate}
        onCancel={() => setCalcModalVisible(false)}
        className={styles['deduction-rules__calc-modal']}
        okText="计算"
        cancelText="关闭"
        confirmLoading={calcLoading}
      >
        <Form form={calcForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="考勤类型" field="type" rules={[{ required: true, message: '请选择类型' }]}>
                <Select placeholder="请选择">
                  {DEDUCTION_TYPES.map((t) => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="分钟数" field="minutes" rules={[{ required: true, message: '请输入分钟数' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={1440}
                  placeholder="请输入分钟数"
                />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="日薪(元)" field="dailySalary" rules={[{ required: true, message: '请输入日薪' }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={0.01}
              placeholder="请输入日薪"
            />
          </FormItem>
        </Form>

        {calcResult && (
          <div className={styles['deduction-rules__calc-result']}>
            <div className={styles['deduction-rules__calc-amount']}>
              扣款金额：¥{calcResult.deductionAmount}
            </div>
            <div className={styles['deduction-rules__calc-detail']}>
              <div>匹配规则：{calcResult.ruleName}</div>
              <div>{calcResult.details}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DeductionRulesPage
