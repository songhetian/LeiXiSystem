import { useState, useEffect, useCallback } from 'react'
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
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getApprovalFlows, createApprovalFlow, updateApprovalFlow } from '@/api/approval'
import type { ApprovalFlow } from '@/api/approval'
import { useCrudModal } from '@/hooks/useCrudModal'
import { WorkflowDesigner } from '@/components'
import type { WorkflowNode } from '@/components/WorkflowDesigner'
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

function Flow() {
  const [data, setData] = useState<ApprovalFlow[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentFlow, setCurrentFlow] = useState<ApprovalFlow | null>(null)

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
        toast.info('编辑功能开发中')
      } else {
        // 此处仅使用 values 但 lint 警告
        await createApprovalFlow(_values as any)
        toast.success('新增成功')
        fetchData()
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
            nodes.map((node: any, index: number) => (
              <Tag key={index} size="small">{node.nodeName}</Tag>
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
      render: (value: string) => value ? new Date(value).toLocaleString() : '-',
    },
    {
      title: '操作',
      width: 200,
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

  const [savingFlow, setSavingFlow] = useState(false)

  // Convert API ApprovalFlowNode[] to WorkflowNode[] for the designer
  const flowToWorkflowNodes = useCallback((flow: ApprovalFlow): WorkflowNode[] => {
    const startNode: WorkflowNode = { id: 'start', type: 'start', name: '开始' }
    const endNode: WorkflowNode = { id: 'end', type: 'end', name: '结束' }

    const middle: WorkflowNode[] = (flow.nodes ?? []).map((n) => ({
      id: `api_node_${n.id}`,
      type: n.nodeType === 'condition' ? 'condition' as const : 'approval' as const,
      name: n.nodeName,
      approverType: (n.approverType as WorkflowNode['approverType']) ?? undefined,
    }))

    // If no existing nodes, return default workflow
    if (middle.length === 0) {
      return [
        startNode,
        { id: 'default_1', type: 'approval', name: '直属上级审批', approverType: 'direct_superior' },
        { id: 'default_2', type: 'approval', name: '部门负责人审批', approverType: 'dept_head' },
        endNode,
      ]
    }

    return [startNode, ...middle, endNode]
  }, [])

  const handleSaveWorkflow = useCallback(async (workflowNodes: WorkflowNode[]) => {
    if (!currentFlow) return
    setSavingFlow(true)
    try {
      // Convert WorkflowNode[] back to API format
      const apiNodes = workflowNodes
        .filter((n) => n.type !== 'start' && n.type !== 'end')
        .map((n, index) => ({
          nodeName: n.name,
          nodeType: n.type,
          nodeOrder: index,
          approverType: n.approverType,
          conditions: n.conditions ? JSON.stringify(n.conditions) : undefined,
        }))

      await updateApprovalFlow(currentFlow.id, { nodes: apiNodes })
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
  }, [currentFlow])

  const handleCancelWorkflow = useCallback(() => {
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
        title={`流程配置 - ${currentFlow?.name}`}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        className={styles['approval-flow__detail-modal']}
        style={{ width: '80vw', maxWidth: 1200 }}
        footer={null}
        unmountOnExit
      >
        {currentFlow && (
          <div style={{ height: '70vh', minHeight: 500 }}>
            <WorkflowDesigner
              initialNodes={flowToWorkflowNodes(currentFlow)}
              onSave={handleSaveWorkflow}
              onCancel={handleCancelWorkflow}
            />
          </div>
        )}
        {savingFlow && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: 8,
          }}>
            保存中...
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Flow
