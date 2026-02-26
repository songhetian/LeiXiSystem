import React, { useState, useEffect } from 'react'
import { Select, message, Typography, Switch, ConfigProvider, Spin, Tabs } from 'antd'
import { getApiUrl } from '../utils/apiConfig'
import { apiGet, apiPut } from '../utils/apiClient'
import { useChatStore } from '../hooks/useChatStore'
import { BellOutlined, WalletOutlined, SafetyCertificateOutlined, BookOutlined } from '@ant-design/icons'

const { Text } = Typography

const NotificationSettings = () => {
  const [loading, setLoading] = useState(false)
  const { 
    notificationEnabled, 
    toggleNotification, 
    systemNotificationEnabled, 
    toggleSystemNotification 
  } = useChatStore();
  
  const [settings, setSettings] = useState([])
  const [roles, setRoles] = useState([])
  const [savingGroup, setSavingGroup] = useState('')

  const groups = [
    {
      id: 'attendance',
      title: '考勤流转',
      icon: <BellOutlined />,
      description: '管理请假、加班、补卡等审批流通知节点',
      items: {
        'leave_apply': '请假申请触发',
        'leave_approval': '请假审批通过',
        'leave_rejection': '请假审批驳回',
        'overtime_apply': '加班申请触发',
        'overtime_approval': '加班审批通过',
        'makeup_apply': '补卡申请触发',
        'makeup_approval': '补卡审批通过'
      }
    },
    {
      id: 'finance',
      title: '财务资产',
      icon: <WalletOutlined />,
      description: '监控报销进度、终审结果及资产领用确认',
      items: {
        'reimbursement_pass': '报销终审通过',
        'reimbursement_reject': '报销申请驳回',
        'reimbursement_progress': '报销环节更新',
        'asset_apply': '资产领用申请'
      }
    },
    {
      id: 'audit',
      title: '异常告警',
      icon: <SafetyCertificateOutlined />,
      description: '系统自动捕捉并分发的考勤异常审计提醒',
      items: {
        'late_notify': '迟到行为提醒',
        'early_leave_notify': '早退行为提醒',
        'absent_notify': '缺勤自动告警'
      }
    },
    {
      id: 'system',
      title: '学习考试',
      icon: <BookOutlined />,
      description: '考试任务下发与成绩出炉的自动化通知',
      items: {
        'exam_publish': '新考试任务发布',
        'exam_result': '考分结果出炉'
      }
    }
  ]

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [settingsRes, rolesRes] = await Promise.all([
        apiGet('/api/notification-settings'),
        apiGet('/api/notification-settings/roles')
      ])
      if (settingsRes.success) setSettings(settingsRes.data)
      if (rolesRes.success) {
        const processedRoles = rolesRes.data.map(r => {
          if (r === '部门主管') return '其所属部门主管';
          return r;
        });
        setRoles([
          '业务发起人 (本人)', 
          '其所属部门主管', 
          '审批流下一环节待办人', 
          '任务指派受众',
          ...processedRoles.filter(r => r !== '申请人' && r !== '考生' && r !== '部门主管')
        ])
      }
    } catch (error) {
      message.error('推送配置读取失败')
    } finally { setLoading(false) }
  }

  const handleRoleChange = (eventType, newRoles) => {
    setSettings(prev => {
      const next = [...prev]
      const idx = next.findIndex(s => s.event_type === eventType)
      if (idx > -1) {
        next[idx].target_roles = newRoles
      } else {
        next.push({ event_type: eventType, target_roles: newRoles })
      }
      return next
    })
  }

  const saveGroup = async (groupId) => {
    const group = groups.find(g => g.id === groupId)
    const eventTypes = Object.keys(group.items)
    setSavingGroup(groupId)
    try {
      const promises = eventTypes.map(type => {
        const setting = settings.find(s => s.event_type === type)
        const rawRoles = (setting ? (typeof setting.target_roles === 'string' ? JSON.parse(setting.target_roles) : setting.target_roles) : []).map(r => {
          if (r === '业务发起人 (本人)') return '申请人';
          if (r === '其所属部门主管') return '部门主管';
          if (r === '审批流下一环节待办人') return 'next_approver';
          if (r === '任务指派受众') return 'task_audience';
          return r;
        });
        return apiPut(`/api/notification-settings/${type}`, { targetRoles: rawRoles })
      })
      await Promise.all(promises)
      message.success(`${group.title} 配置保存成功`)
    } catch (error) {
      message.error(`${group.title} 同步失败`)
    } finally { setSavingGroup('') }
  }

  const roleOptions = roles.map(r => ({ 
    label: r, 
    value: r,
    className: (r.includes('本人') || r.includes('主管') || r.includes('待办') || r.includes('受众')) ? 'font-black text-indigo-600' : ''
  }))

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8fafc]"><Spin size="large" /></div>

  const tabItems = groups.map(group => ({
    key: group.id,
    label: (
        <div className="flex items-center gap-2 px-4">
            {group.icon}
            <span className="font-black">{group.title}</span>
        </div>
    ),
    children: (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-500 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                <div>
                    <span className="text-lg font-black text-slate-900">{group.title}规则审计</span>
                    <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">{group.description}</div>
                </div>
                <button 
                    onClick={() => saveGroup(group.id)}
                    disabled={savingGroup === group.id}
                    className="h-11 px-10 bg-indigo-600 text-white font-black rounded-lg text-xs hover:bg-indigo-700 transition-all border-[1px] border-indigo-500 shadow-lg active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                    {savingGroup === group.id ? '正在保存...' : '保存配置'}
                </button>
            </div>
            
            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {Object.entries(group.items).map(([type, label]) => {
                    const setting = settings.find(s => s.event_type === type)
                    let currentRoles = setting ? (typeof setting.target_roles === 'string' ? JSON.parse(setting.target_roles) : setting.target_roles) : []
                    
                    currentRoles = currentRoles.map(r => {
                        if (r === '申请人' || r === '考生') return '业务发起人 (本人)';
                        if (r === '部门主管') return '其所属部门主管';
                        if (r === 'next_approver') return '审批流下一环节待办人';
                        if (r === 'task_audience') return '任务指派受众';
                        return r;
                    });

                    return (
                        <div key={type} className="flex flex-col gap-2 group">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[13px] font-black text-slate-700">{label}</span>
                                <span className="text-[9px] text-slate-300 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">{type}</span>
                            </div>
                            <Select
                                mode="multiple"
                                placeholder="选择推送目标..."
                                className="w-full font-black flagship-select"
                                popupClassName="custom-flagship-select-dropdown"
                                value={currentRoles}
                                onChange={(val) => handleRoleChange(type, val)}
                                maxTagCount="responsive"
                                options={roleOptions}
                                style={{ height: '44px' }}
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
  }))

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' },
        components: { 
            Select: { 
                controlOutline: 'transparent', selectorBg: '#ffffff', colorBorder: '#64748b', colorBorderHover: '#4f46e5',
                optionSelectedBg: '#f5f3ff', optionSelectedColor: '#4f46e5'
            },
            Tabs: {
                titleFontSize: 15,
                itemSelectedColor: '#4f46e5',
                itemHoverColor: '#4f46e5',
                itemActiveColor: '#4f46e5',
                inkBarColor: '#4f46e5',
                horizontalMargin: '0 0 32px 0'
            }
        }
    }}>
    <div className="p-8 bg-[#f8fafc] min-h-screen font-black text-left">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col mb-10">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">推送规则设置</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">全局业务分发规则与推送偏好配置中心</p>
        </div>

        {/* 顶部全局开关 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
                { label: '实时消息弹窗', desc: '新消息触发时在右上角弹出提醒', state: notificationEnabled, action: toggleNotification },
                { label: '物理桌面推送', desc: '窗口非焦点时发送系统级通知', state: systemNotificationEnabled, action: toggleSystemNotification }
            ].map((box, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-500 p-8 flex items-center justify-between hover:border-indigo-500 transition-all group">
                    <div>
                        <div className="text-[15px] font-black text-slate-900 uppercase tracking-tight">{box.label}</div>
                        <div className="text-[11px] text-slate-500 font-bold mt-1">{box.desc}</div>
                    </div>
                    <Switch checked={box.state} onChange={box.action} className="scale-125 ml-8" />
                </div>
            ))}
        </div>

        {/* 业务分组 Tab 切换 */}
        <div className="notification-tabs-container">
            <Tabs 
                defaultActiveKey="attendance" 
                items={tabItems} 
                className="flagship-tabs"
                size="large"
            />
        </div>

        <div className="pt-10 text-center">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.5em] opacity-50">
                雷犀通知分发引擎 v2.2 - 已实现在线逻辑穿透
            </span>
        </div>
      </div>
    </div>
    </ConfigProvider>
  )
}

export default NotificationSettings
