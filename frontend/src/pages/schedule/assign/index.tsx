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
  Card,
  Grid,
  Transfer,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconUser,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface ScheduleAssign {
  id: number
  employeeName: string
  employeeNo: string
  department: string
  position: string
  currentShift: string
  nextShift: string
  effectiveDate: string
}

const mockData: ScheduleAssign[] = [
  { id: 1, employeeName: '张三', employeeNo: 'EMP001', department: '技术部', position: '高级工程师', currentShift: '标准早班', nextShift: '标准早班', effectiveDate: '2024-06-01' },
  { id: 2, employeeName: '李四', employeeNo: 'EMP002', department: '产品部', position: '产品经理', currentShift: '标准早班', nextShift: '标准早班', effectiveDate: '2024-06-01' },
  { id: 3, employeeName: '王五', employeeNo: 'EMP003', department: '市场部', position: '市场专员', currentShift: '标准早班', nextShift: '弹性工作制', effectiveDate: '2024-07-01' },
  { id: 4, employeeName: '赵六', employeeNo: 'EMP004', department: '技术部', position: '前端工程师', currentShift: '标准早班', nextShift: '标准早班', effectiveDate: '2024-06-01' },
  { id: 5, employeeName: '钱七', employeeNo: 'EMP005', department: '人事部', position: '人事专员', currentShift: '标准早班', nextShift: '标准早班', effectiveDate: '2024-06-01' },
  { id: 6, employeeName: '孙八', employeeNo: 'EMP006', department: '财务部', position: '财务主管', currentShift: '标准早班', nextShift: '标准早班', effectiveDate: '2024-06-01' },
  { id: 7, employeeName: '吴十', employeeNo: 'EMP008', department: '运营部', position: '运营主管', currentShift: '弹性工作制', nextShift: '弹性工作制', effectiveDate: '2024-06-01' },
]

const shiftOptions = [
  { key: 'morning', name: '标准早班' },
  { key: 'afternoon', name: '午班' },
  { key: 'night', name: '夜班' },
  { key: 'flexible', name: '弹性工作制' },
]

function Assign() {
  const [data, setData] = useState<ScheduleAssign[]>(mockData)
  const [visible, setVisible] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()
  const [filteredData, setFilteredData] = useState<ScheduleAssign[]>(mockData)
  const [targetKeys, setTargetKeys] = useState<string[]>([])

  const columns: TableProps<ScheduleAssign>['columns'] = [
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
    },
    {
      title: '姓名',
      dataIndex: 'employeeName',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 100,
    },
    {
      title: '岗位',
      dataIndex: 'position',
      width: 120,
    },
    {
      title: '当前班次',
      dataIndex: 'currentShift',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '下一班次',
      dataIndex: 'nextShift',
      width: 120,
      render: (value: string) => <Tag color="green">{value}</Tag>,
    },
    {
      title: '生效日期',
      dataIndex: 'effectiveDate',
      width: 120,
    },
    {
      title: '操作',
      width: 100,
      render: () => (
        <Button type="text" size="small" icon={<IconUser />}>
          调整
        </Button>
      ),
    },
  ]

  const handleBatchAssign = () => {
    setTargetKeys([])
    setVisible(true)
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      Message.success('批量排班成功')
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
    if (searchDept) {
      result = result.filter((item) => item.department === searchDept)
    }
    setFilteredData(result)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
    setFilteredData(data)
  }

  const employees = data.map((item) => ({
    key: String(item.id),
    value: String(item.id),
    name: `${item.employeeName} (${item.employeeNo})`,
  }))

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
          <FormItem label="部门">
            <Select
              style={{ width: 130 }}
              placeholder="请选择"
              value={searchDept}
              onChange={setSearchDept}
              allowClear
            >
              <Option value="技术部">技术部</Option>
              <Option value="产品部">产品部</Option>
              <Option value="市场部">市场部</Option>
              <Option value="人事部">人事部</Option>
              <Option value="财务部">财务部</Option>
              <Option value="运营部">运营部</Option>
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
            <span style={{ fontSize: 16, fontWeight: 600 }}>排班分配</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              共 {filteredData.length} 人
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleBatchAssign}>
            批量排班
          </Button>
        </div>

        <Table columns={columns} data={filteredData} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title="批量排班"
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        style={{ width: 600 }}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="选择人员"
            rules={[{ required: true, message: '请选择人员' }]}
          >
            <Transfer
              dataSource={employees}
              targetKeys={targetKeys}
              onChange={setTargetKeys as any}
              listStyle={{ width: 240, height: 260 }}
              render={(item: any) => item.name}
              titleTexts={['可选人员', '已选人员']}
            />
          </FormItem>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="排班"
                field="shift"
                rules={[{ required: true, message: '请选择班次' }]}
              >
                <Select placeholder="请选择班次" style={{ width: '100%' }}>
                  {shiftOptions.map((s) => (
                    <Option key={s.key} value={s.key}>{s.name}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="生效日期"
                field="effectiveDate"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <Input placeholder="请选择日期" />
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default Assign
