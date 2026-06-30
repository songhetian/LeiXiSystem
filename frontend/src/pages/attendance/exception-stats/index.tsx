import { useEffect, useState } from 'react'
import {
  Card,
  Grid,
  Statistic,
  Table,
  Tag,
  Typography,
  Space,
  Form,
  DatePicker,
  Button,
} from '@arco-design/web-react'
import type { TableColumnProps } from '@arco-design/web-react'
import { IconUser, IconExclamation, IconCheck, IconClose } from '@arco-design/web-react/icon'
import { get } from '@/api/request'
import { EXCEPTION_TYPES } from '@/api/attendance-exception'
import './stats.css'

const { Row, Col } = Grid
const { Title, Text } = Typography
const FormItem = Form.Item
const RangePicker = DatePicker.RangePicker

interface StatsData {
  summary: {
    total: number
    pending: number
    resolved: number
    rejected: number
    resolveRate: number
  }
  typeStats: Array<{ type: string; label: string; count: number }>
  trend: Array<{ date: string; count: number }>
  topEmployees: Array<{
    id: number
    employeeNo: string
    count: number
    user: { realName: string; department?: { name: string } }
  }>
}

function AttendanceExceptionStats() {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [form] = Form.useForm()

  const loadStats = async (values?: { dateRange?: [Date, Date] }) => {
    setLoading(true)
    try {
      const params: any = {}
      if (values?.dateRange?.length === 2) {
        params.startDate = values.dateRange[0].toISOString().split('T')[0]
        params.endDate = values.dateRange[1].toISOString().split('T')[0]
      }
      const res = await get<any>('/attendance/exceptions/stats/summary', { params })
      if (res.code === 0) {
        setStats(res.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleSearch = () => {
    const values = form.getFieldsValue()
    loadStats(values)
  }

  const handleReset = () => {
    form.resetFields()
    loadStats()
  }

  const typeColumns: TableColumnProps<{ type: string; label: string; count: number }>[] = [
    {
      title: '异常类型',
      dataIndex: 'label',
      render: (val: string) => (
        <Space>
          <Tag color="orange">{val}</Tag>
        </Space>
      ),
    },
    {
      title: '数量',
      dataIndex: 'count',
      width: 120,
      render: (val: number) => <span className="exception-stats__bold">{val}</span>,
    },
    {
      title: '占比',
      dataIndex: 'count',
      render: (val: number) => {
        if (!stats?.summary.total) return '0%'
        return `${Math.round((val / stats.summary.total) * 100)}%`
      },
    },
  ]

  const topEmployeeColumns: TableColumnProps<StatsData['topEmployees'][number]>[] = [
    {
      title: '排名',
      dataIndex: 'index',
      width: 60,
      render: (_: unknown, __: unknown, index: number) => {
        const colors = ['#FF7D00', '#FFB400', '#00B42A']
        if (index < 3) {
          return <Tag color={colors[index]} className="exception-stats__bold">#{index + 1}</Tag>
        }
        return <span className="exception-stats__text-muted">#{index + 1}</span>
      },
    },
    {
      title: '员工',
      dataIndex: 'user.realName',
      render: (_, record) => record.user?.realName || '-',
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 120,
    },
    {
      title: '部门',
      dataIndex: 'user.department.name',
      render: (_, record) => record.user?.department?.name || '-',
    },
    {
      title: '异常次数',
      dataIndex: 'count',
      width: 120,
      render: (val: number) => (
        <Tag color="red" className="exception-stats__bold">{val} 次</Tag>
      ),
    },
  ]

  // 简易柱状图趋势
  const maxTrendCount = Math.max(...(stats?.trend?.map((t) => t.count) || [0]), 1)

  return (
    <div className="exception-stats">
      <Card bordered={false} className="exception-stats__card">
        <Space direction="vertical" size={4}>
          <Title heading={5} className="exception-stats__title">考勤异常统计</Title>
          <Text type="secondary">查看异常分布、处理进度和重点关注人员</Text>
        </Space>
      </Card>

      <Card bordered={false} className="exception-stats__card">
        <Form form={form} layout="inline">
          <FormItem label="日期范围" field="dateRange">
            <RangePicker className="exception-stats__picker" />
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" onClick={handleSearch}>查询</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} className="exception-stats__card">
        <Col span={6}>
          <Card bordered={false} loading={loading}>
            <Statistic
              title={<span className="exception-stats__stat-title">异常总数</span>}
              value={stats?.summary.total || 0}
              prefix={<IconExclamation className="exception-stats__stat-icon" style={{ color: "#F53F3F" }} />}
              styleValue={{ fontSize: 32, fontWeight: 600, color: '#F53F3F' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} loading={loading}>
            <Statistic
              title={<span className="exception-stats__stat-title">待处理</span>}
              value={stats?.summary.pending || 0}
              prefix={<IconClose className="exception-stats__stat-icon" style={{ color: "#FF7D00" }} />}
              styleValue={{ fontSize: 32, fontWeight: 600, color: '#FF7D00' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} loading={loading}>
            <Statistic
              title={<span className="exception-stats__stat-title">已解决</span>}
              value={stats?.summary.resolved || 0}
              prefix={<IconCheck className="exception-stats__stat-icon" style={{ color: "#00B42A" }} />}
              styleValue={{ fontSize: 32, fontWeight: 600, color: '#00B42A' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} loading={loading}>
            <Statistic
              title={<span className="exception-stats__stat-title">处理率</span>}
              value={stats?.summary.resolveRate || 0}
              suffix="%"
              prefix={<IconUser className="exception-stats__stat-icon" style={{ color: "#165DFF" }} />}
              styleValue={{ fontSize: 32, fontWeight: 600, color: '#165DFF' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 异常类型分布 */}
        <Col span={12}>
          <Card bordered={false} title="异常类型分布" className="exception-stats__card">
            <Table
              rowKey="type"
              loading={loading}
              data={stats?.typeStats || []}
              columns={typeColumns}
              pagination={false}
            />
          </Card>
        </Col>

        {/* Top 10 异常员工 */}
        <Col span={12}>
          <Card bordered={false} title="异常次数 Top 10" className="exception-stats__card">
            <Table
              rowKey="id"
              loading={loading}
              data={stats?.topEmployees || []}
              columns={topEmployeeColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势图 */}
      <Card bordered={false} title="异常趋势">
        {stats?.trend?.length ? (
          <div className="trend-chart">
            {stats.trend.map((item) => (
              <div key={item.date} className="trend-item">
                <div className="trend-bar-wrapper">
                  <div
                    className="trend-bar"
                    style={{ height: `${(item.count / maxTrendCount) * 100}%` }}
                  />
                </div>
                <div className="trend-value">{item.count}</div>
                <div className="trend-date">{item.date.slice(5)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="exception-stats__empty">
            {loading ? '加载中...' : '暂无数据'}
          </div>
        )}
      </Card>
    </div>
  )
}

export default AttendanceExceptionStats
