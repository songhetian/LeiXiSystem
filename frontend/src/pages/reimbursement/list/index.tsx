import { useState } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  Message,
  Tag,
  Popconfirm,
  Card,
  DatePicker,
  Grid,
  Upload,
  Steps,
  Descriptions,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEye,
  IconUpload,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

interface Reimbursement {
  id: number
  title: string
  applicant: string
  department: string
  type: string
  amount: number
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paid'
  createTime: string
  currentApprover: string
}

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  pending: { text: '审批中', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  paid: { text: '已支付', color: 'blue' },
}

const reimbursementTypes = ['差旅费', '交通费', '餐饮费', '办公用品', '招待费', '其他']

const mockData: Reimbursement[] = [
  { id: 1, title: '6月差旅报销', applicant: '张三', department: '技术部', type: '差旅费', amount: 2500, status: 'pending', createTime: '2024-06-20 10:30', currentApprover: '部门经理' },
  { id: 2, title: '客户招待费', applicant: '李四', department: '产品部', type: '招待费', amount: 800, status: 'approved', createTime: '2024-06-18 14:00', currentApprover: '-' },
  { id: 3, title: '办公用品采购', applicant: '钱七', department: '人事部', type: '办公用品', amount: 350, status: 'paid', createTime: '2024-06-15 09:00', currentApprover: '-' },
  { id: 4, title: '交通补贴', applicant: '王五', department: '市场部', type: '交通费', amount: 200, status: 'rejected', createTime: '2024-06-12 16:30', currentApprover: '-' },
  { id: 5, title: '加班打车费', applicant: '赵六', department: '技术部', type: '交通费', amount: 150, status: 'pending', createTime: '2024-06-21 18:00', currentApprover: '部门经理' },
  { id: 6, title: '出差餐饮', applicant: '吴十', department: '运营部', type: '餐饮费', amount: 450, status: 'draft', createTime: '2024-06-22 11:00', currentApprover: '-' },
]

function ListPage() {
  const [data, setData] = useState<Reimbursement[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<Reimbursement | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<Reimbursement[]>(mockData)

  const columns: TableProps<Reimbursement>['columns'] = [
    {
      title: '报销单标题',
      dataIndex: 'title',
      width: 180,
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 100,
    },
    {
      title: '报销类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '金额(元)',
      dataIndex: 'amount',
      width: 100,
      render: (value: number) => <span style={{ fontWeight: 600, color: '#FF7D00' }}>¥{value}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const info = statusMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '当前节点',
      dataIndex: 'currentApprover',
      width: 100,
    },
    {
      title: '申请时间',
      dataIndex: 'createTime',
      width: 150,
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: Reimbursement) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconEye />}
            onClick={() => handleView(record)}
          >
            详情
          </Button>
          {(record.status === 'draft' || record.status === 'rejected') && (
            <Popconfirm
              title="确认提交"
              content="确定要提交该报销单吗？"
              onOk={() => handleSubmit(record.id)}
            >
              <Button type="text" size="small">
                提交
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    form.resetFields()
    setVisible(true)
  }

  const handleView = (record: Reimbursement) => {
    setCurrentRecord(record)
    setDetailVisible(true)
  }

  const handleSubmit = (id: number) => {
    setData(data.map((item) => (item.id === id ? { ...item, status: 'pending', currentApprover: '部门经理' } : item)))
    setFilteredData(filteredData.map((item) => (item.id === id ? { ...item, status: 'pending', currentApprover: '部门经理' } : item)))
    Message.success('提交成功')
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      const newId = Math.max(...data.map((d) => d.id)) + 1
      const newRecord = {
        id: newId,
        applicant: '当前用户',
        department: '技术部',
        status: 'draft',
        currentApprover: '-',
        createTime: new Date().toLocaleString(),
        ...values,
      } as Reimbursement
      setData([newRecord, ...data])
      setFilteredData([newRecord, ...filteredData])
      Message.success('创建成功')
      setVisible(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSearch = () => {
    let result = data
    if (searchText) {
      result = result.filter((item) => item.title.includes(searchText) || item.applicant.includes(searchText))
    }
    if (searchStatus) {
      result = result.filter((item) => item.status === searchStatus)
    }
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchStatus(undefined)
    setFilteredData(data)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              style={{ width: 180 }}
              placeholder="标题/申请人"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              style={{ width: 130 }}
              placeholder="请选择"
              value={searchStatus}
              onChange={setSearchStatus}
              allowClear
            >
              <Option value="draft">草稿</Option>
              <Option value="pending">审批中</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已驳回</Option>
              <Option value="paid">已支付</Option>
            </Select>
          </FormItem>
          <FormItem label="申请时间">
            <RangePicker style={{ width: 220 }} />
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<IconRefresh />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>我的报销</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {filteredData.length} 条
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新建报销
          </Button>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title="新建报销"
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        style={{ width: 600 }}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="报销标题"
            field="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入报销标题" />
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="报销类型"
                field="type"
                rules={[{ required: true, message: '请选择类型' }]}
              >
                <Select placeholder="请选择">
                  {reimbursementTypes.map((type) => (
                    <Option key={type} value={type}>{type}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="报销金额"
                field="amount"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <Input type="number" placeholder="请输入金额" prefix="¥" />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="费用说明" field="description">
            <Input.TextArea placeholder="请输入费用说明" rows={3} />
          </FormItem>
          <FormItem label="凭证上传">
            <Upload
              listType="picture-card"
              multiple
              limit={5}
              customRequest={() => {}}
            >
              <div style={{ padding: '10px 0' }}>
                <IconUpload style={{ fontSize: 20 }} />
                <div style={{ marginTop: 4, fontSize: 12, color: '#86909C' }}>上传凭证</div>
              </div>
            </Upload>
          </FormItem>
        </Form>
      </Modal>

      <Modal
        title="报销详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        style={{ width: 600 }}
      >
        {currentRecord && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Steps current={2} style={{ marginBottom: 20 }}>
              <Steps.Step title="提交申请" description="2024-06-20 10:30" />
              <Steps.Step title="部门审批" description="2024-06-20 14:00" />
              <Steps.Step title="财务审核" description="审批中" />
              <Steps.Step title="完成支付" />
            </Steps>
            <Descriptions
              border
              column={2}
              data={[
                { label: '报销标题', value: currentRecord.title },
                { label: '申请人', value: currentRecord.applicant },
                { label: '部门', value: currentRecord.department },
                { label: '报销类型', value: currentRecord.type },
                { label: '金额', value: `¥${currentRecord.amount}` },
                { label: '状态', value: statusMap[currentRecord.status].text },
              ]}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default ListPage
