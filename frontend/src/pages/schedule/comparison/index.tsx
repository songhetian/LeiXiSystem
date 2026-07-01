import { useState, useEffect } from 'react'
import { Card, Table, Tag, Space, Select } from '@arco-design/web-react'
import Row from '@arco-design/web-react/es/Grid/row'
import Col from '@arco-design/web-react/es/Grid/col'
import PageContainer from '@/components/PageContainer'
import { get } from '@/api/request'

export default function ScheduleComparisonPage() {
  const [versions, setVersions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [v1, setV1] = useState('')
  const [v2, setV2] = useState('')
  const [diffs, setDiffs] = useState<any>(null)

  const fetchVersions = async () => {
    setLoading(true)
    try { const r = await get('/schedule/versions'); setVersions(r.data?.list || r.data || []) } finally { setLoading(false) }
  }
  useEffect(() => { fetchVersions() }, [])

  const compare = async () => {
    if (!v1 || !v2) return
    try { const r = await get(`/schedule/versions/compare?v1=${v1}&v2=${v2}`); setDiffs(r.data) } catch {}
  }
  useEffect(() => { compare() }, [v1, v2])

  const vOpts = versions.map((v: any) => ({ label: `${v.name || v.id} (${v.createdAt?.split('T')[0] || ''})`, value: String(v.id) }))

  return (
    <PageContainer title="排班版本对比" description="对比不同版本排班的差异"
      breadcrumbs={[{ label: '排班管理' }, { label: '版本对比' }]}
    >
      <div className="lx-toolbar lx-fade-in">
        <Space>
          <Select placeholder="版本 A" options={vOpts} value={v1} onChange={setV1} style={{ width: 220 }} />
          <span style={{ color: 'var(--color-text-3)', fontWeight: 600 }}>vs</span>
          <Select placeholder="版本 B" options={vOpts} value={v2} onChange={setV2} style={{ width: 220 }} />
        </Space>
      </div>

      {diffs && (
        <Row gutter={16} className="lx-fade-in">
          <Col span={8}>
            <Card title="变更统计"><div style={{ fontSize: 24, fontWeight: 700 }}>{diffs.changedCount ?? 0} <span style={{ fontSize: 14, color: 'var(--color-text-3)' }}>项变更</span></div></Card>
          </Col>
          <Col span={8}>
            <Card title="新增"><div style={{ fontSize: 24, fontWeight: 700, color: '#00b42a' }}>{diffs.addedCount ?? 0}</div></Card>
          </Col>
          <Col span={8}>
            <Card title="移除"><div style={{ fontSize: 24, fontWeight: 700, color: '#f53f3f' }}>{diffs.removedCount ?? 0}</div></Card>
          </Col>
        </Row>
      )}

      {diffs?.details && (
        <Card title="变更明细" className="lx-fade-in">
          <Table columns={[
            { title: '员工', dataIndex: 'employeeName', width: 120 },
            { title: '日期', dataIndex: 'date', width: 120 },
            { title: 'V1 班次', dataIndex: 'v1Shift', width: 120 },
            { title: 'V2 班次', dataIndex: 'v2Shift', width: 120 },
            { title: '变化', dataIndex: 'changeType', width: 100, render: (v: string) => <Tag size="small" color={v === 'added' ? 'green' : v === 'removed' ? 'red' : 'orange'}>{v === 'added' ? '新增' : v === 'removed' ? '移除' : '变更'}</Tag> },
          ]} data={diffs.details} rowKey="id" pagination={false} size="small" />
        </Card>
      )}
    </PageContainer>
  )
}
