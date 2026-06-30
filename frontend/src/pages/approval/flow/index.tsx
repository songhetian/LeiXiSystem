import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Select,
  Space,
  Modal,
  Form,
  Message,
  Tag,
  Card,
  Grid,
  Steps,
  Input,
  Divider,
  Switch,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconSettings,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getApprovalFlows, createApprovalFlow } from '@/api/approval'
import type { ApprovalFlow } from '@/api/approval'
import './flow.css'

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
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
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
            onClick={() => handleEdit(record)}
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

  const handleAdd = () => {
    setEditingId(null)
    form.resetFields()
    setVisible(true)
  }

  const handleEdit = (record: ApprovalFlow) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      description: record.description,
      isDefault: record.isDefault,
      status: record.status,
    })
    setVisible(true)
  }

  const handleDetail = (record: ApprovalFlow) => {
    setCurrentFlow(record)
    setDetailVisible(true)
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      if (editingId) {
        Message.info('编辑功能开发中')
      } else {
        await createApprovalFlow(values)
        Message.success('新增成功')
        fetchData()
      }
      setVisible(false)
    } catch {
      // validation error
    }
  }

  const stepNodes = currentFlow?.nodes?.length
    ? currentFlow.nodes.map((n) => n.nodeName)
    : ['提交申请', '审批', '完成']

  return (
    <div className="approval-flow">
      <Card bordered={false} className="approval-flow__card">
        <div className="approval-flow__header">
          <div>
            <span className="approval-flow__title">审批流程配置</span>
            <Tag color="blue" className="approval-flow__total-tag">
              共 {data.length} 个流程
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
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

      <Modal
        title={editingId ? '编辑流程' : '新增流程'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        className="approval-flow__modal"
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
        className="approval-flow__detail-modal"
        footer={[
          <Button key="cancel" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          <Button
            key="ok"
            type="primary"
            onClick={() => {
              Message.success('保存成功')
              setDetailVisible(false)
            }}
          >
            保存配置
          </Button>,
        ]}
      >
        {currentFlow && (
          <Space direction="vertical" size={20} className="approval-flow__space">
            <div>
              <div className="approval-flow__section-title">审批流程</div>
              <Steps current={stepNodes.length - 1}>
                {stepNodes.map((step: string, index: number) => (
                  <Steps.Step key={index} title={step} />
                ))}
              </Steps>
            </div>
            <Divider />
            <div>
              <div className="approval-flow__section-title">节点配置</div>
              <Table
                size="small"
                columns={[
                  { title: '节点名称', dataIndex: 'name' },
                  { title: '审批人', dataIndex: 'approver' },
                  {
                    title: '操作',
                    width: 100,
                    render: () => <Button type="text" size="small">配置</Button>,
                  },
                ]}
                data={stepNodes.map((step: string, index: number) => ({
                  key: index,
                  name: step,
                  approver:
                    index === 0
                      ? '申请人'
                      : index === stepNodes.length - 1
                      ? '系统'
                      : '直属上级',
                }))}
                pagination={false}
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default Flow
