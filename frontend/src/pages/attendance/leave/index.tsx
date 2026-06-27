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
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconDelete,
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

interface LeaveRecord {
  id: number
  employeeName: string
  employeeNo: string
  department: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  applicant: string
  createTime: string
}

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '审批中', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  cancelled: { text: '已撤销', color: 'gray' },
}

const leaveTypes = ['年假', '事假', '病假', '婚假', '产假', '丧假', '调休']

const mockData: LeaveRecord[] = [
  { id: 1, employeeName: '张三', employeeNo: 'EMP001', department: '技术部', leaveType: '年假', startDate: '2024-06-25', endDate: '2024-06-27', days: 3, reason: '家中有事', status: 'pending', applicant: '张三', createTime: '2024-06-20 10:30' },
  { id: 2, employeeName: '李四', employeeNo: 'EMP002', department: '产品部', leaveType: '病假', startDate: '2024-06-18', endDate: '2024-06-18', days: 1, reason: '身体不适', status: 'approved', applicant: '李四', createTime: '2024-06-17 16:00' },
  { id: 3, employeeName: '王五', employeeNo: 'EMP003', department: '市场部', leaveType: '事假', startDate: '2024-06-15', endDate: '2024-06-16', days: 2, reason: '处理私事', status: 'rejected', applicant: '王五', createTime: '2024-06-14 09:00' },
  { id: 4, employeeName: '赵六', employeeNo: 'EMP004', department: '技术部', leaveType: '调休', startDate: '2024-06-21', endDate: '2024-06-21', days: 1, reason: '周末加班调休', status: 'approved', applicant: '赵六', createTime: '2024-06-19 14:00' },
  { id: 5, employeeName: '钱七', employeeNo: 'EMP005', department: '人事部', leaveType: '年假', startDate: '2024-07-01', endDate: '2024-07-05', days: 5, reason: '外出旅游', status: 'pending', applicant: '钱七', createTime: '2024-06-20 11:00' },
]

function Leave() {
  const [data, setData] = useState<LeaveRecord[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<LeaveRecord[]>(mockData)

  const columns: TableProps<LeaveRecord>['columns'] = [
    {
      title: '申请人',
      dataIndex: 'employeeName',
      width: 100,
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 100,
    },
    {
      title: '假别',
      dataIndex: 'leaveType',
      width: 90,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '开始时间',
      dataIndex: 'startDate',
      width: 110,
    },
    {
      title: '结束时间',
      dataIndex: 'endDate',
      width: 110,
    },
    {
      title: '天数',
      dataIndex: 'days',
      width: 80,
      render: (value: number) => `${value} 天`,
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
      title: '申请时间',
      dataIndex: 'createTime',
      width: 140,
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: LeaveRecord) => (
        <Space size="small">
          <Button type="text" size="small" icon={<IconEye />}>
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="text"
                size="small"
                icon={<IconEdit />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
              <Popconfirm
                title="确认撤销"
                content="确定要撤销该请假申请吗？"
                onOk={() => handleCancel(record.id)}
              >
                <Button type="text" size="small" status="danger">
                  撤销
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    setEditingId(null)
    form.resetFields()
    setVisible(true)
  }

  const handleEdit = (record: LeaveRecord) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setVisible(true)
  }

  const handleCancel = (id: number) => {
    setData(data.map((item) => (item.id === id ? { ...item, status: 'cancelled' } : item)))
    setFilteredData(filteredData.map((item) => (item.id === id ? { ...item, status: 'cancelled' } : item)))
    Message.success('撤销成功')
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      if (editingId) {
        setData(data.map((item) => (item.id === editingId ? { ...item, ...values } : item)))
        setFilteredData(filteredData.map((item) => (item.id === editingId ? { ...item, ...values } : item)))
        Message.success('修改成功')
      } else {
        const newId = Math.max(...data.map((d) => d.id)) + 1
        const newRecord = {
          id: newId,
          employeeName: '当前用户',
          employeeNo: 'EMP000',
          department: '技术部',
          status: 'pending',
          applicant: '当前用户',
          createTime: new Date().toLocaleString(),
          ...values,
        } as LeaveRecord
        setData([newRecord, ...data])
        setFilteredData([newRecord, ...filteredData])
        Message.success('申请成功')
      }
      setVisible(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSearch = () => {
    let result = data
    if (searchText) {
      result = result.filter(
        (item) =>
          item.employeeName.includes(searchText) ||
          item.employeeNo.includes(searchText),
      )
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
              placeholder="姓名/工号"
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
              <Option value="pending">审批中</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已驳回</Option>
              <Option value="cancelled">已撤销</Option>
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>请假记录</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {filteredData.length} 条
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            申请请假
          </Button>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑请假' : '申请请假'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        style={{ width: 560 }}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="假别"
            field="leaveType"
            rules={[{ required: true, message: '请选择假别' }]}
          >
            <Select placeholder="请选择假别">
              {leaveTypes.map((type) => (
                <Option key={type} value={type}>{type}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem
            label="请假时间"
            field="dateRange"
            rules={[{ required: true, message: '请选择请假时间' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="请假天数" field="days">
                <Input type="number" placeholder="请输入天数" suffix="天" />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="请假原因" field="reason">
            <Input.TextArea placeholder="请输入请假原因" rows={4} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default Leave
