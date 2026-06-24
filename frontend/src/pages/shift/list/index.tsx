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
  Switch,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconDelete,
  IconClockCircle,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface Shift {
  id: number
  name: string
  code: string
  type: 'morning' | 'afternoon' | 'night' | 'double' | 'flexible'
  startTime: string
  endTime: string
  restStartTime: string
  restEndTime: string
  workHours: number
  lateGrace: number
  earlyGrace: number
  isDefault: boolean
  status: 'active' | 'inactive'
}

const typeMap: Record<string, { text: string; color: string }> = {
  morning: { text: '早班', color: 'blue' },
  afternoon: { text: '午班', color: 'orange' },
  night: { text: '夜班', color: 'purple' },
  double: { text: '两班倒', color: 'red' },
  flexible: { text: '弹性', color: 'green' },
}

const mockData: Shift[] = [
  { id: 1, name: '标准早班', code: 'MORNING', type: 'morning', startTime: '09:00', endTime: '18:00', restStartTime: '12:00', restEndTime: '13:30', workHours: 7.5, lateGrace: 10, earlyGrace: 5, isDefault: true, status: 'active' },
  { id: 2, name: '午班', code: 'AFTERNOON', type: 'afternoon', startTime: '14:00', endTime: '23:00', restStartTime: '18:00', restEndTime: '19:00', workHours: 8, lateGrace: 5, earlyGrace: 5, isDefault: false, status: 'active' },
  { id: 3, name: '夜班', code: 'NIGHT', type: 'night', startTime: '22:00', endTime: '07:00', restStartTime: '02:00', restEndTime: '03:00', workHours: 8, lateGrace: 5, earlyGrace: 5, isDefault: false, status: 'active' },
  { id: 4, name: '弹性工作制', code: 'FLEXIBLE', type: 'flexible', startTime: '09:00', endTime: '18:00', restStartTime: '12:00', restEndTime: '13:00', workHours: 8, lateGrace: 30, earlyGrace: 30, isDefault: false, status: 'active' },
  { id: 5, name: '行政班', code: 'ADMIN', type: 'morning', startTime: '09:00', endTime: '18:00', restStartTime: '12:00', restEndTime: '13:30', workHours: 7.5, lateGrace: 15, earlyGrace: 10, isDefault: false, status: 'inactive' },
]

function ShiftList() {
  const [data, setData] = useState<Shift[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchType, setSearchType] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<Shift[]>(mockData)

  const columns: TableProps<Shift>['columns'] = [
    {
      title: '班次名称',
      dataIndex: 'name',
      width: 140,
    },
    {
      title: '班次编码',
      dataIndex: 'code',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '班次类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => {
        const info = typeMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '上班时间',
      dataIndex: 'startTime',
      width: 100,
      render: (value: string) => (
        <Space size="small">
          <IconClockCircle style={{ color: '#00B42A' }} />
          {value}
        </Space>
      ),
    },
    {
      title: '下班时间',
      dataIndex: 'endTime',
      width: 100,
      render: (value: string) => (
        <Space size="small">
          <IconClockCircle style={{ color: '#FF7D00' }} />
          {value}
        </Space>
      ),
    },
    {
      title: '休息时间',
      width: 140,
      render: (_: any, record: Shift) => (
        <span>{record.restStartTime} - {record.restEndTime}</span>
      ),
    },
    {
      title: '工时(h)',
      dataIndex: 'workHours',
      width: 90,
    },
    {
      title: '默认班次',
      dataIndex: 'isDefault',
      width: 90,
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'gray'}>{value ? '是' : '否'}</Tag>
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
      title: '操作',
      width: 150,
      render: (_: any, record: Shift) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconEdit />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            content="确定要删除该班次吗？"
            onOk={() => handleDelete(record.id)}
          >
            <Button
              type="text"
              size="small"
              status="danger"
              icon={<IconDelete />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    setEditingId(null)
    form.resetFields()
    setVisible(true)
  }

  const handleEdit = (record: Shift) => {
    setEditingId(record.id)
    form.setFieldsValue(record)
    setVisible(true)
  }

  const handleDelete = (id: number) => {
    setData(data.filter((item) => item.id !== id))
    setFilteredData(filteredData.filter((item) => item.id !== id))
    Message.success('删除成功')
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
          isDefault: false,
          ...values,
        } as Shift
        setData([...data, newRecord])
        setFilteredData([...filteredData, newRecord])
        Message.success('新增成功')
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
          item.name.includes(searchText) ||
          item.code.includes(searchText),
      )
    }
    if (searchType) {
      result = result.filter((item) => item.type === searchType)
    }
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchType(undefined)
    setFilteredData(data)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="班次名称">
            <Input
              style={{ width: 180 }}
              placeholder="请输入名称/编码"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="班次类型">
            <Select
              style={{ width: 130 }}
              placeholder="请选择"
              value={searchType}
              onChange={setSearchType}
              allowClear
            >
              <Option value="morning">早班</Option>
              <Option value="afternoon">午班</Option>
              <Option value="night">夜班</Option>
              <Option value="double">两班倒</Option>
              <Option value="flexible">弹性</Option>
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>班次列表</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {filteredData.length} 个班次
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增班次
          </Button>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingId ? '编辑班次' : '新增班次'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="班次名称"
                field="name"
                rules={[{ required: true, message: '请输入班次名称' }]}
              >
                <Input placeholder="请输入班次名称" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="班次编码"
                field="code"
                rules={[{ required: true, message: '请输入班次编码' }]}
              >
                <Input placeholder="请输入班次编码" />
              </FormItem>
            </Col>
          </Row>
          <FormItem
            label="班次类型"
            field="type"
            initialValue="morning"
            rules={[{ required: true, message: '请选择班次类型' }]}
          >
            <Select>
              <Option value="morning">早班</Option>
              <Option value="afternoon">午班</Option>
              <Option value="night">夜班</Option>
              <Option value="double">两班倒</Option>
              <Option value="flexible">弹性</Option>
            </Select>
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="上班时间"
                field="startTime"
                rules={[{ required: true, message: '请输入上班时间' }]}
              >
                <Input placeholder="如 09:00" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="下班时间"
                field="endTime"
                rules={[{ required: true, message: '请输入下班时间' }]}
              >
                <Input placeholder="如 18:00" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="休息开始"
                field="restStartTime"
                rules={[{ required: true, message: '请输入休息开始时间' }]}
              >
                <Input placeholder="如 12:00" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="休息结束"
                field="restEndTime"
                rules={[{ required: true, message: '请输入休息结束时间' }]}
              >
                <Input placeholder="如 13:30" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <FormItem label="工时(小时)" field="workHours" initialValue={8}>
                <Input type="number" placeholder="请输入工时" />
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="迟到宽限(分钟)" field="lateGrace" initialValue={5}>
                <Input type="number" placeholder="宽限时间" />
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="早退宽限(分钟)" field="earlyGrace" initialValue={5}>
                <Input type="number" placeholder="宽限时间" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="是否默认班次" field="isDefault" initialValue={false}>
                <Switch />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="状态" field="status" initialValue="active">
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default ShiftList
