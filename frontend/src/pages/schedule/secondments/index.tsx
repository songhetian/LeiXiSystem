import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Tag,
} from '@arco-design/web-react'
import {
  IconPlus,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import dayjs from 'dayjs'
import {
  getSecondments,
  createSecondment,
  updateSecondment,
  deleteSecondment,
  type EmployeeSecondment,
} from '@/api/schedule'
import { getEmployees, Employee } from '@/api/personnel'
import { getDepartmentsList, Department } from '@/api/organization'
import { PageHeader, FilterBar, ActionButtons } from '@/components'
import { useCrudModal } from '@/hooks/useCrudModal'
import { toast } from '@/utils/toast'
import styles from './style.module.css'
const FormItem = Form.Item
const Option = Select.Option

function SecondmentsPage() {
  const [data, setData] = useState<EmployeeSecondment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [form] = Form.useForm()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined)

  const loadData = useCallback(async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true)
    try {
      const res = await getSecondments({
        page: nextPage,
        pageSize: nextPageSize,
        keyword: searchKeyword || undefined,
        status: searchStatus,
      })
      setData(res.data?.list || [])
      setTotal(res.data?.total || 0)
      setPage(nextPage)
      setPageSize(nextPageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchKeyword, searchStatus])

  const loadEmployees = useCallback(async () => {
    try {
      const res = await getEmployees({ page: 1, pageSize: 100, status: 'active' })
      setEmployees(res.data?.list || [])
    } catch {
      // error handled by interceptor
    }
  }, [])

  const loadDepartments = useCallback(async () => {
    try {
      const res = await getDepartmentsList()
      setDepartments(res.data || [])
    } catch {
      // error handled by interceptor
    }
  }, [])

  useEffect(() => {
    loadEmployees()
    loadDepartments()
  }, [loadEmployees, loadDepartments])

  useEffect(() => {
    loadData(1, pageSize)
  }, [searchKeyword, searchStatus])

  const { visible, editingId, openCreate, openEdit, close, handleOk } = useCrudModal<EmployeeSecondment>({
    form,
    mapRecordToForm: (record) => ({
      employeeId: record.employeeId,
      fromDepartmentId: record.fromDepartmentId,
      toDepartmentId: record.toDepartmentId,
      startDate: dayjs(record.startDate),
      endDate: dayjs(record.endDate),
      reason: record.reason,
      status: record.status,
    }),
    onSubmit: async (values, id) => {
      const data = {
        ...values,
        startDate: values.startDate.format('YYYY-MM-DD'),
        endDate: values.endDate.format('YYYY-MM-DD'),
      }
      if (id) {
        await updateSecondment(id, data as any)
        toast.success('更新成功')
      } else {
        await createSecondment(data as any)
        toast.success('创建成功')
      }
    },
    onSuccess: () => loadData(page, pageSize),
  })

  const handleDelete = async (id: number) => {
    try {
      await deleteSecondment(id)
      toast.success('删除成功')
      loadData(page, pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      active: { color: 'green', text: '进行中' },
      completed: { color: 'arcoblue', text: '已完成' },
      cancelled: { color: 'gray', text: '已取消' },
    }
    const { color, text } = map[status] || { color: 'gray', text: status }
    return <Tag color={color}>{text}</Tag>
  }

  const columns: TableProps<EmployeeSecondment>['columns'] = [
    {
      title: '员工',
      dataIndex: 'employee',
      width: 100,
      render: (val: any) => (
        <Space direction="vertical" size={4}>
          <span>{val?.user?.realName}</span>
          <span className={styles['schedule-secondments__cell-secondary']}>
            {val?.employeeNo}
          </span>
        </Space>
      ),
    },
    {
      title: '借出部门',
      dataIndex: 'fromDepartment',
      width: 120,
      render: (val: any) => val?.name || '-',
    },
    {
      title: '借入部门',
      dataIndex: 'toDepartment',
      width: 120,
      render: (val: any) => val?.name || '-',
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      width: 120,
      render: (val) => dayjs(val).format('YYYY-MM-DD'),
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      width: 120,
      render: (val) => dayjs(val).format('YYYY-MM-DD'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val) => getStatusTag(val),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      ellipsis: true,
    },
    {
      title: '操作人',
      dataIndex: 'creator',
      width: 100,
      render: (val: any) => val?.realName || '-',
    },
    {
      title: '操作',
      width: 140,
      render: (_, record) => (
        <ActionButtons
          onEdit={() => openEdit(record)}
          onDelete={() => handleDelete(record.id)}
          deleteConfirm={false}
        />
      ),
    },
  ]

  return (
    <div className={styles['schedule-secondments']}>
      <Card bordered={false} className={styles['schedule-secondments__card']}>
        <PageHeader
          title="员工借调"
          description="记录员工在部门间的借调情况，包括借出部门、借入部门、借调时间等。"
          extra={
            <Button type="primary" icon={<IconPlus />} onClick={openCreate}>
              新建借调
            </Button>
          }
        />
      </Card>

      <Card bordered={false} className={styles['schedule-secondments__card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input
                  className={styles['schedule-secondments__input-keyword']}
                  placeholder="员工姓名"
                  value={searchKeyword}
                  onChange={setSearchKeyword}
                  allowClear
                />
              </FormItem>
              <FormItem label="状态">
                <Select
                  className={styles['schedule-secondments__select-status']}
                  placeholder="全部"
                  value={searchStatus}
                  onChange={setSearchStatus}
                  allowClear
                >
                  <Option value="active">进行中</Option>
                  <Option value="completed">已完成</Option>
                  <Option value="cancelled">已取消</Option>
                </Select>
              </FormItem>
            </>
          }
          onSearch={() => loadData(1, pageSize)}
          onReset={() => loadData(page, pageSize)}
          searchText="搜索"
        />
      </Card>

      <Card bordered={false}>
        <Table
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: true,
            sizeCanChange: true,
            onChange: (p, ps) => loadData(p, ps),
          }}
        />
      </Card>

      <Modal focusLock
        title={editingId ? '编辑借调' : '新增借调'}
        visible={visible}
        onOk={handleOk}
        onCancel={close}
        className={styles['schedule-secondments__modal-medium']}
      >
        <Form form={form} layout="vertical">
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select placeholder="请选择员工" showSearch filterOption={(input, option) => {
              const employee = employees.find((e) => e.id === option.props.value)
              if (!employee) return false
              const name = employee.realName || ''
              const empNo = employee.employeeNo || ''
              return name.toLowerCase().includes(input.toLowerCase()) ||
                empNo.toLowerCase().includes(input.toLowerCase())
            }}>
              {employees.map((e) => (
                <Option key={e.id} value={e.id}>
                  {e.realName} ({e.employeeNo})
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="借出部门" field="fromDepartmentId" rules={[{ required: true, message: '请选择借出部门' }]}>
            <Select placeholder="请选择借出部门">
              {departments.map((d) => (
                <Option key={d.id} value={d.id}>{d.name}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="借入部门" field="toDepartmentId" rules={[{ required: true, message: '请选择借入部门' }]}>
            <Select placeholder="请选择借入部门">
              {departments.map((d) => (
                <Option key={d.id} value={d.id}>{d.name}</Option>
              ))}
            </Select>
          </FormItem>
          <Space>
            <FormItem label="开始日期" field="startDate" rules={[{ required: true, message: '请选择开始日期' }]}>
              <DatePicker className={styles['schedule-secondments__date-picker']} />
            </FormItem>
            <FormItem label="结束日期" field="endDate" rules={[{ required: true, message: '请选择结束日期' }]}>
              <DatePicker className={styles['schedule-secondments__date-picker']} />
            </FormItem>
          </Space>
          <FormItem label="借调原因" field="reason">
            <Input.TextArea placeholder="请输入借调原因" rows={3} />
          </FormItem>
          {editingId && (
            <FormItem label="状态" field="status">
              <Select placeholder="请选择状态">
                <Option value="active">进行中</Option>
                <Option value="completed">已完成</Option>
                <Option value="cancelled">已取消</Option>
              </Select>
            </FormItem>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default SecondmentsPage
