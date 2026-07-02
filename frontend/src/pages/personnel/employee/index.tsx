import { useState, useEffect } from 'react'
import { Table, Input, Select, Modal, Form, Tag, Card, Grid, Spin, Button, DatePicker } from '@arco-design/web-react'

const { Row, Col } = Grid
import type { TableProps } from '@arco-design/web-react'
import type { Dayjs } from 'dayjs'
import { getEmployees, updateEmployee, deleteEmployee } from '@/api/personnel'
import type { Employee } from '@/api/personnel'
import { PageHeader, FilterBar, TableHeader, ActionButtons, DepartmentSelect, EmployeeSelect } from '@/components'
import { useCrudModal } from '@/hooks/useCrudModal'
import { useTableHotkeys } from '@/hooks/useTableHotkeys'
import { toast } from '@/utils/toast'
import CareerTimeline from './CareerTimeline'
import styles from './employee.module.css'
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker

const positionTypeOptions = [
  { value: 'formal', label: '正式' },
  { value: 'probation', label: '试用' },
  { value: 'intern', label: '实习' },
]

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
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [searchDept, setSearchDept] = useState<number | undefined>()
  const [searchPositionType, setSearchPositionType] = useState<string | undefined>()
  const [hireDateRange, setHireDateRange] = useState<Dayjs[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [careerVisible, setCareerVisible] = useState(false)
  const [careerEmployeeId, setCareerEmployeeId] = useState<number>(0)

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getEmployees({
        page,
        pageSize,
        keyword: searchText || undefined,
        status: searchStatus,
        departmentId: searchDept,
      })
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, current: page, pageSize, total: res.data.total }))
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const { visible, editingId, saving, openEdit, close, handleOk } = useCrudModal<Employee>({
    form,
    mapRecordToForm: (record) => ({
      status: record.status, gender: record.gender, birthDate: record.birthDate,
      idCardNo: record.idCardNo, nationality: record.nationality, maritalStatus: record.maritalStatus,
      phone: record.phone, bankName: record.bankName, bankAccountNo: record.bankAccountNo,
      probationEndDate: record.probationEndDate, contractSignDate: record.contractSignDate,
      terminationDate: record.terminationDate, terminationType: record.terminationType,
      terminationReason: record.terminationReason, emergencyContact: record.emergencyContact,
      emergencyPhone: record.emergencyPhone, address: record.address, education: record.education,
      skills: record.skills, remark: record.remark, salary: record.salary, rating: record.rating,
    }),
    onSubmit: async (values, id) => {
      if (id) {
        await updateEmployee(id, values)
        toast.success('修改成功')
      } else {
        toast.info('新增员工请通过入职流程办理')
      }
    },
    onSuccess: () => fetchData(),
  })

  // 表格快捷键
  useTableHotkeys({
    onRefresh: () => fetchData(),
  })

  const columns: TableProps<Employee>['columns'] = [
    { title: '工号', dataIndex: 'employeeNo', width: 100, sorter: (a: Employee, b: Employee) => a.employeeNo.localeCompare(b.employeeNo) },
    { title: '姓名', dataIndex: 'name', width: 100, sorter: (a: Employee, b: Employee) => (a.realName || '').localeCompare(b.realName || '') },
    { title: '部门', dataIndex: 'department', width: 120 },
    { title: '岗位', dataIndex: 'position', width: 120 },
    { title: '直属上级', dataIndex: 'supervisorName', width: 110, render: (v: string) => v || '-' },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', width: 200 },
    { title: '入职日期', dataIndex: 'hireDate', width: 120, sorter: (a: Employee, b: Employee) => (a.hireDate || '').localeCompare(b.hireDate || '') },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      sorter: (a: Employee, b: Employee) => (a.status || '').localeCompare(b.status || ''),
      render: (value: string) => {
        const info = statusMap[value]
        return info ? <Tag color={info.color}>{info.text}</Tag> : <Tag>{value}</Tag>
      },
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, record: Employee) => (
        <ActionButtons
          onEdit={() => openEdit(record)}
          onDelete={() => handleDelete(record.id)}
          deleteContent="确定要删除该员工吗？"
          extraBefore={
            <Button
              type="text"
              size="small"
              onClick={() => {
                setCareerEmployeeId(record.id)
                setCareerVisible(true)
              }}
            >
              履历
            </Button>
          }
        />
      ),
    },
  ]

  const handleDelete = async (id: number) => {
    try { await deleteEmployee(id); toast.success('删除成功'); fetchData() } catch { /* error handled by interceptor */ }
  }

  return (
    <div className={styles['employee-page']}>
      <PageHeader title="员工管理" description="管理员工基本信息、状态、合同等信息。" />

      <Card bordered={false}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input placeholder="姓名/工号/手机号" value={searchText} onChange={setSearchText} allowClear />
              </FormItem>
              <FormItem label="状态">
                <Select placeholder="请选择状态" value={searchStatus} onChange={setSearchStatus} allowClear>
                  {statusOptions.map((opt) => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
                </Select>
              </FormItem>
              <FormItem label="部门">
                <DepartmentSelect
                  value={searchDept}
                  onChange={(val) => setSearchDept(val as number | undefined)}
                  placeholder="请选择部门"
                />
              </FormItem>
              <FormItem label="岗位类型">
                <Select placeholder="请选择岗位类型" value={searchPositionType} onChange={setSearchPositionType} allowClear>
                  {positionTypeOptions.map((opt) => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
                </Select>
              </FormItem>
              <FormItem label="入职时间">
                <RangePicker
                  value={hireDateRange}
                  onChange={(_, date) => setHireDateRange(date)}
                />
              </FormItem>
            </>
          }
          onSearch={() => fetchData(1, pagination.pageSize)}
          onReset={() => {
            setSearchText('')
            setSearchStatus(undefined)
            setSearchDept(undefined)
            setSearchPositionType(undefined)
            setHireDateRange([])
            fetchData(1, pagination.pageSize)
          }}
        />
      </Card>

      <Card bordered={false}>
        <TableHeader title="员工列表" total={pagination.total} totalText="人" />
        <Spin loading={loading}>
          <Table columns={columns} data={data} rowKey="id" pagination={{ ...pagination, sizeOptions: [10, 20, 50], sizeCanChange: true, showTotal: true, onChange: (c, ps) => fetchData(c, ps) }} scroll={{ x: 1100 }} />
        </Spin>
      </Card>

      <Modal focusLock title={editingId ? '编辑员工' : '新增员工'} visible={visible} onOk={handleOk} onCancel={close} confirmLoading={saving} className={styles['employee-page__modal--700']}>
        <Form form={form} layout="vertical">
          {editingId && (
            <Row gutter={16}>
              <Col span={12}><FormItem label="工号"><Input disabled /></FormItem></Col>
              <Col span={12}><FormItem label="姓名"><Input disabled /></FormItem></Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={12}><FormItem label="手机号" field="phone"><Input placeholder="请输入手机号" /></FormItem></Col>
            <Col span={12}><FormItem label="状态" field="status"><Select>{statusOptions.map((opt) => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}</Select></FormItem></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="直属上级" field="supervisorId">
                <EmployeeSelect
                  placeholder="请选择直属上级"
                  allowClear
                />
              </FormItem>
            </Col>
            <Col span={12}><FormItem label="性别" field="gender"><Select allowClear><Option value="男">男</Option><Option value="女">女</Option></Select></FormItem></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><FormItem label="出生日期" field="birthDate"><Input placeholder="YYYY-MM-DD" /></FormItem></Col>
            <Col span={12}><FormItem label="身份证号" field="idCardNo"><Input placeholder="请输入身份证号" /></FormItem></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><FormItem label="国籍" field="nationality"><Input placeholder="请输入国籍" /></FormItem></Col>
            <Col span={12}><FormItem label="婚姻状况" field="maritalStatus"><Select allowClear><Option value="未婚">未婚</Option><Option value="已婚">已婚</Option><Option value="离异">离异</Option><Option value="丧偶">丧偶</Option></Select></FormItem></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><FormItem label="学历" field="education"><Input placeholder="请输入学历" /></FormItem></Col>
            <Col span={12}><FormItem label="开户银行" field="bankName"><Input placeholder="请输入开户银行" /></FormItem></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><FormItem label="银行账号" field="bankAccountNo"><Input placeholder="请输入银行账号" /></FormItem></Col>
            <Col span={12}><FormItem label="试用期结束日期" field="probationEndDate"><Input placeholder="YYYY-MM-DD" /></FormItem></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><FormItem label="合同签订日期" field="contractSignDate"><Input placeholder="YYYY-MM-DD" /></FormItem></Col>
            <Col span={12}><FormItem label="离职类型" field="terminationType"><Select allowClear><Option value="主动离职">主动离职</Option><Option value="被动离职">被动离职</Option><Option value="合同到期">合同到期</Option><Option value="退休">退休</Option></Select></FormItem></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><FormItem label="离职日期" field="terminationDate"><Input placeholder="YYYY-MM-DD" /></FormItem></Col>
          </Row>
          <Row gutter={16}><Col span={24}><FormItem label="离职原因" field="terminationReason"><Input placeholder="请输入离职原因" /></FormItem></Col></Row>
          <Row gutter={16}>
            <Col span={12}><FormItem label="紧急联系人" field="emergencyContact"><Input placeholder="请输入紧急联系人姓名" /></FormItem></Col>
            <Col span={12}><FormItem label="紧急联系电话" field="emergencyPhone"><Input placeholder="请输入紧急联系电话" /></FormItem></Col>
          </Row>
          <Row gutter={16}><Col span={24}><FormItem label="家庭住址" field="address"><Input placeholder="请输入家庭住址" /></FormItem></Col></Row>
          <Row gutter={16}><Col span={24}><FormItem label="技能" field="skills"><Input placeholder="请输入技能特长" /></FormItem></Col></Row>
          <Row gutter={16}>
            <Col span={12}><FormItem label="薪资" field="salary"><Input type="number" placeholder="请输入薪资" /></FormItem></Col>
            <Col span={12}><FormItem label="评级" field="rating"><Input type="number" placeholder="1-5" min={1} max={5} /></FormItem></Col>
          </Row>
          <Row gutter={16}><Col span={24}><FormItem label="备注" field="remark"><Input placeholder="请输入备注" /></FormItem></Col></Row>
        </Form>
      </Modal>
      {/* 履历弹窗 */}
      <CareerTimeline
        employeeId={careerEmployeeId}
        visible={careerVisible}
        onClose={() => setCareerVisible(false)}
      />
    </div>
  )
}

export default Employee
