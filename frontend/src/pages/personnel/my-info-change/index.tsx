import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
} from '@arco-design/web-react'
import {
  getInfoChanges,
  createInfoChange,
  cancelInfoChange,
  EmployeeInfoChangeRequest,
} from '@/api/employee-change'
import { PageHeader, TableHeader } from '@/components'
import { toast } from '@/utils/toast'
import './index.css'

const FormItem = Form.Item
const TabPane = Tabs.TabPane
const Option = Select.Option

const typeMap: Record<string, { text: string; color: string }> = {
  basic_info: { text: '基本信息', color: 'blue' },
  contact_info: { text: '联系信息', color: 'green' },
  position_info: { text: '职位信息', color: 'orange' },
  other: { text: '其他', color: 'gray' },
}

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  cancelled: { text: '已撤销', color: 'gray' },
}

// 可变更的字段配置
const FIELD_CONFIG = {
  basic_info: [
    { field: 'gender', label: '性别' },
    { field: 'birthDate', label: '生日' },
    { field: 'idCardNo', label: '身份证号' },
    { field: 'nationality', label: '国籍' },
    { field: 'maritalStatus', label: '婚姻状况' },
    { field: 'education', label: '学历' },
  ],
  contact_info: [
    { field: 'phone', label: '手机号' },
    { field: 'email', label: '邮箱' },
    { field: 'address', label: '地址' },
    { field: 'emergencyContact', label: '紧急联系人' },
    { field: 'emergencyPhone', label: '紧急联系电话' },
  ],
  position_info: [
    { field: 'bankName', label: '开户银行' },
    { field: 'bankAccountNo', label: '银行账号' },
  ],
  other: [
    { field: 'skills', label: '技能特长' },
    { field: 'remark', label: '备注' },
  ],
}

function MyInfoChangePage() {
  const [data, setData] = useState<EmployeeInfoChangeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [createVisible, setCreateVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<EmployeeInfoChangeRequest | null>(null)
  const [form] = Form.useForm()

  const loadData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getInfoChanges({ page, pageSize, scope: 'mine' })
      setData(res.data.list || [])
      setPagination({
        current: res.data.page || page,
        pageSize: res.data.pageSize || pageSize,
        total: res.data.total || 0,
      })
    } catch (e: any) {
      toast.error(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePageChange = (page: number, pageSize: number) => {
    loadData(page, pageSize)
  }

  const handleView = (record: EmployeeInfoChangeRequest) => {
    setCurrentRecord(record)
    setDetailVisible(true)
  }

  const handleCancel = async (id: number) => {
    try {
      await cancelInfoChange(id)
      toast.success('已撤销申请')
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      toast.error(e?.message || '撤销失败')
    }
  }

  const handleCreate = async () => {
    try {
      const values = await form.validate()
      await createInfoChange({
        employeeId: values.employeeId,
        type: values.type,
        changeData: values.changeData,
        reason: values.reason,
      })
      toast.success('申请已提交')
      setCreateVisible(false)
      form.resetFields()
      loadData(pagination.current, pagination.pageSize)
    } catch (e: any) {
      toast.error(e?.message || '提交失败')
    }
  }

  const columns = [
    {
      title: '变更类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => {
        const info = typeMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '变更内容',
      dataIndex: 'changeData',
      width: 200,
      render: (value: Record<string, any>) => {
        const keys = Object.keys(value).slice(0, 2)
        return keys.map((k) => k).join(', ') + (Object.keys(value).length > 2 ? '...' : '')
      },
    },
    {
      title: '申请原因',
      dataIndex: 'reason',
      width: 150,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => {
        const info = statusMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: EmployeeInfoChangeRequest) => (
        <Space>
          <Button type="text" size="small" onClick={() => handleView(record)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <Button type="text" size="small" status="danger" onClick={() => handleCancel(record.id)}>
              撤销
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="my-info-change">
      <Card bordered={false}>
        <PageHeader
          title="我的信息变更"
          description="提交个人信息变更申请，审批通过后自动更新。"
        />
      </Card>

      <Card bordered={false}>
        <TableHeader
          title="变更记录"
          total={pagination.total}
          totalText="条"
          extra={
            <Button type="primary" onClick={() => setCreateVisible(true)}>
              提交变更申请
            </Button>
          }
        />

        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={columns}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
        />
      </Card>

      {/* 创建申请弹窗 */}
      <Modal
        title="提交信息变更申请"
        visible={createVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateVisible(false)
          form.resetFields()
        }}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="变更类型"
            field="type"
            rules={[{ required: true, message: '请选择变更类型' }]}
          >
            <Select placeholder="请选择变更类型">
              <Option value="basic_info">基本信息</Option>
              <Option value="contact_info">联系信息</Option>
              <Option value="position_info">职位信息</Option>
              <Option value="other">其他</Option>
            </Select>
          </FormItem>

          <FormItem
            label="变更原因"
            field="reason"
            rules={[{ required: true, message: '请输入变更原因' }]}
          >
            <Input.TextArea placeholder="请输入变更原因" rows={2} />
          </FormItem>

          <FormItem
            label="变更字段"
            field="changeData"
            rules={[{ required: true, message: '请输入变更内容' }]}
          >
            <Input.TextArea placeholder={'格式示例: {"phone": "13800138000"}'} rows={3} />
          </FormItem>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="变更申请详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
      >
        {currentRecord && (
          <Descriptions
            column={2}
            border
            data={[
              { label: '变更类型', value: typeMap[currentRecord.type]?.text || currentRecord.type },
              {
                label: '状态',
                value: (
                  <Tag color={statusMap[currentRecord.status]?.color}>
                    {statusMap[currentRecord.status]?.text || currentRecord.status}
                  </Tag>
                ),
              },
              { label: '申请原因', value: currentRecord.reason || '-', span: 2 },
              { label: '审批意见', value: currentRecord.approvalComment || '-', span: 2 },
              { label: '申请时间', value: new Date(currentRecord.createdAt).toLocaleString(), span: 2 },
            ] as any}
          />
        )}
      </Modal>
    </div>
  )
}

export default MyInfoChangePage
