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
  Grid,
  DatePicker,
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

interface ShiftChange {
  id: number
  employeeName: string
  employeeNo: string
  department: string
  originalShift: string
  targetShift: string
  date: string
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

const shiftOptions = ['标准早班', '午班', '夜班', '弹性工作制']

const mockData: ShiftChange[] = [
  { id: 1, employeeName: '张三', employeeNo: 'EMP001', department: '技术部', originalShift: '标准早班', targetShift: '午班', date: '2024-06-25', reason: '有事需要下午处理', status: 'pending', createTime: '2024-06-20 10:30' },
  { id: 2, employeeName: '李四', employeeNo: 'EMP002', department: '产品部', originalShift: '标准早班', targetShift: '弹性工作制', date: '2024-06-22', reason: '近期需要居家办公', status: 'approved', createTime: '2024-06-18 16:00' },
  { id: 3, employeeName: '王五', employeeNo: 'EMP003', department: '市场部', originalShift: '标准早班', targetShift: '夜班', date: '2024-06-15', reason: '替同事值班', status: 'rejected', createTime: '2024-06-12 09:00' },
  { id: 4, employeeName: '赵六', employeeNo: 'EMP004', department: '技术部', originalShift: '午班', targetShift: '标准早班', date: '2024-06-21', reason: '个人原因', status: 'pending', createTime: '2024-06-19 14:00' },
]

function ShiftChange() {
  const [data, setData] = useState<ShiftChange[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<ShiftChange[]>(mockData)

  const columns: TableProps<ShiftChange>['columns'] = [
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
      title: '原班次',
      dataIndex: 'originalShift',
      width: 120,
      render: (value: string) => <Tag color="gray">{value}</Tag>,
    },
    {
      title: '调班后',
      dataIndex: 'targetShift',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '调班日期',
      dataIndex: 'date',
      width: 110,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => {
        const info = statusMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createTime',
      width: 150,
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: ShiftChange) => (
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
                content="确定要撤销该调班申请吗？"
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

  const handleEdit = (record: ShiftChange) => {
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
        } as ShiftChange
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>调班申请</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {filteredData.length} 条
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            申请调班
          </Button>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑调班' : '申请调班'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        style={{ width: 520 }}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="原班次"
                field="originalShift"
                rules={[{ required: true, message: '请选择原班次' }]}
              >
                <Select placeholder="请选择">
                  {shiftOptions.map((s) => (
                    <Option key={s} value={s}>{s}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="调班后班次"
                field="targetShift"
                rules={[{ required: true, message: '请选择目标班次' }]}
              >
                <Select placeholder="请选择">
                  {shiftOptions.map((s) => (
                    <Option key={s} value={s}>{s}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
          </Row>
          <FormItem
            label="调班日期"
            field="date"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </FormItem>
          <FormItem label="调班原因" field="reason">
            <Input.TextArea placeholder="请输入调班原因" rows={4} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default ShiftChange
