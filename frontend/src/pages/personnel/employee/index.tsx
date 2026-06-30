import { useState, useEffect, useRef } from 'react'
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
  Spin,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconDelete,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getEmployees, updateEmployee, deleteEmployee } from '@/api/personnel'
import type { Employee } from '@/api/personnel'
import './employee.css'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

const statusMap: Record<string, { text: string; color: string }> = {
  probation: { text: '试用期', color: 'orange' },
  formal: { text: '正式', color: 'green' },
  contract: { text: '合同工', color: 'arcoblue' },
  terminated: { text: '已离职', color: 'red' },
}

const statusOptions = [
  { value: 'probation', label: '试用期' },
  { value: 'formal', label: '正式' },
  { value: 'contract', label: '合同工' },
  { value: 'terminated', label: '已离职' },
]

function Employee() {
  const [data, setData] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getEmployees({
        page,
        pageSize,
        keyword: searchText || undefined,
        status: searchStatus,
      })
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, current: page, pageSize, total: res.data.total }))
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(pagination.current, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns: TableProps<Employee>['columns'] = [
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 120,
    },
    {
      title: '岗位',
      dataIndex: 'position',
      width: 120,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 130,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
    },
    {
      title: '入职日期',
      dataIndex: 'hireDate',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const info = statusMap[value]
        if (!info) return <Tag>{value}</Tag>
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: Employee) => (
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
            content="确定要删除该员工吗？"
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

  const handleEdit = async (record: Employee) => {
    setEditingId(record.id)
    form.setFieldsValue({
      status: record.status,
      gender: record.gender,
      birthDate: record.birthDate,
      idCardNo: record.idCardNo,
      nationality: record.nationality,
      maritalStatus: record.maritalStatus,
      phone: record.phone,
      bankName: record.bankName,
      bankAccountNo: record.bankAccountNo,
      probationEndDate: record.probationEndDate,
      contractSignDate: record.contractSignDate,
      terminationDate: record.terminationDate,
      terminationType: record.terminationType,
      terminationReason: record.terminationReason,
      emergencyContact: record.emergencyContact,
      emergencyPhone: record.emergencyPhone,
      address: record.address,
      education: record.education,
      skills: record.skills,
      remark: record.remark,
      salary: record.salary,
      rating: record.rating,
    })
    setVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteEmployee(id)
      Message.success('删除成功')
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      setSaving(true)
      if (editingId) {
        await updateEmployee(editingId, values)
        Message.success('修改成功')
      } else {
        Message.info('新增员工请通过入职流程办理')
      }
      setVisible(false)
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setSaving(false)
    }
  }

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
    setSearchStatus(undefined)
    fetchData(1, pagination.pageSize)
  }

  const handlePageChange = (current: number, pageSize: number) => {
    fetchData(current, pageSize)
  }

  return (
    <div className="employee-page">
      <Card bordered={false} className="employee-page__search-card">
        <Form layout="inline">
          <FormItem label="关键字">
            <Input
              className="employee-page__search-input"
              placeholder="姓名/工号/手机号"
              value={searchText}
              onChange={setSearchText}
              allowClear
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              className="employee-page__status-select"
              placeholder="请选择状态"
              value={searchStatus}
              onChange={(val) => {
                setSearchStatus(val)
                fetchData(1, pagination.pageSize)
              }}
              allowClear
            >
              {statusOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
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

      <Card bordered={false} className="employee-page__table-card">
        <div className="employee-page__table-header">
          <div>
            <span className="employee-page__table-title">员工列表</span>
            <Tag color="blue" className="employee-page__total-tag">
              共 {pagination.total} 人
            </Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
            新增员工
          </Button>
        </div>

        <Spin loading={loading}>
          <Table
            columns={columns}
            data={data}
            rowKey="id"
            pagination={{
              ...pagination,
              sizeOptions: [10, 20, 50],
              onChange: handlePageChange,
            }}
            scroll={{ x: 1100 }}
          />
        </Spin>
      </Card>

      <Modal
        title={editingId ? '编辑员工' : '新增员工'}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        confirmLoading={saving}
        className="employee-page__modal--700"
      >
        <Form form={form} layout="vertical">
          {editingId && (
            <Row gutter={16}>
              <Col span={12}>
                <FormItem label="工号">
                  <Input disabled />
                </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="姓名">
                  <Input disabled />
                </FormItem>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="手机号" field="phone">
                <Input placeholder="请输入手机号" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="状态" field="status">
                <Select placeholder="请选择状态">
                  {statusOptions.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="性别" field="gender">
                <Select placeholder="请选择性别" allowClear>
                  <Option value="男">男</Option>
                  <Option value="女">女</Option>
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="出生日期" field="birthDate">
                <Input placeholder="YYYY-MM-DD" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="身份证号" field="idCardNo">
                <Input placeholder="请输入身份证号" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="国籍" field="nationality">
                <Input placeholder="请输入国籍" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="婚姻状况" field="maritalStatus">
                <Select placeholder="请选择婚姻状况" allowClear>
                  <Option value="未婚">未婚</Option>
                  <Option value="已婚">已婚</Option>
                  <Option value="离异">离异</Option>
                  <Option value="丧偶">丧偶</Option>
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="学历" field="education">
                <Input placeholder="请输入学历" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="开户银行" field="bankName">
                <Input placeholder="请输入开户银行" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="银行账号" field="bankAccountNo">
                <Input placeholder="请输入银行账号" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="试用期结束日期" field="probationEndDate">
                <Input placeholder="YYYY-MM-DD" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="合同签订日期" field="contractSignDate">
                <Input placeholder="YYYY-MM-DD" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="离职日期" field="terminationDate">
                <Input placeholder="YYYY-MM-DD" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="离职类型" field="terminationType">
                <Select placeholder="请选择离职类型" allowClear>
                  <Option value="主动离职">主动离职</Option>
                  <Option value="被动离职">被动离职</Option>
                  <Option value="合同到期">合同到期</Option>
                  <Option value="退休">退休</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <FormItem label="离职原因" field="terminationReason">
                <Input placeholder="请输入离职原因" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="紧急联系人" field="emergencyContact">
                <Input placeholder="请输入紧急联系人姓名" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="紧急联系电话" field="emergencyPhone">
                <Input placeholder="请输入紧急联系电话" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <FormItem label="家庭住址" field="address">
                <Input placeholder="请输入家庭住址" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <FormItem label="技能" field="skills">
                <Input placeholder="请输入技能特长" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="薪资" field="salary">
                <Input type="number" placeholder="请输入薪资" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="评级" field="rating">
                <Input type="number" placeholder="1-5" min={1} max={5} />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <FormItem label="备注" field="remark">
                <Input placeholder="请输入备注" />
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default Employee
