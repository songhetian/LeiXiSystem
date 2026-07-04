import { useState, useEffect } from 'react'
import {
  Card,
  Input,
  Select,
  Form,
  Tag,
  Table,
  Grid,
  Progress,
  Avatar,
  Spin,
} from '@arco-design/web-react'
import { IconUser } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getVacationBalance } from '@/api/vacation'
import type { VacationBalance } from '@/api/vacation'
import { PageHeader, FilterBar, TableHeader } from '@/components'
import styles from './balance.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

const colorMap: Record<string, string> = {
  ANNUAL: '#10B981',
  PERSONAL: '#F59E0B',
  SICK: '#3B82F6',
  MARRIAGE: '#8B5CF6',
  MATERNITY: '#EC4899',
  BEREAVEMENT: '#6B7280',
  COMPENSATORY: '#06B6D4',
}

function Balance() {
  const [employeeNo, setEmployeeNo] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [balances, setBalances] = useState<VacationBalance[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getVacationBalance({
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
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const handleSearch = () => {
    fetchData()
  }

  const handleReset = () => {
    setEmployeeNo('')
    setEmployeeName('')
    fetchData()
  }

  const getColor = (typeCode: string) => {
    return colorMap[typeCode] || '#10B981'
  }

  const columns: TableProps<VacationBalance>['columns'] = [
    {
      title: '假期类型',
      dataIndex: 'typeName',
      width: 120,
      render: (value: string, record) => (
        <Tag color={getColor(record.typeCode)}>{value}</Tag>
      ),
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
      render: (value: number, record) => (
        <span className={styles['vacation-balance__balance-text']} style={{ "--balance-text-color": getColor(record.typeCode) } as React.CSSProperties}>
          {value} {record.unit === 'day' ? '天' : '小时'}
        </span>
      ),
    },
    {
      title: '使用进度',
      dataIndex: 'progress',
      render: (_: unknown, record) => (
        <Progress
          percent={record.total > 0 ? Math.round((record.used / record.total) * 100) : 0}
          color={getColor(record.typeCode)}
          className={styles['vacation-balance__progress']}
        />
      ),
    },
  ]

  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className={styles['vacation-balance']}>
      <Card bordered={false} className={styles['vacation-balance__card']}>
        <PageHeader
          title="假期余额"
          description="查看员工各类型假期的剩余额度及使用进度"
        />
      </Card>

      <Card bordered={false} className={styles['vacation-balance__card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="工号">
                <Input
                  className={styles['vacation-balance__search-input']}
                  placeholder="请输入工号"
                  value={employeeNo}
                  onChange={setEmployeeNo}
                  allowClear
                />
              </FormItem>
              <FormItem label="姓名">
                <Input
                  className={styles['vacation-balance__search-input']}
                  placeholder="请输入姓名"
                  value={employeeName}
                  onChange={setEmployeeName}
                  allowClear
                />
              </FormItem>
              <FormItem label="年度">
                <Select
                  className={styles['vacation-balance__year-select']}
                  value={year}
                  onChange={setYear}
                >
                  {yearOptions.map((y) => (
                    <Option key={y} value={String(y)}>{y}年</Option>
                  ))}
                </Select>
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
        />
      </Card>

      <Row gutter={16}>
        <Col span={6}>
          <Card bordered={false} className={styles['vacation-balance__avatar-card']}>
            <Avatar size={80} className={styles['vacation-balance__avatar']}>
              <IconUser className={styles['vacation-balance__avatar-icon']} />
            </Avatar>
            <h3 className={styles['vacation-balance__employee-name']}>当前用户</h3>
            <Tag color="blue">EMP000</Tag>
            <div className={styles['vacation-balance__employee-no']}>
              暂无部门信息
            </div>
          </Card>
        </Col>

        <Col span={18}>
          <Card bordered={false} className={styles['vacation-balance__table-card']}>
            <TableHeader title="假期余额" />
            <Spin loading={loading}>
              <Table
                columns={columns}
                data={balances}
                rowKey="id"
                pagination={false}
              />
            </Spin>
          </Card>

          <Card bordered={false} className={styles['vacation-balance__overview-card']}>
            <div className={styles['vacation-balance__overview-title']}>额度概览</div>
            <Row gutter={16}>
              {balances.map((item) => (
                <Col span={6} key={item.id}>
                  <Card bordered className={styles['vacation-balance__stat-card']}>
                    <div
                      className={styles['vacation-balance__stat-value']} style={{ "--stat-value-color": getColor(item.typeCode) } as React.CSSProperties}
                    >
                      {item.balance}
                    </div>
                    <div className={styles['vacation-balance__stat-label']}>
                      {item.typeName}剩余({item.unit === 'day' ? '天' : '小时'})
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Balance
