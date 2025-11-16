import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { getApiUrl } from '../../utils/apiConfig'


export default function AttendanceSettings() {
  const [activeTab, setActiveTab] = useState('basic')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    // 时间限制
    enable_time_check: true,
    early_clock_in_minutes: 60,
    late_clock_out_minutes: 120,

    // 异常规则
    late_minutes: 30,
    early_leave_minutes: 30,
    absent_hours: 4,

    // 请假规则
    max_annual_leave_days: 10,
    max_sick_leave_days: 15,
    require_proof_for_sick_leave: true,

    // 加班规则
    require_approval_for_overtime: true,
    min_overtime_hours: 1,
    max_overtime_hours_per_day: 4,

    // 补卡规则
    allow_makeup: true,
    makeup_deadline_days: 3,
    require_approval_for_makeup: true,

    // 通知设置
    notify_on_late: true,
    notify_on_early_leave: true,
    notify_on_absent: true
  })

  const tabs = [
    { id: 'basic', name: '基础设置', icon: '⚙️', desc: '打卡时间和异常规则' },
    { id: 'leave', name: '请假加班', icon: '📝', desc: '请假和加班规则' }
  ]

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const response = await axios.get(getApiUrl('/api/attendance/settings'))
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
      const response = await axios.post(getApiUrl('/api/attendance/settings'), settings)
      if (response.data.success) {
        toast.success('设置保存成功')
      }
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">考勤设置</h1>
        <p className="text-gray-600 mt-1">配置打卡规则、请假和加班制度</p>
      </div>

      {/* Tab导航 - 卡片式 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              activeTab === tab.id
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow'
            }`}
          >
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">{tab.icon}</span>
              <span className={`font-semibold ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-800'}`}>
                {tab.name}
              </span>
            </div>
            <p className="text-sm text-gray-600">{tab.desc}</p>
          </button>
        ))}
      </div>

      {/* Tab内容 */}
      <div className="bg-white rounded-lg shadow">{activeTab === 'basic' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800">基础设置</h2>
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存设置'}
              </button>
            </div>

            {/* 时间规则 */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-4">⏰ 打卡时间限制</h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enable_time_check"
                      checked={settings.enable_time_check}
                      onChange={(e) => setSettings({ ...settings, enable_time_check: e.target.checked })}
                      className="mr-2 w-4 h-4"
                    />
                    <label htmlFor="enable_time_check" className="text-sm text-gray-700">
                      启用打卡时间限制
                    </label>
                  </div>

                  {settings.enable_time_check && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          提前打卡时间（分钟）
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="180"
                          value={settings.early_clock_in_minutes}
                          onChange={(e) => setSettings({ ...settings, early_clock_in_minutes: parseInt(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">允许提前多少分钟打上班卡</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          延后打卡时间（分钟）
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="300"
                          value={settings.late_clock_out_minutes}
                          onChange={(e) => setSettings({ ...settings, late_clock_out_minutes: parseInt(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">允许延后多少分钟打下班卡</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 异常规则 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-4">⚠️ 异常判定规则</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      迟到阈值（分钟）
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={settings.late_minutes}
                      onChange={(e) => setSettings({ ...settings, late_minutes: parseInt(e.target.value) })}
                      className="w-full border rounded px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">超过此时间记为迟到</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      早退阈值（分钟）
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={settings.early_leave_minutes}
                      onChange={(e) => setSettings({ ...settings, early_leave_minutes: parseInt(e.target.value) })}
                      className="w-full border rounded px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">提前此时间下班记为早退</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      缺勤阈值（小时）
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={settings.absent_hours}
                      onChange={(e) => setSettings({ ...settings, absent_hours: parseInt(e.target.value) })}
                      className="w-full border rounded px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">未打卡超过此时间记为缺勤</p>
                  </div>
                </div>
              </div>

              {/* 补卡规则 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-4">🔄 补卡规则</h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allow_makeup"
                      checked={settings.allow_makeup}
                      onChange={(e) => setSettings({ ...settings, allow_makeup: e.target.checked })}
                      className="mr-2 w-4 h-4"
                    />
                    <label htmlFor="allow_makeup" className="text-sm text-gray-700">
                      允许补卡
                    </label>
                  </div>

                  {settings.allow_makeup && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          补卡截止时间（天）
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={settings.makeup_deadline_days}
                          onChange={(e) => setSettings({ ...settings, makeup_deadline_days: parseInt(e.target.value) })}
                          className="w-full border rounded px-3 py-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">员工可以在多少天内申请补卡</p>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="require_approval_for_makeup"
                          checked={settings.require_approval_for_makeup}
                          onChange={(e) => setSettings({ ...settings, require_approval_for_makeup: e.target.checked })}
                          className="mr-2 w-4 h-4"
                        />
                        <label htmlFor="require_approval_for_makeup" className="text-sm text-gray-700">
                          补卡需要审批
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 通知设置 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-4">🔔 通知设置</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="notify_on_late"
                      checked={settings.notify_on_late}
                      onChange={(e) => setSettings({ ...settings, notify_on_late: e.target.checked })}
                      className="mr-2 w-4 h-4"
                    />
                    <label htmlFor="notify_on_late" className="text-sm text-gray-700">
                      迟到时发送通知
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="notify_on_early_leave"
                      checked={settings.notify_on_early_leave}
                      onChange={(e) => setSettings({ ...settings, notify_on_early_leave: e.target.checked })}
                      className="mr-2 w-4 h-4"
                    />
                    <label htmlFor="notify_on_early_leave" className="text-sm text-gray-700">
                      早退时发送通知
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="notify_on_absent"
                      checked={settings.notify_on_absent}
                      onChange={(e) => setSettings({ ...settings, notify_on_absent: e.target.checked })}
                      className="mr-2 w-4 h-4"
                    />
                    <label htmlFor="notify_on_absent" className="text-sm text-gray-700">
                      缺勤时发送通知
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 请假加班规则 */}
        {activeTab === 'leave' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800">请假加班规则</h2>
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存设置'}
              </button>
            </div>

            <div className="space-y-6">
              {/* 请假规则 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-4">📝 请假规则</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        年假天数上限
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={settings.max_annual_leave_days}
                        onChange={(e) => setSettings({ ...settings, max_annual_leave_days: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">每年可申请的年假天数</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        病假天数上限
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={settings.max_sick_leave_days}
                        onChange={(e) => setSettings({ ...settings, max_sick_leave_days: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">每年可申请的病假天数</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="require_proof_for_sick_leave"
                      checked={settings.require_proof_for_sick_leave}
                      onChange={(e) => setSettings({ ...settings, require_proof_for_sick_leave: e.target.checked })}
                      className="mr-2 w-4 h-4"
                    />
                    <label htmlFor="require_proof_for_sick_leave" className="text-sm text-gray-700">
                      病假需要提供证明（如医院证明）
                    </label>
                  </div>
                </div>
              </div>

              {/* 加班规则 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-4">💼 加班规则</h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="require_approval_for_overtime"
                      checked={settings.require_approval_for_overtime}
                      onChange={(e) => setSettings({ ...settings, require_approval_for_overtime: e.target.checked })}
                      className="mr-2 w-4 h-4"
                    />
                    <label htmlFor="require_approval_for_overtime" className="text-sm text-gray-700">
                      加班需要审批
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        最少加班时长（小时）
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        max="4"
                        step="0.5"
                        value={settings.min_overtime_hours}
                        onChange={(e) => setSettings({ ...settings, min_overtime_hours: parseFloat(e.target.value) })}
                        className="w-full border rounded px-3 py-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">低于此时长不计入加班</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        每日加班上限（小时）
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={settings.max_overtime_hours_per_day}
                        onChange={(e) => setSettings({ ...settings, max_overtime_hours_per_day: parseInt(e.target.value) })}
                        className="w-full border rounded px-3 py-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">单日最多可加班时长</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
