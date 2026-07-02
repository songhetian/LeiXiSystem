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
  Tag,
  Steps,
  Empty,
} from '@arco-design/web-react'
import { toast } from '@/utils/toast'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconSettings,
  IconPlusCircle,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getOnboardingFlows,
  createOnboardingFlow,
  updateOnboardingFlow,
  deleteOnboardingFlow,
  addFlowStep,
  updateFlowStep,
  deleteFlowStep,
  STEP_TYPES,
  type OnboardingFlow,
  type OnboardingFlowStep,
} from '@/api/onboarding'
import styles from './onboarding-flow.module.css'
const FormItem = Form.Item
const Option = Select.Option
const TextArea = Input.TextArea

function OnboardingFlowPage() {
  const [loading, setLoading] = useState(false)
  const [flows, setFlows] = useState<OnboardingFlow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [modalVisible, setModalVisible] = useState(false)
  const [editingFlow, setEditingFlow] = useState<OnboardingFlow | null>(null)
  const [form] = Form.useForm()

  const [stepModalVisible, setStepModalVisible] = useState(false)
  const [editingStep, setEditingStep] = useState<OnboardingFlowStep | null>(null)
  const [currentFlow, setCurrentFlow] = useState<OnboardingFlow | null>(null)
  const [stepForm] = Form.useForm()

  const fetchFlows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getOnboardingFlows({ page, pageSize })
      if (res.code === 0) {
        setFlows(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchFlows()
  }, [fetchFlows])

  const handleCreate = () => {
    setEditingFlow(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (flow: OnboardingFlow) => {
    setEditingFlow(flow)
    form.setFieldsValue({
      name: flow.name,
      description: flow.description,
      status: flow.status,
      isDefault: flow.isDefault,
      sortOrder: flow.sortOrder,
    })
    setCurrentFlow(flow)
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      if (editingFlow) {
        await updateOnboardingFlow(editingFlow.id, values)
        toast.success('更新成功')
      } else {
        await createOnboardingFlow(values)
        toast.success('创建成功')
      }
      setModalVisible(false)
      fetchFlows()
    } catch {
      // handled
    }
  }

  const handleDelete = async (flow: OnboardingFlow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除流程「${flow.name}」吗？`,
      onOk: async () => {
        await deleteOnboardingFlow(flow.id)
        toast.success('删除成功')
        fetchFlows()
      },
    })
  }

  const handleAddStep = () => {
    setEditingStep(null)
    stepForm.resetFields()
    stepForm.setFieldsValue({
      type: 'task',
      dueDays: 1,
      required: true,
      stepOrder: currentFlow?.steps?.length || 0,
    })
    setStepModalVisible(true)
  }

  const handleEditStep = (step: OnboardingFlowStep) => {
    setEditingStep(step)
    stepForm.setFieldsValue({
      title: step.title,
      description: step.description,
      stepOrder: step.stepOrder,
      type: step.type,
      assigneeRole: step.assigneeRole,
      dueDays: step.dueDays,
      required: step.required,
    })
    setStepModalVisible(true)
  }

  const handleSubmitStep = async () => {
    try {
      const values = await stepForm.validate()
      if (editingStep) {
        await updateFlowStep(editingStep.id, values)
        toast.success('更新步骤成功')
      } else if (currentFlow) {
        await addFlowStep(currentFlow.id, values)
        toast.success('添加步骤成功')
      }
      setStepModalVisible(false)
      // 刷新当前流程
      if (currentFlow) {
        const res = await getOnboardingFlows({ page, pageSize })
        if (res.code === 0) {
          const updated = res.data.list.find((f) => f.id === currentFlow.id)
          if (updated) {
            setCurrentFlow(updated)
          }
        }
      }
      fetchFlows()
    } catch {
      // handled
    }
  }

  const handleDeleteStep = async (step: OnboardingFlowStep) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除步骤「${step.title}」吗？`,
      onOk: async () => {
        await deleteFlowStep(step.id)
        toast.success('删除成功')
        if (currentFlow) {
          const res = await getOnboardingFlows({ page, pageSize })
          if (res.code === 0) {
            const updated = res.data.list.find((f) => f.id === currentFlow.id)
            if (updated) {
              setCurrentFlow(updated)
            }
          }
        }
        fetchFlows()
      },
    })
  }

  const columns: TableProps<OnboardingFlow>['columns'] = [
    {
      title: '流程名称',
      dataIndex: 'name',
      render: (val, record) => (
        <Space>
          <span className={styles['onboarding-flow__text-medium']}>{val}</span>
          {record.isDefault && <Tag color="blue" size="small">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '适用范围',
      dataIndex: 'department',
      render: (val: any) => val?.name || '全部',
    },
    {
      title: '步骤数',
      dataIndex: 'steps',
      render: (val: any[]) => val?.length || 0,
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => (
        <Tag color={val === 'active' ? 'green' : 'gray'}>
          {val === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, record) => (
        <Space>
          <Button type="text" size="small" icon={<IconSettings />} onClick={() => handleEdit(record)}>
            配置
          </Button>
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
    <div className={styles['onboarding-flow']}>
      <Card
        bordered={false}
        title="入职流程配置"
        extra={
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            新建流程
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={flows}
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
        title={editingFlow ? '编辑流程' : '新建流程'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        className={styles['onboarding-flow__modal--700']}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <FormItem label="流程名称" field="name" rules={[{ required: true, message: '请输入流程名称' }]}>
            <Input placeholder="请输入流程名称" maxLength={100} />
          </FormItem>
          <FormItem label="流程说明" field="description">
            <TextArea placeholder="请输入流程说明" rows={3} maxLength={500} />
          </FormItem>
          <div className={styles['onboarding-flow__form-row']}>
            <FormItem label="状态" field="status">
              <Select className={styles['onboarding-flow__select--150']} defaultValue="active">
                <Option value="active">启用</Option>
                <Option value="inactive">停用</Option>
              </Select>
            </FormItem>
            <FormItem label="默认流程" field="isDefault" triggerPropName="checked">
              <Switch />
            </FormItem>
            <FormItem label="排序" field="sortOrder">
              <InputNumber min={0} max={9999} defaultValue={0} className={styles['onboarding-flow__input--120']} />
            </FormItem>
          </div>
        </Form>

        {currentFlow && (
          <div className={styles['onboarding-flow__steps-section']}>
            <div className={styles['onboarding-flow__steps-header']}>
              <span className={styles['onboarding-flow__text-bold']}>流程步骤</span>
              <Button type="primary" size="small" icon={<IconPlusCircle />} onClick={handleAddStep}>
                添加步骤
              </Button>
            </div>
            {currentFlow.steps?.length ? (
              <Steps direction="vertical" current={0} size="small">
                {currentFlow.steps.map((step) => (
                  <Steps.Step
                    key={step.id}
                    title={
                      <div className={styles['onboarding-flow__step-title']}>
                        <Space>
                          <span>{step.title}</span>
                          <Tag size="small" color={step.required ? 'red' : 'gray'}>
                            {step.required ? '必填' : '选填'}
                          </Tag>
                          <Tag size="small">
                            {STEP_TYPES.find((t) => t.value === step.type)?.label || step.type}
                          </Tag>
                        </Space>
                        <Space>
                          <Button type="text" size="mini" icon={<IconEdit />} onClick={() => handleEditStep(step)} />
                          <Button
                            type="text"
                            size="mini"
                            status="danger"
                            icon={<IconDelete />}
                            onClick={() => handleDeleteStep(step)}
                          />
                        </Space>
                      </div>
                    }
                    description={`${step.dueDays}天内完成`}
                  />
                ))}
              </Steps>
            ) : (
              <Empty description="暂无步骤，点击上方按钮添加" />
            )}
          </div>
        )}
      </Modal>

      <Modal focusLock
        title={editingStep ? '编辑步骤' : '添加步骤'}
        visible={stepModalVisible}
        onOk={handleSubmitStep}
        onCancel={() => setStepModalVisible(false)}
        className={styles['onboarding-flow__modal--500']}
        okText="保存"
        cancelText="取消"
      >
        <Form form={stepForm} layout="vertical">
          <FormItem label="步骤名称" field="title" rules={[{ required: true, message: '请输入步骤名称' }]}>
            <Input placeholder="请输入步骤名称" maxLength={100} />
          </FormItem>
          <FormItem label="步骤描述" field="description">
            <TextArea placeholder="请输入步骤描述" rows={2} maxLength={2000} />
          </FormItem>
          <div className={styles['onboarding-flow__form-row']}>
            <FormItem label="步骤类型" field="type">
              <Select className={styles['onboarding-flow__select--150']}>
                {STEP_TYPES.map((t) => (
                  <Option key={t.value} value={t.value}>{t.label}</Option>
                ))}
              </Select>
            </FormItem>
            <FormItem label="排序" field="stepOrder">
              <InputNumber min={0} className={styles['onboarding-flow__input--100']} />
            </FormItem>
            <FormItem label="完成期限(天)" field="dueDays">
              <InputNumber min={1} max={365} defaultValue={1} className={styles['onboarding-flow__input--100']} />
            </FormItem>
          </div>
          <div className={styles['onboarding-flow__form-row']}>
            <FormItem label="是否必填" field="required" triggerPropName="checked">
              <Switch />
            </FormItem>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default OnboardingFlowPage
