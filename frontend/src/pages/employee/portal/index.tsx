import { useState, useEffect } from 'react'
import { Card, Statistic, Tag, Space, Button, Input, Message, Modal } from '@arco-design/web-react'
import Row from '@arco-design/web-react/es/Grid/row'
import Col from '@arco-design/web-react/es/Grid/col'
import PageContainer from '@/components/PageContainer'
import { get } from '@/api/request'

export default function EmployeePortal() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [pwdModal, setPwdModal] = useState(false)
  const [pwdInput, setPwdInput] = useState('')
  const [pwdMode, setPwdMode] = useState<'view' | 'set'>('view')
  const [salaryData, setSalaryData] = useState<any>(null)
  const [payslips, setPayslips] = useState<any[]>([])

  const fetchDashboard = async () => {
    setLoading(true)
    try { const r = await get('/employee/dashboard'); setData(r.data) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { fetchDashboard() }, [])

  const handlePwdSubmit = async () => {
    try {
      const { post } = await import('@/api/request')
      if (pwdMode === 'set') {
        await post('/employee/set-password', { password: pwdInput })
        Message.success('密码设置成功'); setPwdModal(false)
      } else {
        await post('/employee/verify-password', { password: pwdInput })
        const [sRes, pRes] = await Promise.all([get('/employee/my-salary'), get('/employee/payslips')])
        setSalaryData(sRes.data); setPayslips(pRes.data || []); setPwdModal(false)
      }
    } catch (e: any) { Message.error(e.message || '操作失败') }
  }

  const d = data

  return (
    <PageContainer
      title="员工自助"
      description={`${d?.employee?.realName || ''} · ${d?.employee?.employeeNo || ''} · ${d?.employee?.departmentName || ''}`}
      onRefresh={fetchDashboard}
    >
      {d ? (
        <>
          <div className="lx-stat-grid lx-fade-in">
            <Card className="lx-stat-card">
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{d?.todaySchedule?.shiftName || '无排班'}</span>
                <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 4 }}>
                  {d?.todaySchedule?.startTime} - {d?.todaySchedule?.endTime}
                </div>
              </div>
              {(d?.todayCheckin || d?.pendingConfirmations > 0) ? (
                <Space>
                  {d?.todayCheckin && <Tag size="small" color="green">已签到 {d?.todayCheckin?.checkTime?.split('T')[1]?.split('.')[0]}</Tag>}
                  {d?.pendingConfirmations > 0 && <Tag size="small" color="orange">{d?.pendingConfirmations} 待确认</Tag>}
                </Space>
              ) : null}
            </Card>
            <Card className="lx-stat-card">
              <Statistic title="本月出勤" value={`${d?.attendance?.monthDays ?? 0} 天`} />
              <Statistic title="本周加班" value={`${d?.attendance?.overtimeHours ?? 0}h`} />
            </Card>
            <Card className="lx-stat-card">
              <Statistic title="活跃工单" value={d?.activeTickets?.count ?? 0} />
            </Card>
            <Card className="lx-stat-card">
              <Statistic title="月预估薪资" value={`¥${salaryData?.estimatedTotal?.toFixed(2) ?? '需验证'}`} />
              <Space style={{ marginTop: 6 }}>
                <Button size="small" type="primary" onClick={() => { setPwdMode('view'); setPwdInput(''); setPwdModal(true) }}>查看工资条</Button>
                <Button size="small" type="text" onClick={() => { setPwdMode('set'); setPwdInput(''); setPwdModal(true) }}>设密码</Button>
              </Space>
            </Card>
          </div>

          <Row gutter={[16, 16]} className="lx-fade-in lx-fade-in--delay">
            <Col span={12}>
              <Card className="lx-stat-card" title="假期余额">
                {(!d?.vacationBalances || d.vacationBalances.length === 0) ? (
                  <div style={{ color: 'var(--color-text-3)', fontSize: 13, padding: '8px 0' }}>暂无假期余额</div>
                ) : d.vacationBalances.map((b: any) => (
                  <div className="lx-detail-row" key={b.typeName}>
                    <span className="lx-detail-row__label">{b.typeName}</span>
                    <Space>
                      <Tag size="small" color="green">剩余 {b.remaining} 天</Tag>
                      <span style={{ color: 'var(--color-text-3)', fontSize: 12 }}>共 {b.total} / 已用 {b.used}</span>
                    </Space>
                  </div>
                ))}
              </Card>
            </Col>
            <Col span={12}>
              <Card className="lx-stat-card" title="活跃工单">
                {(!d?.activeTickets?.list || d.activeTickets.list.length === 0) ? (
                  <div style={{ color: 'var(--color-text-3)', fontSize: 13, padding: '8px 0' }}>暂无活跃工单</div>
                ) : d.activeTickets.list.slice(0, 5).map((t: any) => (
                  <div className="lx-detail-row" key={t.id}>
                    <span><Tag size="small" style={{ marginRight: 6 }}>{t.ticketNo}</Tag>{t.title}</span>
                    <span>{t.slaStatus === 'breached' && <Tag size="small" color="red">超时</Tag>}</span>
                  </div>
                ))}
              </Card>
            </Col>
          </Row>

          {payslips.length > 0 && (
            <Card title="工资条记录" className="lx-fade-in">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--color-border-2)' }}><th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>月份</th><th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>净发金额</th><th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>创建时间</th></tr></thead>
                <tbody>{payslips.map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-2)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 13 }}>{(p.period || '').substring(0, 7)}</td>
                    <td style={{ padding: '8px 12px', fontSize: 14, fontWeight: 600, textAlign: 'right' }}>¥{Number(p.netPay || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--color-text-3)' }}>{p.createdAt}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
          )}
        </>
      ) : null}

      <Modal focusLock title={pwdMode === 'set' ? '设置二级密码' : '验证身份'} visible={pwdModal} onOk={handlePwdSubmit} onCancel={() => setPwdModal(false)}>
        <Input.Password value={pwdInput} onChange={setPwdInput} maxLength={6} placeholder="6位数字密码" autoFocus />
      </Modal>
    </PageContainer>
  )
}
