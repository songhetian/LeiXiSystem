import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Table,
  Button,
  Select,
  Space,
  Modal,
  Form,
  Tag,
  Card,
  Grid,
  Input,
  Switch,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconSettings,
  IconPlayArrowFill,
  IconStop,
  IconUser,
  IconSwap,
  IconTool,
  IconNotification,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getApprovalFlows, createApprovalFlow, updateApprovalFlow } from '@/api/approval'
import type { ApprovalFlow } from '@/api/approval'
import { useCrudModal } from '@/hooks/useCrudModal'
import { FlowCanvas } from '@/components'
import type { NodeTypeConfig, FlowNodeData, FlowEdgeData } from '@/components/FlowCanvas'
import { catchError } from '@/utils/catchError'
import { toast } from '@/utils/toast'
import styles from './flow.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

const typeColorMap: Record<string, string> = {
  leave: 'blue',
  overtime: 'orange',
  reimbursement: 'green',
  shift: 'purple',
}

const typeNameMap: Record<string, string> = {
  leave: '请假',
  overtime: '加班',
  reimbursement: '报销',
  shift: '调班',
}

// 默认的开始→结束节点（用于没有 nodes/edges 的旧数据或新建流程）
const defaultFlowNodes: FlowNodeData[] = [
  {
    id: 'start',
    type: 'customNode',
    position: { x: 120, y: 240 },
    data: { nodeType: 'start', label: '发起申请' },
  },
  {
    id: 'end',
    type: 'customNode',
    position: { x: 480, y: 240 },
    data: { nodeType: 'end', label: '流程结束' },
  },
]

const defaultFlowEdges: FlowEdgeData[] = [
  { id: 'e-start-end', source: 'start', target: 'end', type: 'smoothstep', animated: true },
]

// 节点类型配置
const nodeTypes: NodeTypeConfig[] = [
  {
    type: 'start',
    label: '开始',
    icon: <IconPlayArrowFill />,
    color: '#00b42a',
    defaultData: { label: '发起申请' },
    fields: [],
  },
  {
    type: 'end',
    label: '结束',
    icon: <IconStop />,
    color: '#f53f3f',
    defaultData: { label: '流程结束' },
    fields: [],
  },
  {
    type: 'approval',
    label: '审批节点',
    icon: <IconUser />,
    color: '#165dff',
    defaultData: {
      label: '审批节点',
      approverType: 'direct_superior',
      approvalMode: 'serial',
      canSkip: false,
    },
    fields: [
      { key: 'label', label: '节点名称', type: 'text', required: true, placeholder: '如：直属上级审批' },
      {
        key: 'approverType',
        label: '审批人类型',
        type: 'select',
        options: [
          { label: '直属上级', value: 'direct_superior' },
          { label: '指定角色', value: 'role' },
          { label: '指定人员', value: 'person' },
          { label: '部门负责人', value: 'dept_head' },
          { label: '申请人本人', value: 'applicant' },
        ],
      },
      {
        key: 'approverValue',
        label: '审批人',
        type: 'text',
        placeholder: '选择角色或人员ID',
        showWhen: (data) => data.approverType === 'role' || data.approverType === 'person',
      },
      {
        key: 'approvalMode',
        label: '审批模式',
        type: 'select',
        options: [
          { label: '依次审批', value: 'serial' },
          { label: '会签（全部同意）', value: 'all' },
          { label: '或签（任一同意）', value: 'any_one' },
        ],
      },
      { key: 'canSkip', label: '允许跳过', type: 'switch' },
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
      { key: 'label', label: '节点名称', type: 'text', required: true },
      {
        key: 'conditionField',
        label: '判断字段',
        type: 'select',
        options: [
          { label: '金额', value: 'amount' },
          { label: '天数', value: 'days' },
          { label: '类型', value: 'type' },
          { label: '部门', value: 'department' },
        ],
      },
      {
        key: 'conditionOperator',
        label: '判断方式',
        type: 'select',
        options: [
          { label: '大于', value: '>' },
          { label: '小于', value: '<' },
          { label: '等于', value: '=' },
          { label: '大于等于', value: '>=' },
          { label: '小于等于', value: '<=' },
          { label: '不等于', value: '!=' },
        ],
      },
      { key: 'conditionValue', label: '判断值', type: 'text', placeholder: '如：1000' },
    ],
  },
  {
    type: 'parallel',
    label: '并行审批',
    icon: <IconTool />,
    color: '#722ed1',
    defaultData: {
      label: '并行审批',
      branches: [
        { id: 'p1', label: '分支1' },
        { id: 'p2', label: '分支2' },
      ],
    },
    fields: [{ key: 'label', label: '节点名称', type: 'text', required: true }],
  },
  {
    type: 'notify',
    label: '通知节点',
    icon: <IconNotification />,
    color: '#0fc6c2',
    defaultData: { label: '发送通知', notifyType: 'email' },
    fields: [
      { key: 'label', label: '通知名称', type: 'text', required: true },
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
    ],
  },
]

/** 判断节点是否为 React Flow 格式（拥有 position 字段） */
function isFlowCanvasNode(node: any): boolean {
  return node && typeof node.position === 'object' && node.position !== null
}

/** 根据审批流数据构建 FlowCanvas 初始图数据 */
function buildInitialGraph(flow: ApprovalFlow | null): {
  nodes: FlowNodeData[]
  edges: FlowEdgeData[]
} {
  if (!flow) return { nodes: defaultFlowNodes, edges: defaultFlowEdges }

  const nodes = flow.nodes ?? []
  const edges = flow.edges ?? []
  const hasValidGraph =
    nodes.length > 0 && edges.length > 0 && nodes.every(isFlowCanvasNode)

  if (hasValidGraph) {
    return { nodes: nodes as FlowNodeData[], edges: edges as FlowEdgeData[] }
  }
  return { nodes: defaultFlowNodes, edges: defaultFlowEdges }
}

function Flow() {
  const [data, setData] = useState<ApprovalFlow[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentFlow, setCurrentFlow] = useState<ApprovalFlow | null>(null)
  const [savingFlow, setSavingFlow] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getApprovalFlows()
      setData(res.data)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const { visible, editingId, openCreate, openEdit, close, handleOk } = useCrudModal<ApprovalFlow>({
    form,
    initialValues: { type: 'leave', status: 'active', isDefault: false },
    mapRecordToForm: (record) => ({
      name: record.name,
      type: record.type,
      description: record.description,
      isDefault: record.isDefault,
      status: record.status,
    }),
    onSubmit: async (_values, id) => {
      if (id) {
        await updateApprovalFlow(id, _values)
        toast.success('编辑成功')
        fetchData()
      } else {
        const res = await createApprovalFlow(_values as any)
        toast.success('新增成功，请配置流程节点')
        fetchData()
        // 新建后直接打开画布编辑器
        if (res?.data) {
          setCurrentFlow(res.data)
          setDetailVisible(true)
        }
      }
    },
  })

  const columns: TableProps<ApprovalFlow>['columns'] = [
    {
      title: '流程名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => (
        <Tag color={typeColorMap[value] || 'gray'}>
          {typeNameMap[value] || value}
        </Tag>
      ),
    },
    {
      title: '审批节点',
      dataIndex: 'nodes',
      render: (nodes: any[]) => (
        <Space size={4} wrap>
          {nodes?.length ? (
            nodes
              .filter((n) => {
                const t = n?.data?.nodeType ?? n?.nodeType
                return t !== 'start' && t !== 'end'
              })
              .map((node: any, index: number) => (
                <Tag key={index} size="small">
                  {node?.data?.label ?? node?.nodeName}
                </Tag>
              ))
          ) : (
            <Tag size="small" color="gray">暂无节点</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '默认流程',
      dataIndex: 'isDefault',
      width: 100,
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'gray'}>
          {value ? '是' : '否'}
        </Tag>
      ),
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
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (value: string) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, record: ApprovalFlow) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconSettings />}
            onClick={() => handleDetail(record)}
          >
            配置
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            status="danger"
            icon={<IconDelete />}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const handleDetail = (record: ApprovalFlow) => {
    setCurrentFlow(record)
    setDetailVisible(true)
  }

  // FlowCanvas 的初始图数据
  const initialGraph = useMemo(() => buildInitialGraph(currentFlow), [currentFlow])

  // 保存流程画布配置
  const handleSaveFlow = useCallback(
    async (nodes: FlowNodeData[], edges: FlowEdgeData[]) => {
      if (!currentFlow) return
      setSavingFlow(true)
      try {
        await updateApprovalFlow(currentFlow.id, { nodes, edges })
        toast.success('流程配置保存成功')
        setDetailVisible(false)
        fetchData()
      } catch (e) {
        catchError(e, {
          component: 'ApprovalFlow',
          operation: '保存流程配置',
          silent: true,
        })
        toast.error('保存流程配置失败')
      } finally {
        setSavingFlow(false)
      }
    },
    [currentFlow],
  )

  const handleCancelFlow = useCallback(() => {
    setDetailVisible(false)
  }, [])

  return (
    <div className={styles['approval-flow']}>
      <Card bordered={false} className={styles['approval-flow__card']}>
        <div className={styles['approval-flow__header']}>
          <div>
            <span className={styles['approval-flow__title']}>审批流程配置</span>
            <Tag color="blue" className={styles['approval-flow__total-tag']}>
              共 {data.length} 个流程
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={openCreate}>
            新增流程
          </Button>
        </div>

        <Table
          loading={loading}
          columns={columns}
          data={data}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal focusLock
        title={editingId ? '编辑流程' : '新增流程'}
        visible={visible}
        onOk={handleOk}
        onCancel={close}
        className={styles['approval-flow__modal']}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="流程名称"
                field="name"
                rules={[{ required: true, message: '请输入流程名称' }]}
              >
                <Input placeholder="请输入流程名称" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="流程类型"
                field="type"
                initialValue="leave"
                rules={[{ required: true, message: '请选择流程类型' }]}
              >
                <Select>
                  <Option value="leave">请假</Option>
                  <Option value="overtime">加班</Option>
                  <Option value="reimbursement">报销</Option>
                  <Option value="shift">调班</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <FormItem label="流程描述" field="description">
            <Input.TextArea placeholder="请输入流程描述" rows={3} />
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="状态" field="status" initialValue="active">
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="设为默认" field="isDefault" initialValue={false}>
                <Switch />
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`流程配置 - ${currentFlow?.name ?? ''}`}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        style={{ width: '100vw', maxWidth: '100vw', top: 0, paddingBottom: 0 }}
        footer={null}
        unmountOnExit
        maskClosable={false}
      >
        <div style={{ position: 'relative', height: 'calc(100vh - 55px)', width: '100%' }}>
          {currentFlow && (
            <FlowCanvas
              initialNodes={initialGraph.nodes}
              initialEdges={initialGraph.edges}
              nodeTypes={nodeTypes}
              onSave={handleSaveFlow}
              onCancel={handleCancelFlow}
              title={currentFlow.name}
            />
          )}
          {savingFlow && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(255,255,255,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: 8,
              }}
            >
              保存中...
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default Flow
