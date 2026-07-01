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
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getExceptionRules,
  createExceptionRule,
  updateExceptionRule,
  deleteExceptionRule,
  EXCEPTION_TYPES,
  AUTO_RESOLVE_TYPES,
  type AttendanceExceptionRule,
} from '@/api/attendance-exception'
import styles from './exception-rules.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TextArea = Input.TextArea

function ExceptionRulesPage() {
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState<AttendanceExceptionRule[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [modalVisible, setModalVisible] = useState(false)
  const [editingRule, setEditingRule] = useState<AttendanceExceptionRule | null>(null)
  const [form] = Form.useForm()

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getExceptionRules({ page, pageSize })
      if (res.code === 0) {
        setRules(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleCreate = () => {
    setEditingRule(null)
    form.resetFields()
    form.setFieldsValue({
      type: 'late',
      threshold: 0,
      autoResolve: false,
      deductMinutes: 0,
      status: 'active',
      sortOrder: 0,
    })
    setModalVisible(true)
  }

  const handleEdit = (rule: AttendanceExceptionRule) => {
    setEditingRule(rule)
    form.setFieldsValue({
      name: rule.name,
      type: rule.type,
      description: rule.description,
      threshold: rule.threshold,
      thresholdMax: rule.thresholdMax,
      autoResolve: rule.autoResolve,
      autoResolveType: rule.autoResolveType,
      deductMinutes: rule.deductMinutes,
      status: rule.status,
      sortOrder: rule.sortOrder,
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      if (editingRule) {
        await updateExceptionRule(editingRule.id, values)
        Message.success('更新成功')
      } else {
        await createExceptionRule(values)
        Message.success('创建成功')
      }
      setModalVisible(false)
      fetchRules()
    } catch {
      // handled
    }
  }

  const handleDelete = async (rule: AttendanceExceptionRule) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除规则「${rule.name}」吗？`,
      onOk: async () => {
        await deleteExceptionRule(rule.id)
        Message.success('删除成功')
        fetchRules()
      },
    })
  }

  const columns: TableProps<AttendanceExceptionRule>['columns'] = [
    {
      title: '规则名称',
      dataIndex: 'name',
      render: (val) => <span className={styles['exception-rules__text-bold']}>{val}</span>,
    },
    {
      title: '异常类型',
      dataIndex: 'type',
      width: 140,
      render: (val: string) => {
        const type = EXCEPTION_TYPES.find((t) => t.value === val)
        return <Tag>{type?.label || val}</Tag>
      },
    },
    {
      title: '阈值(分钟)',
      dataIndex: 'threshold',
      width: 120,
      render: (val, record) => {
        if (record.thresholdMax) {
          return `${val} - ${record.thresholdMax}`
        }
        return val > 0 ? `≥ ${val}` : '立即触发'
      },
    },
    {
      title: '自动处理',
      dataIndex: 'autoResolve',
      width: 100,
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'gray'}>
          {val ? '开启' : '关闭'}
        </Tag>
      ),
    },
    {
      title: '处理方式',
      dataIndex: 'autoResolveType',
      width: 140,
      render: (val?: string) => {
        if (!val) return '-'
        const type = AUTO_RESOLVE_TYPES.find((t) => t.value === val)
        return type?.label || val
      },
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
      render: (_: any, record) => (
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
    <div className={styles['exception-rules']}>
      <Card
        bordered={false}
        title="异常规则配置"
        extra={
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            新建规则
          </Button>
        }
      >
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
        className={styles['exception-rules__modal']}
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
              <FormItem label="异常类型" field="type" rules={[{ required: true, message: '请选择异常类型' }]}>
                <Select placeholder="请选择">
                  {EXCEPTION_TYPES.map((t) => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
          </Row>
          <FormItem label="规则说明" field="description">
            <TextArea placeholder="请输入规则说明" rows={2} maxLength={500} />
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="触发阈值(分钟)" field="threshold">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={1440}
                  placeholder="0表示立即触发"
                />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="上限阈值(分钟)" field="thresholdMax">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={1440}
                  placeholder="可选，用于区间判定"
                />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="自动处理" field="autoResolve" triggerPropName="checked">
                <Switch />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="处理方式" field="autoResolveType">
                <Select placeholder="请选择处理方式">
                  {AUTO_RESOLVE_TYPES.map((t) => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="扣除时长(分钟)" field="deductMinutes">
                <InputNumber className={styles['exception-rules__input-full']} min={0} max={1440} defaultValue={0} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="排序" field="sortOrder">
                <InputNumber className={styles['exception-rules__input-full']} min={0} max={9999} defaultValue={0} />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="状态" field="status">
            <Select className={styles['exception-rules__select-small']} defaultValue="active">
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default ExceptionRulesPage
