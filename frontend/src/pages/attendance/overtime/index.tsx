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
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

interface OvertimeRecord {
  id: number
  employeeName: string
  employeeNo: string
  department: string
  overtimeType: string
  date: string
  startTime: string
  endTime: string
  hours: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  createTime: string
}

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '审批中', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  cancelled: { text: '已撤销', color: 'gray' },
}

const overtimeTypes = ['工作日加班', '周末加班', '节假日加班']

const mockData: OvertimeRecord[] = [
  { id: 1, employeeName: '张三', employeeNo: 'EMP001', department: '技术部', overtimeType: '工作日加班', date: '2024-06-20', startTime: '18:30', endTime: '21:00', hours: 2.5, reason: '项目紧急上线', status: 'approved', createTime: '2024-06-20 09:00' },
  { id: 2, employeeName: '李四', employeeNo: 'EMP002', department: '产品部', overtimeType: '周末加班', date: '2024-06-22', startTime: '10:00', endTime: '18:00', hours: 8, reason: '版本迭代', status: 'pending', createTime: '2024-06-21 16:00' },
  { id: 3, employeeName: '赵六', employeeNo: 'EMP004', department: '技术部', overtimeType: '工作日加班', date: '2024-06-19', startTime: '19:00', endTime: '22:00', hours: 3, reason: '修复bug', status: 'approved', createTime: '2024-06-19 18:00' },
  { id: 4, employeeName: '王五', employeeNo: 'EMP003', department: '市场部', overtimeType: '节假日加班', date: '2024-06-10', startTime: '09:00', endTime: '18:00', hours: 8, reason: '活动筹备', status: 'rejected', createTime: '2024-06-08 10:00' },
  { id: 5, employeeName: '吴十', employeeNo: 'EMP008', department: '运营部', overtimeType: '工作日加班', date: '2024-06-21', startTime: '18:30', endTime: '20:30', hours: 2, reason: '活动运营', status: 'pending', createTime: '2024-06-21 09:30' },
]

function Overtime() {
  const [data, setData] = useState<OvertimeRecord[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<OvertimeRecord[]>(mockData)

  const columns: TableProps<OvertimeRecord>['columns'] = [
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
      title: '加班类型',
      dataIndex: 'overtimeType',
      width: 110,
      render: (value: string) => <Tag color="orange">{value}</Tag>,
    },
    {
      title: '加班日期',
      dataIndex: 'date',
      width: 110,
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      width: 100,
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      width: 100,
    },
    {
      title: '时长(h)',
      dataIndex: 'hours',
      width: 90,
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
      title: '操作',
      width: 150,
      render: (_: any, record: OvertimeRecord) => (
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
                content="确定要撤销该加班申请吗？"
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

  const handleEdit = (record: OvertimeRecord) => {
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
          createTime: new Date().toLocaleString(),
          ...values,
        } as OvertimeRecord
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
          <FormItem label="加班日期">
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>加班记录</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {filteredData.length} 条
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            申请加班
          </Button>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑加班' : '申请加班'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        style={{ width: 560 }}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="加班类型"
                field="overtimeType"
                rules={[{ required: true, message: '请选择加班类型' }]}
              >
                <Select placeholder="请选择">
                  {overtimeTypes.map((type) => (
                    <Option key={type} value={type}>{type}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="加班日期"
                field="date"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="开始时间"
                field="startTime"
                rules={[{ required: true, message: '请输入开始时间' }]}
              >
                <Input placeholder="如 18:30" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="结束时间"
                field="endTime"
                rules={[{ required: true, message: '请输入结束时间' }]}
              >
                <Input placeholder="如 21:00" />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="加班时长" field="hours">
            <Input type="number" placeholder="请输入时长" suffix="小时" />
          </FormItem>
          <FormItem label="加班原因" field="reason">
            <Input.TextArea placeholder="请输入加班原因" rows={4} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default Overtime
