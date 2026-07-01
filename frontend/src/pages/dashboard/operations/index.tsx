import { useState, useEffect } from 'react'
import { Card, Statistic, Tag, Space, Switch } from '@arco-design/web-react'
import PageContainer from '@/components/PageContainer'
import { get } from '@/api/request'
import styles from './operations.module.css'

export default function OperationsDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [screenMode, setScreenMode] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try { const r = await get('/dashboard/operations'); setData(r.data) } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])
  useEffect(() => {
    const t = setInterval(fetchData, screenMode ? 10000 : 30000)
    return () => clearInterval(t)
  }, [screenMode])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setScreenMode(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const m = data?.metrics
  const alerts = data?.alerts || []

  if (screenMode) {
    return (
      <div className={styles['lx-screen']}>
        <div className={styles['lx-screen__head']}>
          <h1>运营仪表盘</h1>
          <span className={styles['lx-screen__meta']}>10s 刷新 · ESC 退出</span>
        </div>
        <div className="lx-stat-grid">
          <Card className="lx-stat-card" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic title={<span style={{ color: '#94a3b8' }}>排队工单</span>} value={m?.customerService?.queueLength ?? 0} style={{ color: '#f8fafc' }} />
          </Card>
          <Card className="lx-stat-card" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic title={<span style={{ color: '#94a3b8' }}>SLA 合规</span>} value={m?.customerService?.slaComplianceRate ?? 100} suffix="%" style={{ color: '#f8fafc' }} />
          </Card>
          <Card className="lx-stat-card" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <Statistic title={<span style={{ color: '#94a3b8' }}>满意度</span>} value={m?.customerService?.avgSatisfaction ?? '-'} style={{ color: '#f8fafc' }} />
          </Card>
          <Card className="lx-stat-card" style={{ background: alerts.length > 0 ? '#450a0a' : '#1e293b', borderColor: alerts.length > 0 ? '#dc2626' : '#334155' }}>
            <Statistic title={<span style={{ color: '#94a3b8' }}>告警 · {alerts.length} 项</span>} value={alerts.length === 0 ? '✓ 正常' : '⚠'} style={{ color: alerts.length === 0 ? '#22c55e' : '#f87171', fontSize: alerts.length === 0 ? 28 : 36 }} />
          </Card>
        </div>
        {alerts.length > 0 && (
          <div className={styles['lx-screen__alerts']}>
            {alerts.map((a: any, i: number) => (
              <Tag key={i} color={a.level === 'critical' ? 'red' : 'orange'} size="large">
                {a.metricName}: {typeof a.currentValue === 'number' ? a.currentValue.toFixed(1) : a.currentValue}
              </Tag>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <PageContainer
      title="运营仪表盘"
      description="实时监控客服产能、排班效率与系统告警"
      extra={<Space><span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>投屏</span><Switch size="small" checked={screenMode} onChange={setScreenMode} /></Space>}
      loading={loading && !data}
      onRefresh={fetchData}
    >
      {data ? (
        <>
          <div className="lx-stat-grid lx-fade-in">
            <Card className="lx-stat-card">
              <Statistic title="排队工单" value={m?.customerService?.queueLength ?? 0} />
            </Card>
            <Card className="lx-stat-card">
              <Statistic title="SLA 合规率" value={m?.customerService?.slaComplianceRate ?? 100} suffix="%" />
            </Card>
            <Card className="lx-stat-card">
              <Statistic title="满意度均分" value={m?.customerService?.avgSatisfaction ?? '-'} />
            </Card>
            <Card className="lx-stat-card">
              <Statistic title="今日解决率" value={m?.customerService?.resolutionRate ?? 100} suffix="%" />
            </Card>
          </div>

          <div className="lx-stat-grid lx-fade-in lx-fade-in--delay">
            <Card className="lx-stat-card" title="排班概览">
              <div className="lx-detail-row">
                <span className="lx-detail-row__label">到岗率</span>
                <span className="lx-detail-row__value">{m?.schedule?.attendanceRate ?? 0}%</span>
              </div>
              <div className="lx-detail-row">
                <span className="lx-detail-row__label">偏差率</span>
                <span className="lx-detail-row__value" style={{ color: (m?.schedule?.deviationRate ?? 0) > 15 ? '#f53f3f' : '#00b42a' }}>
                  {m?.schedule?.deviationRate ?? 0}%
                </span>
              </div>
            </Card>
            <Card className="lx-stat-card" title="人力状况">
              <div className="lx-detail-row">
                <span className="lx-detail-row__label">在岗</span>
                <span className="lx-detail-row__value">{m?.schedule?.presentToday ?? 0} / {m?.schedule?.totalEmployees ?? 0}</span>
              </div>
              <div className="lx-detail-row">
                <span className="lx-detail-row__label">请假</span>
                <span className="lx-detail-row__value">{m?.schedule?.onLeave ?? 0} 人</span>
              </div>
              <div className="lx-detail-row">
                <span className="lx-detail-row__label">加班费</span>
                <span className="lx-detail-row__value">¥{m?.workforce?.overtimePay?.toFixed(2) ?? '0.00'}</span>
              </div>
            </Card>
            <Card className="lx-stat-card" title="告警" style={alerts.length > 0 ? { borderColor: '#f53f3f' } : {}}>
              {alerts.length === 0 ? (
                <div style={{ color: '#22c55e', fontSize: 16, padding: '8px 0' }}>✓ 所有指标正常</div>
              ) : (
                alerts.map((a: any, i: number) => (
                  <Tag key={i} color={a.level === 'critical' ? 'red' : 'orange'} style={{ display: 'block', marginBottom: 8 }}>
                    {a.metricName}: {typeof a.currentValue === 'number' ? a.currentValue.toFixed(1) : a.currentValue}
                  </Tag>
                ))
              )}
            </Card>
          </div>
        </>
      ) : null}
    </PageContainer>
  )
}
