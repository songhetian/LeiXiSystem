import { useCallback, useEffect, useState } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Modal,
  Form,
  Tag,
  Card,
  Grid,
  DatePicker,
} from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { assignSchedule } from '@/api/schedule'
import { getShifts, Shift } from '@/api/shift'
import { getDepartmentsList, Department } from '@/api/organization'
import { getEmployees } from '@/api/personnel'
import { PageHeader, FilterBar } from '@/components'
import { toast } from '@/utils/toast'
import styles from './style.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const RangePicker = DatePicker.RangePicker

interface EmployeeShift {
  id: number
  userId: number
  employeeNo: string
  realName: string
  departmentName?: string
  positionName?: string
  currentShift?: string
  currentShiftColor?: string
}

function AssignPage() {
  const [data, setData] = useState<EmployeeShift[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [visible, setVisible] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchDept, setSearchDept] = useState<number | undefined>()
  const [departments, setDepartments] = useState<Department[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  const loadData = useCallback(async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true)
    try {
      const res = await getEmployees({
        page: nextPage,
        pageSize: nextPageSize,
        keyword: searchText || undefined,
        departmentId: searchDept,
        status: 'active',
      })
      const list = res.data?.list || []
      setData(list.map((item: any) => ({
        id: item.id,
        userId: item.userId,
        employeeNo: item.employeeNo,
        realName: item.user?.realName || '',
        departmentName: item.user?.department?.name || '',
        positionName: item.position?.name || '',
        currentShift: '',
      })))
      setTotal(res.data?.total || 0)
      setPage(nextPage)
      setPageSize(nextPageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchText, searchDept])

  const loadDepartments = useCallback(async () => {
    try {
      const res = await getDepartmentsList()
      setDepartments(res.data || [])
    } catch {
      // error handled by interceptor
    }
  }, [])

  const loadShifts = useCallback(async () => {
    try {
      const res = await getShifts({ page: 1, pageSize: 100, status: 'active' })
      setShifts(res.data?.list || [])
    } catch {
      // error handled by interceptor
    }
  }, [])

  useEffect(() => {
    loadDepartments()
    loadShifts()
  }, [loadDepartments, loadShifts])

  useEffect(() => {
    loadData(1, pageSize)
  }, [searchText, searchDept])

  const handleSearch = () => {
    loadData(1, pageSize)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchDept(undefined)
    loadData(1, pageSize)
  }

  const handleBatchAssign = () => {
    form.resetFields()
    setVisible(true)
  }

  const handleOk = async () => {
    try {
      const values = await form.validate()
      const dateRange = values.dateRange
      if (!dateRange || dateRange.length !== 2) {
        toast.error('请选择日期范围')
        return
      }
      const userIds = selectedKeys.length > 0 ? selectedKeys.map(Number) : data.map((item) => item.userId)
      if (userIds.length === 0) {
        toast.error('请选择人员')
        return
      }
      await assignSchedule({
        userIds,
        shiftId: values.shiftId,
        startDate: dateRange[0],
        endDate: dateRange[1],
      })
      toast.success('批量排班成功')
      setVisible(false)
      setSelectedKeys([])
    } catch {
      // error handled by interceptor
    }
  }

  const columns: TableProps<EmployeeShift>['columns'] = [
    { title: '工号', dataIndex: 'employeeNo', width: 120 },
    { title: '姓名', dataIndex: 'realName', width: 100 },
    { title: '部门', dataIndex: 'departmentName', width: 120 },
    { title: '岗位', dataIndex: 'positionName', width: 120 },
    {
      title: '当前班次',
      dataIndex: 'currentShift',
      width: 120,
      render: (value: string, record: EmployeeShift) => (
        value ? <Tag color={record.currentShiftColor || 'blue'}>{value}</Tag> : <Tag color="gray">未排班</Tag>
      ),
    },
  ]

  return (
    <div className={styles['schedule-assign']}>
      <Card bordered={false} className={styles['schedule-assign__card']}>
        <PageHeader
          title="排班分配"
          description="为员工批量分配班次，支持选择日期范围和指定班次。"
          extra={<Button type="primary" icon={<IconPlus />} onClick={handleBatchAssign}>批量排班</Button>}
        />
      </Card>

      <Card bordered={false} className={styles['schedule-assign__card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input className={styles['schedule-assign__input-keyword']} placeholder="姓名/工号" value={searchText} onChange={setSearchText} allowClear />
              </FormItem>
              <FormItem label="部门">
                <Select className={styles['schedule-assign__select-dept']} placeholder="请选择" value={searchDept} onChange={setSearchDept} allowClear>
                  {departments.map((dept) => (
                    <Option key={dept.id} value={dept.id}>{dept.name}</Option>
                  ))}
                </Select>
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
          searchText="搜索"
        />
      </Card>

      <Card bordered={false}>
        <div className={styles['schedule-assign__header']}>
          <div>
            <span className={styles['schedule-assign__title']}>排班分配</span>
            <Tag color="blue" className={styles['schedule-assign__tag-count']}>共 {total} 人</Tag>
          </div>
        </div>

        <Table
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          rowSelection={{ type: 'checkbox', selectedRowKeys: selectedKeys, onChange: (keys) => setSelectedKeys(keys as string[]) }}
          pagination={{ current: page, pageSize, total, showTotal: true, sizeCanChange: true, onChange: (p, ps) => loadData(p, ps) }}
        />
      </Card>

      <Modal focusLock title="批量排班" visible={visible} onOk={handleOk} onCancel={() => setVisible(false)} className={styles['schedule-assign__modal-medium']}>
        <Form form={form} layout="vertical">
          <FormItem label="日期范围" field="dateRange" rules={[{ required: true, message: '请选择日期范围' }]}>
            <RangePicker className={styles['schedule-assign__range-picker']} />
          </FormItem>
          <FormItem label="班次" field="shiftId" rules={[{ required: true, message: '请选择班次' }]}>
            <Select placeholder="请选择班次" className={styles['schedule-assign__select-shift']}>
              {shifts.map((shift) => (
                <Option key={shift.id} value={shift.id}>{shift.name} ({shift.startTime} - {shift.endTime})</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="说明">
            <div className={styles['schedule-assign__hint']}>
              {selectedKeys.length > 0 ? `已选择 ${selectedKeys.length} 人进行排班` : '未选择人员时，将对当前列表所有人员排班'}
            </div>
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default AssignPage
