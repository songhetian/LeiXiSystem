import { useState, useEffect, useCallback } from 'react'
import { Table, Input, Select, Modal, Form, Tag, Card, Button } from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconSearch, IconPlus, IconRefresh } from '@arco-design/web-react/icon'
import { getEmployees, updateEmployee, deleteEmployee } from '@/api/personnel'
import type { Employee } from '@/api/personnel'
import { ActionButtons, DepartmentSelect, EmployeeSelect } from '@/components'
import { useCrudModal } from '@/hooks/useCrudModal'
import { toast } from '@/utils/toast'
import { formatDate } from '@/utils/date'
import CareerTimeline from './CareerTimeline'
import styles from './index.module.less'

const FormItem = Form.Item
const Option = Select.Option

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '在职', color: 'green' },
  probation: { text: '试用', color: 'orangered' },
  formal: { text: '正式', color: 'green' },
  contract: { text: '合同工', color: 'arcoblue' },
  terminated: { text: '已离职', color: 'red' },
  inactive: { text: '停用', color: 'gray' },
  onLeave: { text: '休假', color: 'purple' },
}

const statusOptions = ['active', 'formal', 'probation', 'contract', 'terminated', 'inactive', 'onLeave']

function Employee() {
  const [data, setData] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string>()
  const [searchDept, setSearchDept] = useState<number>()
  const [searchGender, setSearchGender] = useState<string>()
  const [searchPositionType, setSearchPositionType] = useState<string>()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [careerVisible, setCareerVisible] = useState(false)
  const [careerEmployeeId, setCareerEmployeeId] = useState(0)

  const fetchData = useCallback(async (page = 1, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const res = await getEmployees({ page, pageSize, keyword: searchText || undefined, status: searchStatus, departmentId: searchDept })
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, current: page, pageSize, total: res.data.total }))
    } finally { setLoading(false) }
  }, [searchText, searchStatus, searchDept, pagination.pageSize])

  useEffect(() => { fetchData() }, [])

  const { visible, editingId, saving, openEdit, close, handleOk } = useCrudModal<Employee>({
    form,
    mapRecordToForm: (r) => ({
      status: r.status, gender: r.gender, birthDate: r.birthDate, idCardNo: r.idCardNo,
      nationality: r.nationality, maritalStatus: r.maritalStatus, phone: r.phone,
      bankName: r.bankName, bankAccountNo: r.bankAccountNo, probationEndDate: r.probationEndDate,
      contractSignDate: r.contractSignDate, terminationDate: r.terminationDate,
      terminationType: r.terminationType, terminationReason: r.terminationReason,
      emergencyContact: r.emergencyContact, emergencyPhone: r.emergencyPhone, address: r.address,
      education: r.education, skills: r.skills, remark: r.remark, salary: r.salary, rating: r.rating,
    }),
    onSubmit: async (values, id) => {
      if (id) { await updateEmployee(id, values); toast.success('修改成功') }
      else toast.info('新增员工请通过入职流程办理')
    },
    onSuccess: () => fetchData(),
  })

  const handleDelete = async (id: number) => {
    try { await deleteEmployee(id); toast.success('删除成功'); fetchData() } catch {}
  }

  const columns: TableProps<Employee>['columns'] = [
    { title: '工号', dataIndex: 'employeeNo', width: 100, align: 'center' },
    { title: '姓名', dataIndex: 'realName', width: 90, align: 'center' },
    { title: '部门', dataIndex: 'department', width: 120, align: 'center' },
    { title: '岗位', dataIndex: 'position', width: 120, align: 'center' },
    { title: '手机号', dataIndex: 'phone', width: 130, align: 'center' },
    { title: '邮箱', dataIndex: 'email', width: 180, align: 'center' },
    { title: '入职日期', dataIndex: 'hireDate', width: 120, align: 'center', render: (v) => v ? formatDate(v) : '-' },
    { title: '状态', dataIndex: 'status', width: 90, align: 'center', render: (v: string) => { const m = statusMap[v]; return m ? <Tag color={m.color}>{m.text}</Tag> : <Tag>{v}</Tag> } },
    {
      title: '操作', width: 160, align: 'center', fixed: 'right' as const,
      render: (_, record) => (
        <ActionButtons
          onEdit={() => openEdit(record)}
          onDelete={() => handleDelete(record.id)}
          deleteContent="确定删除该员工?"
          extraBefore={<Button type="text" size="small" onClick={() => { setCareerEmployeeId(record.id); setCareerVisible(true) }}>履历</Button>}
          size="small"
        />
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <Card bordered={false}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles['toolbar-left']}>
            <Input prefix={<IconSearch />} placeholder="姓名/工号/手机号" value={searchText} onChange={setSearchText} allowClear style={{ width: 150 }} onPressEnter={() => fetchData(1)} />
            <Select placeholder="状态" value={searchStatus} onChange={setSearchStatus} allowClear style={{ width: 75 }}>
              {statusOptions.map((v) => <Option key={v} value={v}>{statusMap[v]?.text || v}</Option>)}
            </Select>
            <DepartmentSelect value={searchDept} onChange={(v) => setSearchDept(v as number)} placeholder="部门" style={{ width: 110 }} />
            <Select placeholder="性别" value={searchGender} onChange={setSearchGender} allowClear style={{ width: 65 }}>
              <Option value="男">男</Option>
              <Option value="女">女</Option>
            </Select>
            <Select placeholder="岗位类型" value={searchPositionType} onChange={setSearchPositionType} allowClear style={{ width: 85 }}>
              <Option value="formal">正式</Option>
              <Option value="probation">试用</Option>
              <Option value="intern">实习</Option>
            </Select>
            <Button type="primary" onClick={() => fetchData(1)}>查询</Button>
            <Button onClick={() => { setSearchText(''); setSearchStatus(undefined); setSearchDept(undefined); setSearchGender(undefined); setSearchPositionType(undefined); fetchData(1) }}>重置</Button>
          </div>
          <div className={styles['toolbar-right']}>
            <Button icon={<IconRefresh />} onClick={() => fetchData()}>刷新</Button>
            <Button type="primary" icon={<IconPlus />} onClick={() => toast.info('新增员工请通过入职流程办理')}>新增</Button>
          </div>
        </div>

        {/* Table */}
        <Table
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          pagination={{ ...pagination, sizeOptions: [10, 20, 50], showTotal: true, onChange: (p, ps) => fetchData(p, ps) }}
          scroll={{ x: 'max-content' }}
          stripe
          hover
        />
      </Card>

      {/* Edit Modal */}
      <Modal title={editingId ? '编辑员工' : '新增员工'} visible={visible} onOk={handleOk} onCancel={close} confirmLoading={saving} style={{ width: 700 }}>
        <Form form={form} layout="vertical">
          {editingId && (
            <div className={styles['form-row']}>
              <FormItem label="工号"><Input disabled /></FormItem>
              <FormItem label="姓名"><Input disabled /></FormItem>
            </div>
          )}
          <div className={styles['form-row']}>
            <FormItem label="手机号" field="phone"><Input placeholder="请输入" /></FormItem>
            <FormItem label="状态" field="status"><Select>{statusOptions.map((v) => <Option key={v} value={v}>{statusMap[v]?.text || v}</Option>)}</Select></FormItem>
          </div>
          <div className={styles['form-row']}>
            <FormItem label="直属上级" field="supervisorId"><EmployeeSelect placeholder="请选择" allowClear /></FormItem>
            <FormItem label="性别" field="gender"><Select allowClear><Option value="男">男</Option><Option value="女">女</Option></Select></FormItem>
          </div>
          <div className={styles['form-row']}>
            <FormItem label="出生日期" field="birthDate"><Input placeholder="YYYY-MM-DD" /></FormItem>
            <FormItem label="身份证号" field="idCardNo"><Input placeholder="请输入" /></FormItem>
          </div>
          <div className={styles['form-row']}>
            <FormItem label="国籍" field="nationality"><Input placeholder="请输入" /></FormItem>
            <FormItem label="婚姻状况" field="maritalStatus"><Select allowClear><Option value="未婚">未婚</Option><Option value="已婚">已婚</Option></Select></FormItem>
          </div>
          <div className={styles['form-row']}>
            <FormItem label="学历" field="education"><Input placeholder="请输入" /></FormItem>
            <FormItem label="开户银行" field="bankName"><Input placeholder="请输入" /></FormItem>
          </div>
          <div className={styles['form-row']}>
            <FormItem label="银行账号" field="bankAccountNo"><Input placeholder="请输入" /></FormItem>
            <FormItem label="试用期到期" field="probationEndDate"><Input placeholder="YYYY-MM-DD" /></FormItem>
          </div>
          <div className={styles['form-row']}>
            <FormItem label="合同签订" field="contractSignDate"><Input placeholder="YYYY-MM-DD" /></FormItem>
            <FormItem label="离职类型" field="terminationType"><Select allowClear><Option value="主动离职">主动离职</Option><Option value="被动离职">被动离职</Option></Select></FormItem>
          </div>
          <div className={styles['form-row']}>
            <FormItem label="离职日期" field="terminationDate"><Input placeholder="YYYY-MM-DD" /></FormItem>
            <FormItem label="薪资" field="salary"><Input type="number" placeholder="请输入" /></FormItem>
          </div>
          <FormItem label="离职原因" field="terminationReason"><Input placeholder="请输入" /></FormItem>
          <div className={styles['form-row']}>
            <FormItem label="紧急联系人" field="emergencyContact"><Input placeholder="请输入" /></FormItem>
            <FormItem label="紧急电话" field="emergencyPhone"><Input placeholder="请输入" /></FormItem>
          </div>
          <FormItem label="住址" field="address"><Input placeholder="请输入" /></FormItem>
          <FormItem label="技能" field="skills"><Input placeholder="请输入" /></FormItem>
          <FormItem label="备注" field="remark"><Input placeholder="请输入" /></FormItem>
        </Form>
      </Modal>

      {/* Career Timeline Modal */}
      <CareerTimeline employeeId={careerEmployeeId} visible={careerVisible} onClose={() => setCareerVisible(false)} />
    </div>
  )
}

export default Employee
