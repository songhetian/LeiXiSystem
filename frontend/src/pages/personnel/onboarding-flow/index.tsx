import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Empty,
} from '@arco-design/web-react'
import { toast } from '@/utils/toast'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconSettings,
  IconPlayArrowFill,
  IconStop,
  IconCheckCircle,
  IconSwap,
  IconTool,
  IconNotification,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { FlowCanvas } from '@/components'
import type { NodeTypeConfig, FlowNodeData, FlowEdgeData } from '@/components/FlowCanvas'
import {
  getOnboardingFlows,
  getOnboardingFlow,
  createOnboardingFlow,
  updateOnboardingFlow,
  deleteOnboardingFlow,
  getStepTypes,
  createStepType,
  updateStepType,
  deleteStepType,
  type OnboardingFlow,
  type OnboardingStepType,
} from '@/api/onboarding'
import styles from './onboarding-flow.module.css'

const FormItem = Form.Item
const Option = Select.Option
const TextArea = Input.TextArea

// ============================================================
// 默认节点/边：当流程没有 nodes/edges 时自动生成
// ============================================================

function buildDefaultNodes(): FlowNodeData[] {
  return [
    {
      id: 'start-1',
      type: 'customNode',
      position: { x: 80, y: 240 },
      data: { nodeType: 'start', label: '开始' },
    },
    {
      id: 'end-1',
      type: 'customNode',
      position: { x: 480, y: 240 },
      data: { nodeType: 'end', label: '结束' },
    },
  ]
}

function buildDefaultEdges(): FlowEdgeData[] {
  return [
    {
      id: 'edge-start-end',
      source: 'start-1',
      target: 'end-1',
      type: 'smoothstep',
      animated: true,
    },
  ]
}

/** 从流程数据中解析出可用的初始节点/边，旧数据则生成默认值 */
function resolveInitialGraph(flow: OnboardingFlow): {
  nodes: FlowNodeData[]
  edges: FlowEdgeData[]
} {
  const hasGraph = Array.isArray(flow.nodes) && flow.nodes.length > 0 && Array.isArray(flow.edges)
  if (hasGraph) {
    return {
      nodes: flow.nodes as FlowNodeData[],
      edges: flow.edges as FlowEdgeData[],
    }
  }
  return { nodes: buildDefaultNodes(), edges: buildDefaultEdges() }
}

function OnboardingFlowPage() {
  // ---- 流程列表 ----
  const [loading, setLoading] = useState(false)
  const [flows, setFlows] = useState<OnboardingFlow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // ---- 流程基本信息弹窗（新建/编辑名称等） ----
  const [flowModalVisible, setFlowModalVisible] = useState(false)
  const [editingFlow, setEditingFlow] = useState<OnboardingFlow | null>(null)
  const [form] = Form.useForm()

  // ---- 画布编辑器 ----
  const [canvasVisible, setCanvasVisible] = useState(false)
  const [canvasFlow, setCanvasFlow] = useState<OnboardingFlow | null>(null)
  const [canvasSaving, setCanvasSaving] = useState(false)

  // ---- 步骤类型管理 ----
  const [stepTypeModalVisible, setStepTypeModalVisible] = useState(false)
  const [stepTypes, setStepTypes] = useState<OnboardingStepType[]>([])
  const [stepTypeLoading, setStepTypeLoading] = useState(false)
  const [stepTypeFormVisible, setStepTypeFormVisible] = useState(false)
  const [editingStepType, setEditingStepType] = useState<OnboardingStepType | null>(null)
  const [stepTypeForm] = Form.useForm()

  // ============================================================
  // 数据加载
  // ============================================================

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

  const fetchStepTypes = useCallback(async () => {
    setStepTypeLoading(true)
    try {
      const res = await getStepTypes()
      if (res.code === 0) {
        setStepTypes(res.data ?? [])
      }
    } catch {
      // 接口可能未实现，静默处理
    } finally {
      setStepTypeLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlows()
  }, [fetchFlows])

  // ============================================================
  // 节点类型配置（task 节点的步骤类型选项由后端步骤类型动态生成）
  // ============================================================

  const stepTypeOptions = useMemo(
    () => stepTypes.map((s) => ({ label: s.name, value: s.code })),
    [stepTypes],
  )

  const nodeTypes: NodeTypeConfig[] = useMemo(
    () => [
      {
        type: 'start',
        label: '开始',
        icon: <IconPlayArrowFill />,
        color: '#00b42a',
        defaultData: { label: '开始' },
        fields: [],
      },
      {
        type: 'end',
        label: '结束',
        icon: <IconStop />,
        color: '#f53f3f',
        defaultData: { label: '结束' },
        fields: [],
      },
      {
        type: 'task',
        label: '任务步骤',
        icon: <IconCheckCircle />,
        color: '#165dff',
        defaultData: {
          label: '新任务',
          taskType: '',
          dueDays: 1,
          required: true,
          description: '',
        },
        fields: [
          {
            key: 'label',
            label: '步骤名称',
            type: 'text',
            required: true,
            placeholder: '如：提交入职材料',
          },
          {
            key: 'taskType',
            label: '步骤类型',
            type: 'select',
            options: stepTypeOptions,
            placeholder: '选择步骤类型',
          },
          {
            key: 'description',
            label: '步骤说明',
            type: 'textarea',
            placeholder: '详细描述',
          },
          {
            key: 'dueDays',
            label: '完成期限(天)',
            type: 'number',
            min: 1,
            max: 365,
          },
          { key: 'required', label: '是否必填', type: 'switch' },
          {
            key: 'assigneeRole',
            label: '指派角色',
            type: 'text',
            placeholder: '如：hr, manager',
          },
        ],
      },
      {
        type: 'condition',
        label: '条件分支',
        icon: <IconSwap />,
        color: '#ff7d00',
        defaultData: {
          label: '条件判断',
          branches: [
            { id: 'b1', label: '条件1' },
            { id: 'b2', label: '默认' },
          ],
        },
        fields: [
          {
            key: 'label',
            label: '节点名称',
            type: 'text',
            required: true,
          },
          {
            key: 'conditionField',
            label: '判断字段',
            type: 'select',
            options: [
              { label: '部门', value: 'department' },
              { label: '职位', value: 'position' },
              { label: '入职类型', value: 'employmentType' },
            ],
          },
          {
            key: 'conditionOperator',
            label: '判断方式',
            type: 'select',
            options: [
              { label: '等于', value: '=' },
              { label: '不等于', value: '!=' },
              { label: '包含', value: 'contains' },
            ],
          },
          {
            key: 'conditionValue',
            label: '判断值',
            type: 'text',
            placeholder: '如：技术部',
          },
        ],
      },
      {
        type: 'parallel',
        label: '并行网关',
        icon: <IconTool />,
        color: '#722ed1',
        defaultData: {
          label: '并行执行',
          branches: [
            { id: 'p1', label: '分支1' },
            { id: 'p2', label: '分支2' },
          ],
        },
        fields: [{ key: 'label', label: '节点名称', type: 'text', required: true }],
      },
      {
        type: 'notify',
        label: '通知',
        icon: <IconNotification />,
        color: '#0fc6c2',
        defaultData: { label: '发送通知', notifyType: 'email', notifyTemplate: '' },
        fields: [
          {
            key: 'label',
            label: '通知名称',
            type: 'text',
            required: true,
          },
          {
            key: 'notifyType',
            label: '通知方式',
            type: 'select',
            options: [
              { label: '邮件', value: 'email' },
              { label: '短信', value: 'sms' },
              { label: '站内推送', value: 'push' },
            ],
          },
          {
            key: 'notifyTemplate',
            label: '通知内容',
            type: 'textarea',
            placeholder: '通知模板内容',
          },
        ],
      },
    ],
    [stepTypeOptions],
  )

  // 画布初始节点/边（仅在 canvasFlow 变化时重算）
  const initialGraph = useMemo(() => {
    if (!canvasFlow) return { nodes: [], edges: [] }
    return resolveInitialGraph(canvasFlow)
  }, [canvasFlow])

  // ============================================================
  // 流程基本信息（新建/编辑）
  // ============================================================

  const handleCreateFlow = () => {
    setEditingFlow(null)
    form.resetFields()
    form.setFieldsValue({ status: 'active', isDefault: false, sortOrder: 0 })
    setFlowModalVisible(true)
  }

  const handleEditFlow = (flow: OnboardingFlow) => {
    setEditingFlow(flow)
    form.setFieldsValue({
      name: flow.name,
      description: flow.description,
      status: flow.status,
      isDefault: flow.isDefault,
      sortOrder: flow.sortOrder,
    })
    setFlowModalVisible(true)
  }

  const handleSubmitFlow = async () => {
    try {
      const values = await form.validate()
      if (editingFlow) {
        await updateOnboardingFlow(editingFlow.id, {
          name: values.name,
          description: values.description,
          status: values.status,
          isDefault: values.isDefault,
          sortOrder: values.sortOrder,
        })
        toast.success('更新成功')
      } else {
        const res = await createOnboardingFlow({
          name: values.name,
          description: values.description,
          status: values.status,
          isDefault: values.isDefault,
          sortOrder: values.sortOrder,
        })
        toast.success('创建成功，请配置画布')
        // 新建后直接打开画布编辑器
        if (res.code === 0 && res.data) {
          setFlowModalVisible(false)
          fetchFlows()
          openCanvas(res.data)
          return
        }
      }
      setFlowModalVisible(false)
      fetchFlows()
    } catch {
      // 校验失败
    }
  }

  const handleDeleteFlow = async (flow: OnboardingFlow) => {
    try {
      await toast.confirmDelete(flow.name)
    } catch {
      return
    }
    await deleteOnboardingFlow(flow.id)
    toast.success('删除成功')
    fetchFlows()
  }

  // ============================================================
  // 画布编辑器
  // ============================================================

  const openCanvas = async (flow: OnboardingFlow) => {
    // 拉取最新详情，确保 nodes/edges 字段存在
    try {
      const res = await getOnboardingFlow(flow.id)
      if (res.code === 0 && res.data) {
        setCanvasFlow(res.data)
        setCanvasVisible(true)
        return
      }
    } catch {
      // 接口异常时回退使用列表数据
    }
    setCanvasFlow(flow)
    setCanvasVisible(true)
  }

  const handleCanvasSave = async (nodes: FlowNodeData[], edges: FlowEdgeData[]) => {
    if (!canvasFlow) return
    setCanvasSaving(true)
    try {
      // 序列化节点：剥离 React Flow 内部字段，保留必要数据
      const serializedNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        sourcePosition: n.sourcePosition,
        targetPosition: n.targetPosition,
      }))
      const serializedEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: e.type,
        animated: e.animated,
        label: e.label,
        data: e.data,
      }))
      await updateOnboardingFlow(canvasFlow.id, {
        nodes: serializedNodes,
        edges: serializedEdges,
      })
      toast.success('画布保存成功')
      setCanvasVisible(false)
      setCanvasFlow(null)
      fetchFlows()
    } catch {
      toast.error('画布保存失败')
    } finally {
      setCanvasSaving(false)
    }
  }

  // ============================================================
  // 步骤类型管理
  // ============================================================

  const handleOpenStepTypes = () => {
    setStepTypeModalVisible(true)
    fetchStepTypes()
  }

  const handleAddStepType = () => {
    setEditingStepType(null)
    stepTypeForm.resetFields()
    stepTypeForm.setFieldsValue({
      status: 'active',
      sortOrder: 0,
      color: '#165dff',
    })
    setStepTypeFormVisible(true)
  }

  const handleEditStepType = (item: OnboardingStepType) => {
    setEditingStepType(item)
    stepTypeForm.setFieldsValue({
      name: item.name,
      code: item.code,
      icon: item.icon,
      color: item.color,
      description: item.description,
      status: item.status,
      sortOrder: item.sortOrder,
    })
    setStepTypeFormVisible(true)
  }

  const handleSubmitStepType = async () => {
    try {
      const values = await stepTypeForm.validate()
      if (editingStepType) {
        await updateStepType(editingStepType.id, {
          name: values.name,
          icon: values.icon,
          color: values.color,
          description: values.description,
          status: values.status,
          sortOrder: values.sortOrder,
        })
        toast.success('更新成功')
      } else {
        await createStepType({
          name: values.name,
          code: values.code,
          icon: values.icon,
          color: values.color,
          description: values.description,
          sortOrder: values.sortOrder,
        })
        toast.success('创建成功')
      }
      setStepTypeFormVisible(false)
      fetchStepTypes()
    } catch {
      // 校验失败
    }
  }

  const handleDeleteStepType = async (item: OnboardingStepType) => {
    if (item.isSystem) {
      toast.warning('系统内置步骤类型不可删除')
      return
    }
    try {
      await toast.confirmDelete(item.name)
    } catch {
      return
    }
    await deleteStepType(item.id)
    toast.success('删除成功')
    fetchStepTypes()
  }

  // ============================================================
  // 表格列定义
  // ============================================================

  const flowColumns: TableProps<OnboardingFlow>['columns'] = [
    {
      title: '流程名称',
      dataIndex: 'name',
      render: (val: string, record) => (
        <Space>
          <span className={styles['onboarding-flow__text-medium']}>{val}</span>
          {record.isDefault && (
            <Tag color="blue" size="small">
              默认
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      render: (val: string) => val || '-',
    },
    {
      title: '节点数',
      dataIndex: 'nodes',
      width: 90,
      render: (val, record) => (Array.isArray(val) ? val.length : record.steps?.length || 0),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => (
        <Tag color={val === 'active' ? 'green' : 'gray'}>{val === 'active' ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '操作',
      width: 260,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconSettings />}
            onClick={() => openCanvas(record)}
          >
            配置画布
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => handleEditFlow(record)}
          >
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            status="danger"
            icon={<IconDelete />}
            onClick={() => handleDeleteFlow(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const stepTypeColumns: TableProps<OnboardingStepType>['columns'] = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (val: string, record) => (
        <Space>
          {record.color && (
            <span
              className={styles['onboarding-flow__color-dot']}
              style={{ background: record.color }}
            />
          )}
          <span className={styles['onboarding-flow__text-medium']}>{val}</span>
          {record.isSystem && (
            <Tag size="small" color="gray">
              系统
            </Tag>
          )}
        </Space>
      ),
    },
    { title: '编码', dataIndex: 'code', width: 140 },
    {
      title: '图标',
      dataIndex: 'icon',
      width: 80,
      render: (val: string) => val || '-',
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 70,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (val: string) => (
        <Tag color={val === 'active' ? 'green' : 'gray'}>{val === 'active' ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '操作',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => handleEditStepType(record)}
          >
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            status="danger"
            icon={<IconDelete />}
            onClick={() => handleDeleteStepType(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className={styles['onboarding-flow']}>
      <Card
        bordered={false}
        title="入职流程配置"
        extra={
          <Space>
            <Button icon={<IconSettings />} onClick={handleOpenStepTypes}>
              步骤类型管理
            </Button>
            <Button type="primary" icon={<IconPlus />} onClick={handleCreateFlow}>
              新建流程
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={flowColumns}
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

      {/* 流程基本信息弹窗 */}
      <Modal
        focusLock
        title={editingFlow ? '编辑流程' : '新建流程'}
        visible={flowModalVisible}
        onOk={handleSubmitFlow}
        onCancel={() => setFlowModalVisible(false)}
        className={styles['onboarding-flow__modal--700']}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="流程名称"
            field="name"
            rules={[{ required: true, message: '请输入流程名称' }]}
          >
            <Input placeholder="请输入流程名称" maxLength={100} />
          </FormItem>
          <FormItem label="流程说明" field="description">
            <TextArea placeholder="请输入流程说明" rows={3} maxLength={500} />
          </FormItem>
          <div className={styles['onboarding-flow__form-row']}>
            <FormItem label="状态" field="status">
              <Select className={styles['onboarding-flow__select--150']}>
                <Option value="active">启用</Option>
                <Option value="inactive">停用</Option>
              </Select>
            </FormItem>
            <FormItem label="默认流程" field="isDefault" triggerPropName="checked">
              <Switch />
            </FormItem>
            <FormItem label="排序" field="sortOrder">
              <InputNumber min={0} max={9999} className={styles['onboarding-flow__input--120']} />
            </FormItem>
          </div>
        </Form>
      </Modal>

      {/* 画布编辑器（全屏 Modal） */}
      <Modal
        title={`配置流程画布${canvasFlow ? ` - ${canvasFlow.name}` : ''}`}
        visible={canvasVisible}
        onCancel={() => {
          if (canvasSaving) return
          setCanvasVisible(false)
          setCanvasFlow(null)
        }}
        footer={null}
        closable={!canvasSaving}
        maskClosable={false}
        unmountOnExit
        className={styles['onboarding-flow__modal--fullscreen']}
      >
        <div className={styles['onboarding-flow__canvas-wrapper']}>
          {canvasFlow && (
            <FlowCanvas
              key={canvasFlow.id}
              initialNodes={initialGraph.nodes}
              initialEdges={initialGraph.edges}
              nodeTypes={nodeTypes}
              title={canvasFlow.name}
              onSave={handleCanvasSave}
              onCancel={() => {
                setCanvasVisible(false)
                setCanvasFlow(null)
              }}
            />
          )}
        </div>
      </Modal>

      {/* 步骤类型管理弹窗 */}
      <Modal
        title="步骤类型管理"
        visible={stepTypeModalVisible}
        onCancel={() => setStepTypeModalVisible(false)}
        footer={null}
        className={styles['onboarding-flow__modal--800']}
      >
        <div className={styles['onboarding-flow__step-type-toolbar']}>
          <Button type="primary" size="small" icon={<IconPlus />} onClick={handleAddStepType}>
            新增步骤类型
          </Button>
        </div>
        <Table
          rowKey="id"
          loading={stepTypeLoading}
          columns={stepTypeColumns}
          data={stepTypes}
          pagination={false}
          size="small"
          noDataElement={<Empty description="暂无步骤类型" />}
        />
      </Modal>

      {/* 步骤类型新增/编辑弹窗 */}
      <Modal
        focusLock
        title={editingStepType ? '编辑步骤类型' : '新增步骤类型'}
        visible={stepTypeFormVisible}
        onOk={handleSubmitStepType}
        onCancel={() => setStepTypeFormVisible(false)}
        className={styles['onboarding-flow__modal--500']}
        okText="保存"
        cancelText="取消"
      >
        <Form form={stepTypeForm} layout="vertical">
          <FormItem label="名称" field="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：入职材料提交" maxLength={50} />
          </FormItem>
          <FormItem
            label="编码"
            field="code"
            rules={editingStepType ? [] : [{ required: true, message: '请输入编码' }]}
          >
            <Input
              placeholder="如：document"
              maxLength={50}
              disabled={!!editingStepType?.isSystem}
            />
          </FormItem>
          <div className={styles['onboarding-flow__form-row']}>
            <FormItem label="图标(图标名)" field="icon">
              <Input
                placeholder="如：IconCheckCircle"
                className={styles['onboarding-flow__input--180']}
              />
            </FormItem>
            <FormItem label="颜色" field="color">
              <Input placeholder="#165dff" className={styles['onboarding-flow__input--120']} />
            </FormItem>
            <FormItem label="排序" field="sortOrder">
              <InputNumber min={0} max={9999} className={styles['onboarding-flow__input--100']} />
            </FormItem>
          </div>
          <FormItem label="状态" field="status">
            <Select className={styles['onboarding-flow__select--150']}>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </FormItem>
          <FormItem label="说明" field="description">
            <TextArea placeholder="步骤类型说明" rows={2} maxLength={200} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default OnboardingFlowPage
