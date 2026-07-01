import { useState, useEffect } from 'react'
import { Card, Table, Button, Tag, Message, Space, DatePicker } from '@arco-design/web-react'
import PageContainer from '@/components/PageContainer'
import { get, post } from '@/api/request'

export default function PendingSettlementsPage() {
  const [settlements, setSettlements] = useState<any>(null)
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sRes, bRes] = await Promise.all([get('/overtime-payroll/pending-settlements'), get('/overtime-payroll/settlement-batches')])
      setSettlements(sRes.data); setBatches(bRes.data?.list || bRes.data || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])

  const createBatch = async () => {
    try {
      await post('/overtime-payroll/settlement-batches', { type: 'monthly' })
      Message.success('批次创建成功'); fetchAll()
    } catch (e: any) { Message.error(e.message || '创建失败') }
  }

  return (
    <PageContainer title="加班结算" description="审核待结算加班记录并生成工资批次"
      breadcrumbs={[{ label: '薪资中心' }, { label: '加班结算' }]}
      extra={<Button type="primary" onClick={createBatch}>生成结算批次</Button>}
      onRefresh={fetchAll}
    >
      <div className="lx-stat-grid lx-fade-in">
        <Card className="lx-stat-card">
          <div style={{ fontSize: 28, fontWeight: 700 }}>{settlements?.list?.length ?? 0}</div>
          <div style={{ color: 'var(--color-text-3)', fontSize: 13, marginTop: 4 }}>待结算记录</div>
        </Card>
        <Card className="lx-stat-card">
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f53f3f' }}>¥{settlements?.totalPendingPay?.toFixed(2) ?? '0.00'}</div>
          <div style={{ color: 'var(--color-text-3)', fontSize: 13, marginTop: 4 }}>待付款总额</div>
        </Card>
        <Card className="lx-stat-card">
          <div style={{ fontSize: 28, fontWeight: 700 }}>{settlements?.totalHours ?? 0}h</div>
          <div style={{ color: 'var(--color-text-3)', fontSize: 13, marginTop: 4 }}>总时长</div>
        </Card>
        <Card className="lx-stat-card">
          <div style={{ fontSize: 28, fontWeight: 700 }}>{batches.length}</div>
          <div style={{ color: 'var(--color-text-3)', fontSize: 13, marginTop: 4 }}>批次</div>
        </Card>
      </div>

      <Card title="批次列表" className="lx-fade-in">
        <Table columns={[
          { title: '批次号', dataIndex: 'batchNo', width: 160 },
          { title: '结算类型', dataIndex: 'settlementType', width: 100, render: (v: string) => <Tag size="small">{v === 'monthly' ? '月度' : '临时'}</Tag> },
          { title: '期间', width: 200, render: (_: any, r: any) => `${r.periodStart?.split('T')[0] || ''} ~ ${r.periodEnd?.split('T')[0] || ''}` },
          { title: '总金额', dataIndex: 'totalPay', width: 120, render: (v: number) => v ? `¥${v.toFixed(2)}` : '-' },
          { title: '创建时间', dataIndex: 'createdAt', width: 160 },
        ]} data={batches} rowKey="id" pagination={false} loading={loading} />
      </Card>
    </PageContainer>
  )
}
