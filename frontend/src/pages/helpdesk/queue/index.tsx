import { useState, useEffect } from 'react'
import { Card, Table, Tag, Space, Button, Statistic } from '@arco-design/web-react'
import { IconRefresh } from '@arco-design/web-react/icon'
import Row from '@arco-design/web-react/es/Grid/row'
import Col from '@arco-design/web-react/es/Grid/col'
import PageContainer from '@/components/PageContainer'
import { getQueueStatus, getAssignableEmployees } from '@/api/helpdesk'

export default function QueueMonitorPage() {
  const [queue, setQueue] = useState<any>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [qRes, eRes] = await Promise.all([getQueueStatus(), getAssignableEmployees()])
      setQueue(qRes.data); setEmployees(eRes.data || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])
  useEffect(() => { const t = setInterval(fetchAll, 30000); return () => clearInterval(t) }, [])

  return (
    <PageContainer title="队列监控" description="实时工单排队与坐席负载 · 30s 自动刷新"
      breadcrumbs={[{ label: 'HR服务台' }, { label: '队列监控' }]}
      extra={<Button icon={<IconRefresh />} onClick={fetchAll} loading={loading}>刷新</Button>}
    >
      <div className="lx-stat-grid lx-fade-in">
        <Card className="lx-stat-card"><Statistic title="排队工单" value={queue?.queueLength ?? 0} /></Card>
        <Card className="lx-stat-card"><Statistic title="平均等待" value={queue?.avgWaitMinutes ?? 0} suffix="分钟" /></Card>
        <Card className="lx-stat-card"><Statistic title="可分配坐席" value={employees.filter((e: any) => e.available).length} suffix="人" /></Card>
        <Card className="lx-stat-card"><Statistic title="总在线" value={employees.length} suffix="人" /></Card>
      </div>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="优先级分布" className="lx-fade-in lx-fade-in--delay">
            <Space size="large">
              <Tag color="red" size="large">{queue?.priorities?.high ?? 0} 高</Tag>
              <Tag color="orange" size="large">{queue?.priorities?.medium ?? 0} 中</Tag>
              <Tag size="large">{queue?.priorities?.low ?? 0} 低</Tag>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="坐席负荷" className="lx-fade-in lx-fade-in--delay">
            <Table columns={[
              { title: '坐席', dataIndex: 'realName', width: 90 },
              { title: '工单', dataIndex: 'activeTickets', width: 80, render: (v: number, r: any) => `${v}/${r.maxTickets}` },
              { title: '负荷', width: 120, render: (_: any, r: any) => { const p = Math.round((r.activeTickets / r.maxTickets) * 100); return <Tag size="small" color={p >= 90 ? 'red' : p >= 70 ? 'orange' : 'green'}>{p}%</Tag> } },
              { title: '状态', dataIndex: 'available', width: 80, render: (v: boolean) => <Tag size="small" color={v ? 'green' : 'red'}>{v ? '空闲' : '满'}</Tag> },
            ]} data={employees} rowKey="userId" pagination={false} size="small" />
          </Card>
        </Col>
      </Row>
    </PageContainer>
  )
}
