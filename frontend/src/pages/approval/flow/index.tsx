import { useState } from 'react'
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
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconSettings,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface ApprovalFlow {
  id: number
  name: string
  type: string
  steps: string[]
  status: 'active' | 'inactive'
  updateTime: string
}

const mockData: ApprovalFlow[] = [
  {
    id: 1,
    name: '请假审批流程',
    type: 'leave',
    steps: ['提交申请', '直属上级审批', '人事备案', '完成'],
    status: 'active',
    updateTime: '2024-06-01 10:00',
  },
  {
    id: 2,
    name: '加班审批流程',
    type: 'overtime',
    steps: ['提交申请', '直属上级审批', '人事备案', '完成'],
    status: 'active',
    updateTime: '2024-06-01 10:00',
  },
  {
    id: 3,
    name: '报销审批流程',
    type: 'reimbursement',
    steps: ['提交申请', '直属上级审批', '财务审核', '完成支付'],
    status: 'active',
    updateTime: '2024-06-15 14:00',
  },
  {
    id: 4,
    name: '调班审批流程',
    type: 'shift',
    steps: ['提交申请', '直属上级审批', '人事备案', '完成'],
    status: 'active',
    updateTime: '2024-06-01 10:00',
  },
  {
    id: 5,
    name: '大额报销流程',
    type: 'reimbursement',
    steps: ['提交申请', '直属上级审批', '部门总监审批', '财务审核', '总经理审批', '完成支付'],
    status: 'inactive',
    updateTime: '2024-05-20 09:00',
  },
]

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
  const [data, setData] = useState<ApprovalFlow[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentFlow, setCurrentFlow] = useState<ApprovalFlow | null>(null)

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
        <Tag color={typeColorMap[value]}>{typeNameMap[value]}</Tag>
      ),
    },
    {
      title: '审批节点',
      dataIndex: 'steps',
      render: (value: string[]) => (
        <Space size={4}>
          {value.map((step, index) => (
            <Tag key={index} size="small">{step}</Tag>
          ))}
        </Space>
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
      dataIndex: 'updateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, record: ApprovalFlow) => (
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
    form.setFieldsValue(record)
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
        setData(data.map((item) => (item.id === editingId ? { ...item, ...values, updateTime: new Date().toLocaleString() } : item)))
        Message.success('修改成功')
      } else {
        const newId = Math.max(...data.map((d) => d.id)) + 1
        const newRecord = {
          id: newId,
          steps: ['提交申请', '审批', '完成'],
          updateTime: new Date().toLocaleString(),
          ...values,
        } as ApprovalFlow
        setData([...data, newRecord])
        Message.success('新增成功')
      }
      setVisible(false)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>审批流程配置</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {data.length} 个流程
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增流程
          </Button>
        </div>

        <Table columns={columns} data={data} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑流程' : '新增流程'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        width={560}
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
          <FormItem label="状态" field="status" initialValue="active">
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </FormItem>
        </Form>
      </Modal>

      <Modal
        title={`流程配置 - ${currentFlow?.name}`}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          <Button key="ok" type="primary" onClick={() => { Message.success('保存成功'); setDetailVisible(false) }}>
            保存配置
          </Button>,
        ]}
      >
        {currentFlow && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 12, fontWeight: 600 }}>审批流程</div>
              <Steps current={currentFlow.steps.length - 1}>
                {currentFlow.steps.map((step, index) => (
                  <Steps.Step key={index} title={step} />
                ))}
              </Steps>
            </div>
            <Divider />
            <div>
              <div style={{ marginBottom: 12, fontWeight: 600 }}>节点配置</div>
              <Table
                size="small"
                columns={[
                  { title: '节点名称', dataIndex: 'name' },
                  { title: '审批人', dataIndex: 'approver' },
                  { title: '操作', width: 100, render: () => <Button type="text" size="small">配置</Button> },
                ]}
                data={currentFlow.steps.map((step, index) => ({
                  key: index,
                  name: step,
                  approver: index === 0 ? '申请人' : index === currentFlow.steps.length - 1 ? '系统' : '直属上级',
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
