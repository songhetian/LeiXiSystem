import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Form,
  Tag,
  Card,
  Statistic,
  Grid,
  Progress,
  Spin,
  Message,
} from '@arco-design/web-react'
import {
  IconSearch,
  IconRefresh,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getVacationBalance, getVacationTypes } from '@/api/vacation'
import type { VacationBalance, VacationType } from '@/api/vacation'
import './quota.css'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface QuotaRow {
  vacationTypeId: number
  typeName: string
  typeCode: string
  total: number
  used: number
  balance: number
  unit: 'day' | 'hour'
}

function Quota() {
  const [employeeId, setEmployeeId] = useState<number | undefined>()
  const [employeeNo, setEmployeeNo] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [searchDept, setSearchDept] = useState<string | undefined>()
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [balances, setBalances] = useState<VacationBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [types, setTypes] = useState<VacationType[]>([])

  const fetchTypes = async () => {
    try {
      const res = await getVacationTypes()
      setTypes(res.data)
    } catch {
      // error handled by interceptor
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getVacationBalance({
        employeeId,
        year: Number(year),
      })
      setBalances(res.data)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTypes()
  }, [])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const handleSearch = () => {
    if (!employeeId) {
      Message.warning('请先选择员工')
      return
    }
    fetchData()
  }

  const handleReset = () => {
    setEmployeeId(undefined)
    setEmployeeNo('')
    setEmployeeName('')
    setSearchDept(undefined)
  }

  const totalAll = balances.reduce((sum, b) => sum + b.total, 0)
  const usedAll = balances.reduce((sum, b) => sum + b.used, 0)
  const balanceAll = balances.reduce((sum, b) => sum + b.balance, 0)
  const usageRate = totalAll > 0 ? ((usedAll / totalAll) * 100).toFixed(1) : '0'

  const columns: TableProps<QuotaRow>['columns'] = [
    {
      title: '假期类型',
      dataIndex: 'typeName',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '总额度',
      dataIndex: 'total',
      width: 100,
      render: (value: number, record) => `${value} ${record.unit === 'day' ? '天' : '小时'}`,
    },
    {
      title: '已使用',
      dataIndex: 'used',
      width: 100,
      render: (value: number, record) => `${value} ${record.unit === 'day' ? '天' : '小时'}`,
    },
    {
      title: '剩余',
      dataIndex: 'balance',
      width: 100,
      render: (value: number, record) => `${value} ${record.unit === 'day' ? '天' : '小时'}`,
    },
    {
      title: '使用率',
      width: 200,
      render: (_: unknown, record) => (
        <div className="vacation-quota__progress-cell">
          <Progress
            percent={record.total > 0 ? Math.round((record.used / record.total) * 100) : 0}
            status="normal"
            className="vacation-quota__progress-bar"
          />
          <span className="vacation-quota__progress-text">
            {record.used}/{record.total}
          </span>
        </div>
      ),
    },
  ]

  const summary = [
    { title: '总额度', value: `${totalAll} 天`, color: '#165DFF' },
    { title: '已使用', value: `${usedAll} 天`, color: '#FF7D00' },
    { title: '剩余', value: `${balanceAll} 天`, color: '#00B42A' },
    { title: '使用率', value: `${usageRate}%`, color: '#86909C' },
  ]

  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  const tableData = balances.map((b) => ({
    vacationTypeId: b.vacationTypeId,
    typeName: b.typeName,
    typeCode: b.typeCode,
    total: b.total,
    used: b.used,
    balance: b.balance,
    unit: b.unit,
  }))

  return (
    <div className="vacation-quota">
      <Row gutter={16} className="vacation-quota__stats-row">
        {summary.map((item, index) => (
          <Col span={6} key={index}>
            <Card bordered={false}>
              <Statistic title={item.title} value={item.value} className="vacation-quota__statistic-value" style={{ "--statistic-value-color": item.color } as React.CSSProperties} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} className="vacation-quota__search-card">
        <Form layout="inline">
          <FormItem label="员工ID">
            <Input
              className="vacation-quota__search-input"
              placeholder="请输入员工ID"
              type="number"
              value={employeeId ? String(employeeId) : ''}
              onChange={(val) => setEmployeeId(val ? Number(val) : undefined)}
              allowClear
            />
          </FormItem>
          <FormItem label="年度">
            <Select
              className="vacation-quota__year-select"
              value={year}
              onChange={setYear}
            >
              {yearOptions.map((y) => (
                <Option key={y} value={String(y)}>{y}年</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
                查询
              </Button>
              <Button icon={<IconRefresh />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false} className="vacation-quota__table-card">
        <div className="vacation-quota__table-header">
          <span className="vacation-quota__table-title">假期额度详情</span>
          <Tag color="blue" className="vacation-quota__total-tag">
            共 {balances.length} 种
          </Tag>
        </div>

        <Spin loading={loading}>
          <Table
            columns={columns}
            data={tableData}
            rowKey="vacationTypeId"
            pagination={false}
          />
        </Spin>
      </Card>
    </div>
  )
}

export default Quota
