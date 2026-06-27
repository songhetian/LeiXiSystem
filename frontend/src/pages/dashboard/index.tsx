import { Card, Table, Tag, Statistic, List, Typography, Space } from '@arco-design/web-react'
import Row from '@arco-design/web-react/es/Grid/row'
import Col from '@arco-design/web-react/es/Grid/col'
import { useNavigate } from 'react-router-dom'
import './index.css'

const { Title, Text } = Typography

const columns = [
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
    title: '今日状态',
    dataIndex: 'status',
    width: 100,
    render: (value: string) => {
      const colorMap: Record<string, string> = {
        正常: 'green',
        迟到: 'orange',
        早退: 'orange',
        请假: 'blue',
        旷工: 'red',
      }
      return <Tag color={colorMap[value]}>{value}</Tag>
    },
  },
  {
    title: '打卡时间',
    dataIndex: 'checkIn',
    width: 120,
  },
]

const mockData = [
  { id: 1, name: '张三', department: '技术部', status: '正常', checkIn: '08:55' },
  { id: 2, name: '李四', department: '产品部', status: '迟到', checkIn: '09:15' },
  { id: 3, name: '王五', department: '市场部', status: '正常', checkIn: '08:58' },
  { id: 4, name: '赵六', department: '技术部', status: '请假', checkIn: '-' },
  { id: 5, name: '钱七', department: '人事部', status: '正常', checkIn: '08:50' },
]

const todoList = [
  { id: 1, title: '员工入职审批：张三', desc: '待审批', time: '10分钟前' },
  { id: 2, title: '请假审批：李四（3天年假）', desc: '待审批', time: '30分钟前' },
  { id: 3, title: '报销审批：王五（500元）', desc: '待审批', time: '1小时前' },
  { id: 4, title: '加班审批：赵六（2小时）', desc: '待审批', time: '2小时前' },
  { id: 5, title: '转正审批：钱七', desc: '待审批', time: '昨天' },
]

function Dashboard() {
  const navigate = useNavigate()

  return (
    <div style={{ paddingBottom: 20 }}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div>
          <Title heading={4} style={{ margin: '0 0 4px 0' }}>
            欢迎回来，管理员 👋
          </Title>
          <Text type="secondary">今天是工作日，祝您工作愉快！</Text>
        </div>

        <Row gutter={16}>
          <Col span={6}>
            <Card bordered={false}>
              <Statistic title="员工总数" value={128} />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false}>
              <Statistic title="今日出勤" value={115} />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false}>
              <Statistic title="待审批" value={8} />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false}>
              <Statistic title="本月请假" value={24} />
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={16}>
            <Card
              bordered={false}
              title="今日考勤概览"
              extra={<a onClick={() => navigate('/attendance/records')}>查看全部</a>}
            >
              <Table columns={columns} data={mockData} pagination={false} size="small" />
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false} title="待办事项" extra={<a>全部</a>}>
              <List
                size="small"
                dataSource={todoList}
                render={(item) => (
                  <List.Item key={item.id}>
                    <List.Item.Meta
                      title={item.title}
                      description={item.desc}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.time}
                    </Text>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  )
}

export default Dashboard
