import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner';
import { getApiBaseUrl, getApiUrl } from '../utils/apiConfig'
import { getImageUrl } from '../utils/fileUtils'
import { 
    User, 
    Mail, 
    Phone, 
    GraduationCap, 
    Home, 
    Lock, 
    Edit3, 
    Check, 
    X, 
    Users, 
    Info, 
    ShieldCheck, 
    ChevronDown, 
    Palette,
    Camera,
    MapPin,
    AlertCircle,
    Save,
    RotateCcw
} from 'lucide-react';
import { 
    ConfigProvider, 
    Select, 
    Input, 
    Button, 
    Tooltip, 
    Switch,
    Upload
} from 'antd';

const PersonalInfo = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [imageModal, setImageModal] = useState({ isOpen: false, url: '', title: '' })

  const [theme, setTheme] = useState({ background: '#f8fafc' })

  useEffect(() => {
    const savedTheme = localStorage.getItem('personalInfoTheme')
    if (savedTheme) { try { setTheme(JSON.parse(savedTheme)) } catch (e) { setTheme({ background: '#f8fafc' }) } }
    loadUserInfo()
  }, [])

  const updateTheme = (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('personalInfoTheme', JSON.stringify(newTheme))
    window.dispatchEvent(new CustomEvent('themeChange', { detail: newTheme }))
  }

  const [formData, setFormData] = useState({
    real_name: '', email: '', phone: '', emergency_contact: '',
    emergency_phone: '', address: '', education: '',
    id_card_front_url: '', id_card_back_url: ''
  })

  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })

  const loadUserInfo = async () => {
    try {
      const token = localStorage.getItem('token')
      const savedUserStr = localStorage.getItem('user')
      let initialUser = null;
      if (savedUserStr) {
        initialUser = JSON.parse(savedUserStr);
        setUser(initialUser);
        setFormData(prev => ({ ...prev, ...initialUser }));
      }
      if (!token || !initialUser?.id) return;
      const response = await fetch(`${getApiBaseUrl()}/users/${initialUser.id}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const result = await response.json()
        const userData = result.success ? result.data : result
        if (userData?.username) {
          setUser(userData)
          setFormData({ ...userData })
          localStorage.setItem('user', JSON.stringify(userData))
        }
      }
    } catch (e) {}
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${getApiBaseUrl()}/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (response.ok) {
        await loadUserInfo(); setEditing(false); toast.success('资料更新成功')
      } else {
        const data = await response.json(); toast.error(data.message || '更新失败')
      }
    } catch (e) { toast.error('网络错误') } finally { setLoading(false) }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) return toast.error('两次输入不一致')
    if (passwordData.newPassword.length < 6) return toast.error('密码至少6位')
    try {
      setPasswordLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${getApiBaseUrl()}/auth/change-password`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: passwordData.oldPassword, newPassword: passwordData.newPassword })
      })
      if (response.ok) {
        toast.success('修改成功，即将重新登录');
        setTimeout(() => { localStorage.clear(); window.location.reload(); }, 2000)
      } else {
        const data = await response.json(); toast.error(data.message || '修改失败')
      }
    } finally { setPasswordLoading(false) }
  }

  const InfoCard = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center gap-2">
            <Icon size={16} className="text-blue-600" />
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{title}</h3>
        </div>
        <div className="p-6">{children}</div>
    </div>
  )

  const FormItem = ({ label, name, value, icon: Icon, type = 'text', options = [] }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
            <Icon size={10} /> {label}
        </label>
        {editing ? (
            type === 'select' ? (
                <Select 
                    className="w-full h-10 font-bold" 
                    value={value || undefined} 
                    onChange={val => setFormData({...formData, [name]: val})}
                    options={options.map(o => ({ label: o, value: o }))}
                />
            ) : (
                <Input 
                    className="h-10 font-bold text-slate-700" 
                    value={value} 
                    onChange={e => setFormData({...formData, [name]: e.target.value})}
                />
            )
        ) : (
            <div className="h-10 flex items-center px-4 bg-slate-50 rounded-lg text-xs font-black text-slate-600 border border-transparent">
                {value || <span className="text-slate-300 font-normal">未填写</span>}
            </div>
        )}
    </div>
  )

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">正在同步个人档案...</p>
        </div>
      </div>
    )
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#2563eb', borderRadius: 10 } }}>
    <div className="min-h-screen p-6 md:p-10 transition-all duration-700" style={{ backgroundColor: theme.background }}>
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* 顶部个人名片 Banner */}
        <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-700 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.5),transparent)]" />
                <div className="absolute top-6 right-6 flex gap-2">
                    <button onClick={() => setShowThemeModal(true)} className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-xl text-[10px] font-black transition-all active:scale-95 flex items-center gap-2">
                        <Palette size={14} /> 个性背景
                    </button>
                    <button onClick={() => setShowPasswordModal(true)} className="px-4 py-2 bg-white text-slate-800 border border-white text-[10px] font-black rounded-xl shadow-lg hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2">
                        <Lock size={14} /> 安全设置
                    </button>
                </div>
            </div>

            <div className="px-10 pb-8 relative">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-8 -mt-12 mb-8">
                    <div className="relative group">
                        <div className="w-28 h-28 rounded-2xl bg-white p-1 shadow-2xl ring-4 ring-white/50">
                            <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center text-4xl font-black text-blue-600 overflow-hidden">
                                {user.real_name?.charAt(0) || <User size={40} />}
                            </div>
                        </div>
                        {editing && (
                            <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white hover:scale-110 transition-transform">
                                <Camera size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">{user.real_name}</h2>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                            <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black flex items-center gap-1.5 border border-slate-200/50">
                                <User size={12} /> {user.username}
                            </span>
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black flex items-center gap-1.5 border border-blue-100/50">
                                <ShieldCheck size={12} /> {user.employee_no || '正式员工'}
                            </span>
                        </div>
                    </div>

                    <div className="pb-1">
                        {!editing ? (
                            <button onClick={() => setEditing(true)} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
                                <Edit3 size={14} /> 编辑个人档案
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => { setEditing(false); loadUserInfo(); }} className="px-6 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black text-xs hover:bg-slate-200 active:scale-95 transition-all">放弃</button>
                                <button onClick={handleSave} disabled={loading} className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2">
                                    {loading ? <RotateCcw size={14} className="animate-spin" /> : <Save size={14} />} 保存修改
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <InfoCard title="基础信息" icon={User}>
                        <div className="grid grid-cols-1 gap-6">
                            <FormItem label="真实姓名" name="real_name" value={formData.real_name} icon={User} editing={editing} />
                            <FormItem label="电子邮箱" name="email" value={formData.email} icon={Mail} editing={editing} />
                            <FormItem label="手机号码" name="phone" value={formData.phone} icon={Phone} editing={editing} />
                            <FormItem label="最高学历" name="education" value={formData.education} icon={GraduationCap} editing={editing} type="select" options={['高中', '大专', '本科', '硕士', '博士']} />
                        </div>
                    </InfoCard>

                    <InfoCard title="紧急联系" icon={Users}>
                        <div className="grid grid-cols-1 gap-6">
                            <FormItem label="紧急联系人" name="emergency_contact" value={formData.emergency_contact} icon={User} editing={editing} />
                            <FormItem label="联系人电话" name="emergency_phone" value={formData.emergency_phone} icon={Phone} editing={editing} />
                            <FormItem label="居住地址" name="address" value={formData.address} icon={MapPin} editing={editing} />
                        </div>
                    </InfoCard>

                    <div className="md:col-span-2">
                        <InfoCard title="证件档案" icon={ShieldCheck}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {[
                                    { label: '身份证正面', name: 'id_card_front_url', val: formData.id_card_front_url },
                                    { label: '身份证反面', name: 'id_card_back_url', val: formData.id_card_back_url }
                                ].map((img, i) => (
                                    <div key={i} className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{img.label}</p>
                                        <div className="aspect-video rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden relative group hover:border-blue-400 transition-all">
                                            {img.val ? (
                                                <img src={getImageUrl(img.val)} className="w-full h-full object-cover cursor-pointer" onClick={() => setImageModal({ isOpen: true, url: getImageUrl(img.val), title: img.label })} />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                                                    <Camera size={32} strokeWidth={1} />
                                                    <span className="text-[10px] font-black uppercase">等待上传</span>
                                                </div>
                                            )}
                                            {editing && (
                                                <div className="absolute inset-0 bg-blue-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <Button type="primary" size="small" className="font-black text-[10px]">更换文件</Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </InfoCard>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 确认/设置弹窗 - 采用定制 Win11 风格 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowPasswordModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Lock size={20} /></div>
                    <h3 className="text-sm font-black text-slate-800">重置登录密码</h3>
                </div>
                <form onSubmit={handlePasswordChange} className="p-8 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">当前旧密码</label>
                        <Input.Password className="h-11" value={passwordData.oldPassword} onChange={e=>setPasswordData({...passwordData, oldPassword:e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">输入新密码</label>
                        <Input.Password className="h-11" value={passwordData.newPassword} onChange={e=>setPasswordData({...passwordData, newPassword:e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">确认新密码</label>
                        <Input.Password className="h-11" value={passwordData.confirmPassword} onChange={e=>setPasswordData({...passwordData, confirmPassword:e.target.value})} />
                    </div>
                    <div className="pt-4 flex gap-2">
                        <Button type="text" block onClick={()=>setShowPasswordModal(false)} className="h-11 font-black text-slate-400">取消</Button>
                        <Button type="primary" block htmlType="submit" loading={passwordLoading} className="h-11 font-black shadow-lg shadow-blue-100">确认重置</Button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* 主题设置 */}
      {showThemeModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowThemeModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8" onClick={e=>e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-6">
                    <Palette size={20} className="text-blue-600" />
                    <h3 className="text-sm font-black text-slate-800">个性化背景设置</h3>
                </div>
                <div className="grid grid-cols-5 gap-3">
                    {['#f8fafc', '#ffffff', '#eff6ff', '#f0fdf4', '#fff7ed', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'].map(c => (
                        <button key={c} onClick={()=>updateTheme({background:c})} className={`aspect-square rounded-xl border-2 transition-all ${theme.background === c ? 'border-blue-600 ring-2 ring-blue-100 scale-110' : 'border-slate-100'}`} style={{ backgroundColor: c }} />
                    ))}
                </div>
                <div className="mt-8 flex justify-between items-center">
                    <button onClick={()=>updateTheme({background:'#f8fafc'})} className="text-xs font-black text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-4">恢复系统默认</button>
                    <Button type="primary" onClick={()=>setShowThemeModal(false)} className="px-8 font-black">完成</Button>
                </div>
            </div>
        </div>
      )}

      {/* 证件全屏预览 */}
      {imageModal.isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/95 p-4 animate-in zoom-in-95" onClick={() => setImageModal({ isOpen: false, url: '', title: '' })}>
            <button className="absolute top-8 right-8 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all"><X size={24} /></button>
            <div className="max-w-4xl w-full flex flex-col items-center gap-4">
                <h4 className="text-white font-black text-lg">{imageModal.title}</h4>
                <img src={imageModal.url} className="max-w-full max-h-[80vh] rounded-xl shadow-2xl border border-white/10" />
            </div>
        </div>
      )}
    </div>
    </ConfigProvider>
  )
}

export default PersonalInfo
