import { useState, useEffect } from 'react'
import api from '../../api'
import { toast } from 'sonner';
import { ConfigProvider, Button, Switch, InputNumber, Card } from 'antd'

export default function AttendanceSettings() {
  const [activeTab, setActiveTab] = useState('basic')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    enable_time_check: true,
    early_clock_in_minutes: 60,
    late_clock_out_minutes: 120,
    late_minutes: 30,
    early_leave_minutes: 30,
    absent_hours: 4,
    max_annual_leave_days: 10,
    max_sick_leave_days: 15,
    require_proof_for_sick_leave: true,
    require_approval_for_overtime: true,
    min_overtime_hours: 1,
    max_overtime_hours_per_day: 4,
    allow_makeup: true,
    makeup_deadline_days: 3,
    require_approval_for_makeup: true,
    notify_on_late: true,
    notify_on_early_leave: true,
    notify_on_absent: true
  })

  const tabs = [
    { id: 'basic', name: '基础考勤规则', icon: '⚙️', desc: '打卡时限、异常判定与补卡逻辑' },
    { id: 'leave', name: '请假加班制度', icon: '📝', desc: '假期额度、证明要求与加班限制' }
  ]

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/attendance/settings')
      if (response.data.success) {
        setSettings({ ...settings, ...response.data.data })
      }
    } catch (error) {
      console.error('获取设置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await api.post('/api/attendance/settings', settings)
      if (response.data.success) {
        toast.success('全局考勤规则已物理固化')
      }
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 10, controlHeight: 36, colorBorder: '#cbd5e1' }
    }}>
    <div className="space-y-6 animate-in fade-in duration-500 text-left">
      
      {/* Tab 导航 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-5 rounded-xl border transition-all flex flex-col text-left group ${
              activeTab === tab.id
                ? 'border-indigo-500 bg-indigo-50/30 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl opacity-80 group-hover:scale-110 transition-transform">{tab.icon}</span>
              <span className={`text-sm font-black ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-700'}`}>
                {tab.name}
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{tab.desc}</p>
          </button>
        ))}
      </div>

      <Card 
        className="rounded-2xl border-slate-200 shadow-sm overflow-hidden"
        styles={{ header: { padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }, body: { padding: '24px' } }}
        title={
            <div className="flex justify-between items-center w-full">
                <span className="text-sm font-black text-slate-800">{activeTab === 'basic' ? '物理打卡与补卡规则' : '请假与加班制度定义'}</span>
                <Button 
                    type="primary" 
                    loading={loading} 
                    onClick={handleSave}
                    className="bg-slate-900 border-none font-black text-[11px] h-9 px-6 rounded-lg shadow-md"
                >
                    物理固化当前配置
                </Button>
            </div>
        }
      >
        {activeTab === 'basic' ? (
          <div className="space-y-8">
            {/* 时间规则 */}
            <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> 物理打卡时间限制
                </h3>
                <Switch size="small" checked={settings.enable_time_check} onChange={(v) => setSettings({ ...settings, enable_time_check: v })} />
              </div>
              
              {settings.enable_time_check && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">提前签到阈值 (分钟)</label>
                    <InputNumber min={0} max={180} value={settings.early_clock_in_minutes} onChange={v => setSettings({...settings, early_clock_in_minutes: v})} className="w-full font-black" />
                    <p className="text-[9px] text-slate-400 font-bold mt-2 italic ml-1"># 允许员工在班次开始前多少分钟执行签到</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">延后签退限制 (分钟)</label>
                    <InputNumber min={0} max={300} value={settings.late_clock_out_minutes} onChange={v => setSettings({...settings, late_clock_out_minutes: v})} className="w-full font-black" />
                    <p className="text-[9px] text-slate-400 font-bold mt-2 italic ml-1"># 班次结束后多少分钟内必须完成签退物理动作</p>
                  </div>
                </div>
              )}
            </div>

            {/* 异常判定 */}
            <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
              <h3 className="text-xs font-black text-slate-700 flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> 考勤异常判定物理阈值
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">迟到宽限 (分钟)</label>
                  <InputNumber min={1} value={settings.late_minutes} onChange={v => setSettings({...settings, late_minutes: v})} className="w-full font-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">早退阈值 (分钟)</label>
                  <InputNumber min={1} value={settings.early_leave_minutes} onChange={v => setSettings({...settings, early_leave_minutes: v})} className="w-full font-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">缺勤判定 (小时)</label>
                  <InputNumber min={1} value={settings.absent_hours} onChange={v => setSettings({...settings, absent_hours: v})} className="w-full font-black" />
                </div>
              </div>
            </div>

            {/* 补卡与通知 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
                    <h3 className="text-xs font-black text-slate-700 flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> 异常补卡策略
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-600">允许员工自主发起补卡申请</span>
                            <Switch size="small" checked={settings.allow_makeup} onChange={v => setSettings({...settings, allow_makeup: v})} />
                        </div>
                        {settings.allow_makeup && (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <span className="text-[11px] font-bold text-slate-600">补卡申请时限 (天)</span>
                                <InputNumber size="small" min={1} max={30} value={settings.makeup_deadline_days} onChange={v => setSettings({...settings, makeup_deadline_days: v})} className="w-16" />
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
                    <h3 className="text-xs font-black text-slate-700 flex items-center gap-2 mb-6">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> 自动化审计通知
                    </h3>
                    <div className="space-y-3">
                        {['迟到', '早退', '缺勤'].map((label, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-600">{label}行为发生时即时推送</span>
                                <Switch size="small" checked={idx === 0 ? settings.notify_on_late : (idx === 1 ? settings.notify_on_early_leave : settings.notify_on_absent)} 
                                    onChange={v => setSettings({...settings, [idx === 0 ? 'notify_on_late' : (idx === 1 ? 'notify_on_early_leave' : 'notify_on_absent')]: v})} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
              <h3 className="text-xs font-black text-slate-700 flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> 年度假期额度控制
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">标准年假上限 (天)</label>
                  <InputNumber min={0} value={settings.max_annual_leave_days} onChange={v => setSettings({...settings, max_annual_leave_days: v})} className="w-full font-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">带薪病假上限 (天)</label>
                  <InputNumber min={0} value={settings.max_sick_leave_days} onChange={v => setSettings({...settings, max_sick_leave_days: v})} className="w-full font-black" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
              <h3 className="text-xs font-black text-slate-700 flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div> 加班审计与限制
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">最小起算时长 (小时)</label>
                  <InputNumber step={0.5} min={0.5} value={settings.min_overtime_hours} onChange={v => setSettings({...settings, min_overtime_hours: v})} className="w-full font-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">每日加班极限 (小时)</label>
                  <InputNumber min={1} value={settings.max_overtime_hours_per_day} onChange={v => setSettings({...settings, max_overtime_hours_per_day: v})} className="w-full font-black" />
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
    </ConfigProvider>
  )
}
