import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Message, Modal, Select, Space, Table, Tag, Typography } from '@arco-design/web-react'
import { getEmployees, Employee } from '@/api/personnel'
import { createSalaryAssignment, getSalaryAssignments, getSalaryStructures, updateSalaryAssignment, SalaryAssignment, SalaryStructure } from '@/api/payroll'
import './index.css'

const { Title, Text } = Typography
const FormItem = Form.Item
const Option = Select.Option

function SalaryAssignmentsPage() {
  const [data, setData] = useState<SalaryAssignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [structures, setStructures] = useState<SalaryStructure[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<SalaryAssignment | null>(null)
  const [form] = Form.useForm()

  const loadData = async () => {
    setLoading(true)
    try {
      const [assignmentRes, employeeRes, structureRes]: any[] = await Promise.all([
        getSalaryAssignments(),
        getEmployees({ page: 1, pageSize: 1000, status: 'active' }),
        getSalaryStructures(),
      ])
      setData(assignmentRes.data || [])
      setEmployees(employeeRes.data?.list || [])
      setStructures((structureRes.data || []).filter((item: any) => item.status === 'active'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      status: 'active',
      effectiveFrom: new Date().toISOString().slice(0, 10),
    })
    setVisible(true)
  }

  const openEdit = (record: any) => {
    setEditing(record)
    form.setFieldsValue({
      employeeId: record.employeeId,
      salaryStructureId: record.salaryStructureId,
      baseSalary: Number(record.baseSalary || 0),
      effectiveFrom: record.effectiveFrom?.slice(0, 10),
      effectiveTo: record.effectiveTo?.slice(0, 10),
      status: record.status,
    })
    setVisible(true)
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    const payload = {
      ...values,
      employeeId: Number(values.employeeId),
      salaryStructureId: Number(values.salaryStructureId),
      baseSalary: Number(values.baseSalary || 0),
    }

    if (editing) {
      await updateSalaryAssignment(editing.id, payload)
      Message.success('薪资分配更新成功')
    } else {
      await createSalaryAssignment(payload)
      Message.success('薪资分配创建成功')
    }

    setVisible(false)
    loadData()
  }

  return (
    <div className="salary-assignments">
      <Card bordered={false} className="salary-assignments__card">
        <Space direction="vertical" size={4} className="salary-assignments__space">
          <div className="salary-assignments__header">
            <Title heading={5} className="salary-assignments__title">员工薪资分配</Title>
            <Button type="primary" onClick={openCreate}>新增分配</Button>
          </div>
          <Text type="secondary">把员工绑定到薪资结构并设置基础工资，薪资批次计算时会读取当前有效分配。</Text>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={[
            {
              title: '员工',
              render: (_: unknown, record: any) => record.employee?.user?.realName || '-',
            },
            {
              title: '部门',
              render: (_: unknown, record: any) => record.employee?.user?.department?.name || '-',
            },
            {
              title: '薪资结构',
              render: (_: unknown, record: any) => record.salaryStructure?.name || '-',
            },
            { title: '基础工资', dataIndex: 'baseSalary' },
            { title: '生效日期', dataIndex: 'effectiveFrom' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value) => <Tag color={value === 'active' ? 'green' : 'gray'}>{value === 'active' ? '有效' : value}</Tag>,
            },
            {
              title: '操作',
              width: 90,
              render: (_: unknown, record: any) => (
                <Button type="text" size="small" onClick={() => openEdit(record)}>编辑</Button>
              ),
            },
          ]}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑薪资分配' : '新增薪资分配'}
        visible={visible}
        onOk={handleSubmit}
        onCancel={() => setVisible(false)}
        className="salary-assignments__modal"
      >
        <Form form={form} layout="vertical">
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select placeholder="选择员工" showSearch disabled={Boolean(editing)}>
              {employees.map((employee) => (
                <Option key={employee.id} value={employee.id}>
                  {employee.realName}（{employee.employeeNo}）
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="薪资结构" field="salaryStructureId" rules={[{ required: true, message: '请选择薪资结构' }]}>
            <Select placeholder="选择薪资结构">
              {structures.map((structure) => (
                <Option key={structure.id} value={structure.id}>{structure.name}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="基础工资" field="baseSalary" rules={[{ required: true, message: '请输入基础工资' }]}>
            <InputNumber min={0} className="salary-assignments__input-number" />
          </FormItem>
          <Space size="large">
            <FormItem label="生效日期" field="effectiveFrom" rules={[{ required: true, message: '请输入生效日期' }]}>
              <Input className="salary-assignments__input" placeholder="YYYY-MM-DD" />
            </FormItem>
            <FormItem label="失效日期" field="effectiveTo">
              <Input className="salary-assignments__input" placeholder="YYYY-MM-DD" />
            </FormItem>
            <FormItem label="状态" field="status" rules={[{ required: true, message: '请选择状态' }]}>
              <Select className="salary-assignments__input--narrow">
                <Option value="active">有效</Option>
                <Option value="ended">结束</Option>
              </Select>
            </FormItem>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default SalaryAssignmentsPage
