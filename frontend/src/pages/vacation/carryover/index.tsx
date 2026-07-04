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
  Tag,
  Grid,
} from '@arco-design/web-react'
import {
  IconPlayArrow,
  IconClockCircle,
  IconSearch,
  IconRefresh,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getCarryoverRecords,
  runVacationCarryover,
  expireCarryoverRecords,
  getVacationTypes,
  type CarryoverRecord,
  type VacationType,
} from '@/api/vacation'
import { DepartmentSelect } from '@/components'
import { toast } from '@/utils/toast'
import styles from './carryover.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

const CARRYOVER_STATUS = [
  { value: 'active', label: '有效', color: 'green' },
  { value: 'expired', label: '已过期', color: 'red' },
  { value: 'used', label: '已用完', color: 'gray' },
]

function CarryoverPage() {
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<CarryoverRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [yearFilter, setYearFilter] = useState<string>('')
  const [vacationTypeFilter, setVacationTypeFilter] = useState<number | undefined>()
  const [keywordFilter, setKeywordFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const [carryoverModalVisible, setCarryoverModalVisible] = useState(false)
  const [expireModalVisible, setExpireModalVisible] = useState(false)
  const [carryoverForm] = Form.useForm()
  const [expireForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const [vacationTypes, setVacationTypes] = useState<VacationType[]>([])

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCarryoverRecords({
        page,
        pageSize,
        year: yearFilter ? Number(yearFilter) : undefined,
        vacationTypeId: vacationTypeFilter,
        keyword: keywordFilter || undefined,
        status: statusFilter || undefined,
      })
      if (res.code === 0) {
        setRecords(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, yearFilter, vacationTypeFilter, keywordFilter, statusFilter])

  const fetchVacationTypes = useCallback(async () => {
    try {
      const res = await getVacationTypes()
      if (res.code === 0) {
        setVacationTypes(res.data)
      }
    } catch {
      // error handled by interceptor
    }
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  useEffect(() => {
    fetchVacationTypes()
  }, [fetchVacationTypes])

  const handleSearch = () => {
    setPage(1)
    fetchRecords()
  }

  const handleReset = () => {
    setYearFilter('')
    setVacationTypeFilter(undefined)
    setKeywordFilter('')
    setStatusFilter('')
    setPage(1)
  }

  const openCarryoverModal = () => {
    const currentYear = new Date().getFullYear()
    carryoverForm.resetFields()
    carryoverForm.setFieldsValue({
      fromYear: currentYear,
      toYear: currentYear + 1,
    })
    setCarryoverModalVisible(true)
  }

  const handleCarryoverSubmit = async () => {
    try {
      const values = await carryoverForm.validate()
      setSubmitting(true)
      const res = await runVacationCarryover({
        fromYear: values.fromYear,
        toYear: values.toYear,
        vacationTypeId: values.vacationTypeId,
        departmentId: values.departmentId,
      })
      if (res.code === 0) {
        toast.success(
          `结转成功：处理 ${res.data.processedEmployees}/${res.data.totalEmployees} 人，共结转 ${res.data.totalCarryoverDays} 天`
        )
        setCarryoverModalVisible(false)
        fetchRecords()
      }
    } catch {
      // handled
    } finally {
      setSubmitting(false)
    }
  }

  const openExpireModal = () => {
    expireForm.resetFields()
    setExpireModalVisible(true)
  }

  const handleExpireSubmit = async () => {
    try {
      const values = await expireForm.validate()
      setSubmitting(true)
      const res = await expireCarryoverRecords({
        year: values.year,
        vacationTypeId: values.vacationTypeId,
      })
      if (res.code === 0) {
        toast.success(
          `处理完成：共 ${res.data.totalRecords} 条记录，过期 ${res.data.expiredRecords} 条，过期天数 ${res.data.expiredDays} 天`
        )
        setExpireModalVisible(false)
        fetchRecords()
      }
    } catch {
      // handled
    } finally {
      setSubmitting(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  const columns: TableProps<CarryoverRecord>['columns'] = [
    {
      title: '员工姓名',
      dataIndex: 'employeeName',
      width: 120,
      render: (val, record) => (
        <span className={styles['carryover__text-bold']}>
          {val}
          {record.employeeNo && (
            <span className={styles['carryover__employee-no']}>({record.employeeNo})</span>
          )}
        </span>
      ),
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      width: 120,
      render: (val) => val || '-',
    },
    {
      title: '假期类型',
      dataIndex: 'vacationTypeName',
      width: 120,
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: '来源年份',
      dataIndex: 'fromYear',
      width: 100,
    },
    {
      title: '目标年份',
      dataIndex: 'toYear',
      width: 100,
    },
    {
      title: '结转天数',
      dataIndex: 'carryoverDays',
      width: 100,
      render: (val: number) => `${val} 天`,
    },
    {
      title: '已过期天数',
      dataIndex: 'expiredDays',
      width: 110,
      render: (val?: number) => (val ? `${val} 天` : '0 天'),
    },
    {
      title: '过期日期',
      dataIndex: 'expireDate',
      width: 120,
      render: (val?: string) => val || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (val: string) => {
        const status = CARRYOVER_STATUS.find((s) => s.value === val)
        return (
          <Tag color={status?.color || 'gray'}>
            {status?.label || val}
          </Tag>
        )
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 170,
    },
  ]

  return (
    <div className={styles.carryover}>
      <Card
        bordered={false}
        className={styles.carryover__card}
        title="假期结转记录"
        extra={
          <Space>
            <Button icon={<IconRefresh />} onClick={fetchRecords}>
              刷新
            </Button>
            <Button
              status="warning"
              icon={<IconClockCircle />}
              onClick={openExpireModal}
            >
              处理过期
            </Button>
            <Button
              type="primary"
              icon={<IconPlayArrow />}
              onClick={openCarryoverModal}
            >
              执行结转
            </Button>
          </Space>
        }
      >
        <div className={styles['carryover__filter-bar']}>
          <Form layout="inline">
            <FormItem label="年份">
              <Select
                placeholder="全部"
                value={yearFilter}
                onChange={setYearFilter}
                allowClear
                style={{ width: 120 }}
              >
                {yearOptions.map((y) => (
                  <Option key={y} value={String(y)}>
                    {y}年
                  </Option>
                ))}
              </Select>
            </FormItem>
            <FormItem label="假期类型">
              <Select
                placeholder="全部"
                value={vacationTypeFilter}
                onChange={setVacationTypeFilter}
                allowClear
                style={{ width: 150 }}
              >
                {vacationTypes.map((vt) => (
                  <Option key={vt.id} value={vt.id}>
                    {vt.name}
                  </Option>
                ))}
              </Select>
            </FormItem>
            <FormItem label="员工">
              <Input
                placeholder="搜索员工姓名/工号"
                value={keywordFilter}
                onChange={setKeywordFilter}
                allowClear
                style={{ width: 200 }}
              />
            </FormItem>
            <FormItem label="状态">
              <Select
                placeholder="全部"
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
                style={{ width: 120 }}
              >
                {CARRYOVER_STATUS.map((s) => (
                  <Option key={s.value} value={s.value}>
                    {s.label}
                  </Option>
                ))}
              </Select>
            </FormItem>
            <FormItem>
              <Space>
                <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
                  搜索
                </Button>
                <Button onClick={handleReset}>重置</Button>
              </Space>
            </FormItem>
          </Form>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={records}
          scroll={{ x: 1200 }}
          pagination={{
            total,
            current: page,
            pageSize,
            showTotal: true,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal focusLock
        title="执行假期结转"
        visible={carryoverModalVisible}
        onOk={handleCarryoverSubmit}
        onCancel={() => setCarryoverModalVisible(false)}
        confirmLoading={submitting}
        className={styles.carryover__modal}
        okText="执行结转"
        cancelText="取消"
      >
        <Form form={carryoverForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="来源年份"
                field="fromYear"
                rules={[{ required: true, message: '请选择来源年份' }]}
              >
                <Select placeholder="请选择">
                  {yearOptions.map((y) => (
                    <Option key={y} value={y}>
                      {y}年
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="目标年份"
                field="toYear"
                rules={[{ required: true, message: '请选择目标年份' }]}
              >
                <Select placeholder="请选择">
                  {yearOptions.map((y) => (
                    <Option key={y} value={y}>
                      {y}年
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
          </Row>
          <FormItem label="假期类型" field="vacationTypeId">
            <Select placeholder="全部假期类型" allowClear>
              {vacationTypes
                .filter((vt) => vt.isCarryOver)
                .map((vt) => (
                  <Option key={vt.id} value={vt.id}>
                    {vt.name}
                  </Option>
                ))}
            </Select>
          </FormItem>
          <FormItem label="部门" field="departmentId">
            <DepartmentSelect placeholder="全部部门" />
          </FormItem>
          <div className={styles['carryover__modal-tip']}>
            <span className={styles['carryover__tip-title']}>提示：</span>
            系统将把来源年度剩余可结转的假期天数结转至目标年度。仅对支持结转的假期类型生效。
          </div>
        </Form>
      </Modal>

      <Modal focusLock
        title="处理过期结转"
        visible={expireModalVisible}
        onOk={handleExpireSubmit}
        onCancel={() => setExpireModalVisible(false)}
        confirmLoading={submitting}
        className={styles.carryover__modal}
        okText="立即处理"
        cancelText="取消"
      >
        <Form form={expireForm} layout="vertical">
          <FormItem label="年份" field="year">
            <Select placeholder="全部年份" allowClear>
              {yearOptions.map((y) => (
                <Option key={y} value={y}>
                  {y}年
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="假期类型" field="vacationTypeId">
            <Select placeholder="全部假期类型" allowClear>
              {vacationTypes.map((vt) => (
                <Option key={vt.id} value={vt.id}>
                  {vt.name}
                </Option>
              ))}
            </Select>
          </FormItem>
          <div className={styles['carryover__modal-tip']}>
            <span className={styles['carryover__tip-title']}>提示：</span>
            系统将自动处理已过有效期的结转记录，将过期天数从剩余额度中扣除。此操作不可撤销。
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default CarryoverPage
