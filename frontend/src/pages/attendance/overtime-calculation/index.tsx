import { useState, useEffect } from 'react'
import { Card, Table, Button, Tag, Space, Select } from '@arco-design/web-react'
import PageContainer from '@/components/PageContainer'
import { get, post } from '@/api/request'
import { formatDate } from '@/utils/date'
import { toast } from '@/utils/toast'

export default function OvertimeCalculationPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try { const r = await get('/attendance/overtime-requests?status=approved'); setItems(r.data?.list || []) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])

  const handleSettle = async (id: number, hourSource: string) => {
    try {
      await post(`/overtime-payroll/settle/${id}`, { hourSource })
      toast.success('核算成功'); fetchAll()
    } catch (e: any) { toast.error(e.message || '核算失败') }
  }

  return (
    <PageContainer title="加班核算" description="将已批准的加班申请匹配打卡记录并计算加班费"
      breadcrumbs={[{ label: '考勤管理' }, { label: '加班核算' }]}
      onRefresh={fetchAll}
    >
      <Card className="lx-fade-in">
        <Table columns={[
          { title: '员工', dataIndex: 'employeeName', width: 100 },
          { title: '日期', dataIndex: 'date', width: 120, render: (v: string) => v ? formatDate(v) : '' },
          { title: '类型', dataIndex: 'overtimeType', width: 80, render: (v: string) => <Tag size="small">{v}</Tag> },
          { title: '申请时长', dataIndex: 'appliedHours', width: 90, render: (v: number) => `${v}h` },
          { title: '实际打卡', dataIndex: 'actualHours', width: 90, render: (v: number) => v ? `${v}h` : <span style={{ color: '#999' }}>未匹配</span> },
          { title: '计费倍率', dataIndex: 'overtimeRate', width: 80 },
          { title: '估算金额', dataIndex: 'overtimePay', width: 100, render: (v: number) => v ? `¥${v.toFixed(2)}` : '-' },
          { title: '操作', width: 260,
            render: (_: any, r: any) => (
              <Space>
                <Select value="applied" trigger="click" onChange={(v: string) => handleSettle(r.id, v)} style={{ width: 120 }}>
                  <Select.Option value="applied">按申请时长</Select.Option>
                  <Select.Option value="actual">按打卡时长</Select.Option>
                  <Select.Option value="min">取最小值</Select.Option>
                  <Select.Option value="max">取最大值</Select.Option>
                </Select>
                {r.settledHours ? <Tag size="small" color="green">已结算 {r.settledHours}h</Tag> : null}
              </Space>
            ),
          },
        ]} data={items} rowKey="id" pagination={false} loading={loading} />
      </Card>
    </PageContainer>
  )
}
