/**
 * 个人信息设置 (雷犀旗舰办公版 - 绿色进化 2.0)
 * 
 * 核心升级：
 * 1. 视觉重构：移除沉重的黑色顶部，改为柔和的渐变背景与玻璃拟态卡片。
 * 2. 品牌对齐：全量切换至“雷犀绿”(#07C160) 视觉体系，增强系统统一性。
 * 3. 布局调优：优化名片区比例，加强信息层级感，提升操作舒适度。
 */
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getApiUrl } from '../utils/apiConfig';
import { getImageUrl } from '../utils/fileUtils';
import { 
    User, Mail, Phone, GraduationCap, Lock, Edit3, 
    X, Users, Palette, Camera, MapPin, Save, RotateCcw, ShieldCheck,
    Settings, Shield, ChevronRight
} from 'lucide-react';
import { 
    ConfigProvider, Select, Input, Button, Modal, Form, Upload, Typography, Tag, Divider, Avatar as AntdAvatar
} from 'antd';
import api from '../api';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const PersonalInfo = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [imageModal, setImageModal] = useState({ isOpen: false, url: '', title: '' });
  const [theme, setTheme] = useState({ background: '#f8fafc' });

  // 核心表单状态 (仅存储 URL)
  const [formData, setFormData] = useState({
    real_name: '', email: '', phone: '', emergency_contact: '',
    emergency_phone: '', address: '', education: '',
    id_card_front_url: '', id_card_back_url: '', avatar: ''
  });

  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    const savedTheme = localStorage.getItem('personalInfoTheme');
    if (savedTheme) { try { setTheme(JSON.parse(savedTheme)); } catch (e) {} }
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const savedUserStr = localStorage.getItem('user');
      const cachedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
      if (cachedUser) {
        setUser(cachedUser);
        setFormData(prev => ({ ...prev, ...cachedUser }));
      }
      
      const response = await api.get(`/users/${cachedUser?.id}/profile`);
      if (response.data.success) {
        let userData = response.data.data;
        
        // --- 存量清洗：如果后端吐回来的是 Base64，当场抹除 ---
        if (userData.avatar && userData.avatar.startsWith('data:image')) {
          userData.avatar = '';
        }

        setUser(userData);
        setFormData({ ...userData });
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (e) {}
  };

  // 核心：处理文件直传 OSS 并更新 URL (存相对路径)
  const handleFileUpload = async (file, field, bizType) => {
    const uploadData = new FormData();
    uploadData.append('file', file);
    try {
      toast.loading('正在同步至云端...', { id: 'uploading' });
      const res = await api.post(`/upload?bizType=${bizType}`, uploadData);
      if (res.data.success) {
        // --- 核心优化：数据库只存 bizPath ---
        setFormData(prev => ({ ...prev, [field]: res.data.bizPath }));
        toast.success('上传成功', { id: 'uploading' });
      }
    } catch (e) { 
      toast.error('同步失败', { id: 'uploading' }); 
    }
    return false;
  };

  const handleSave = async () => {
    // 防御：前端再次确认不含 Base64
    if (formData.avatar?.startsWith('data:image')) {
      toast.error('头像数据异常，请重新上传');
      return;
    }

    setLoading(true);
    try {
      const response = await api.put(`/users/${user.id}/profile`, formData);
      if (response.data.success) {
        await loadUserInfo();
        setEditing(false);
        toast.success('个人档案同步成功');
      }
    } catch (e) { 
      toast.error(e.response?.data?.message || '保存失败'); 
    }
    finally { setLoading(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) return toast.error('密码不一致');
    setPasswordLoading(true);
    try {
      const res = await api.post('/auth/change-password', { oldPassword: passwordData.oldPassword, newPassword: passwordData.newPassword });
      if (res.data.success) {
        toast.success('重置成功');
        setTimeout(() => { localStorage.clear(); window.location.reload(); }, 1500);
      }
    } catch (e) { toast.error('修改失败'); }
    finally { setPasswordLoading(false); }
  };

  const InfoCard = ({ title, icon: Icon, children, className = "" }) => (
    <div className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col ${className}`}>
        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-[#07C160]">
                    <Icon size={16} />
                </div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{title}</h3>
            </div>
        </div>
        <div className="p-8 flex-1">{children}</div>
    </div>
  );

  const FormItem = ({ label, name, value, icon: Icon, type = 'text', options = [] }) => (
    <div className="space-y-2 text-left">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
            <Icon size={10} className="text-emerald-500/50" /> {label}
        </label>
        {editing ? (
            type === 'select' ? (
                <Select className="w-full h-11 flagship-select font-black" value={value || undefined} onChange={val => setFormData({...formData, [name]: val})} options={options.map(o => ({ label: o, value: o }))} />
            ) : (
                <Input className="h-11 font-black text-slate-700 rounded-xl" value={value} onChange={e => setFormData({...formData, [name]: e.target.value})} />
            )
        ) : (
            <div className="h-11 flex items-center px-4 bg-slate-50/50 rounded-xl text-xs font-black text-slate-700 border border-transparent">
                {value || <span className="text-slate-300 font-normal">等待填报...</span>}
            </div>
        )}
    </div>
  );

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] text-xs font-black text-slate-300 animate-pulse uppercase tracking-widest">Initialising Digital Profile...</div>;

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#07C160', borderRadius: 12 } }}>
    <div className="min-h-screen p-4 md:p-6 transition-all duration-700" style={{ backgroundColor: theme.background }}>
      <div className="max-w-5xl mx-auto space-y-5">
        
        {/* 顶部个人名片：新版翡翠渐变 */}
        <div className="relative bg-white rounded-3xl shadow-xl shadow-emerald-900/5 border border-slate-200/60 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="h-36 bg-gradient-to-br from-[#07C160] to-[#059346] relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 mix-blend-overlay">
                    <svg width="100%" height="100%"><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
                </div>
                <div className="absolute top-5 right-6 flex gap-2.5">
                    <button onClick={() => setShowThemeModal(true)} className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-xl text-[10px] font-black transition-all flex items-center gap-2 shadow-lg"><Palette size={13} /> 个性化</button>
                    <button onClick={() => setShowPasswordModal(true)} className="px-4 py-2 bg-white/95 text-[#07C160] text-[10px] font-black rounded-xl hover:bg-white transition-all shadow-xl flex items-center gap-2"><Shield size={13} /> 账号安全</button>
                </div>
            </div>

            <div className="px-8 pb-10 relative">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-8 -mt-12 mb-10 text-left">
                    <div className="relative group">
                        <div className="w-28 h-28 rounded-[1.8rem] bg-white p-1 shadow-2xl ring-4 ring-white/40 overflow-hidden transition-transform group-hover:scale-[1.02] duration-500">
                            <div className="w-full h-full bg-slate-50 rounded-[1.6rem] flex items-center justify-center overflow-hidden border border-slate-100">
                                {formData.avatar ? (
                                    <img src={getImageUrl(formData.avatar)} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-emerald-50 flex items-center justify-center">
                                        <span className="text-4xl font-black text-[#07C160] opacity-30">{user.real_name?.charAt(0)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {editing && (
                            <Upload beforeUpload={(file) => handleFileUpload(file, 'avatar', 'avatar')} showUploadList={false}>
                                <button className="absolute -bottom-1 -right-1 w-10 h-10 bg-[#07C160] text-white rounded-xl flex items-center justify-center shadow-xl border-4 border-white hover:scale-110 transition-transform active:scale-95 duration-300">
                                    <Camera size={16} />
                                </button>
                            </Upload>
                        )}
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">{user.real_name}</h2>
                            <Tag className="m-0 border-none bg-emerald-50 text-[#07C160] font-black text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm flex items-center gap-1.5"><ShieldCheck size={9} /> {user.role || '正式员工'}</Tag>
                        </div>
                        <div className="flex flex-wrap items-center gap-3.5 text-slate-400">
                            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                                <Users size={11} className="text-emerald-500" /> {user.department_name || '雷犀核心部门'}
                            </div>
                            <div className="w-1 h-1 rounded-full bg-slate-200" />
                            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                                <Shield size={11} className="text-emerald-500" /> 工号: {user.employee_no || user.id}
                            </div>
                        </div>
                    </div>

                    <div className="pb-1">
                        {!editing ? (
                            <button onClick={() => setEditing(true)} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[11px] shadow-xl shadow-slate-200 hover:bg-black transition-all flex items-center gap-2 active:scale-95 duration-300"><Edit3 size={13} /> 编辑档案</button>
                        ) : (
                            <div className="flex gap-2.5">
                                <button onClick={() => { setEditing(false); loadUserInfo(); }} className="px-6 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[11px] hover:bg-slate-200 transition-all uppercase tracking-widest">放弃</button>
                                <button onClick={handleSave} disabled={loading} className="px-10 py-2.5 bg-[#07C160] text-white rounded-xl font-black text-[11px] shadow-xl shadow-emerald-100 hover:bg-[#06AD56] transition-all flex items-center gap-2 active:scale-95 duration-300 uppercase tracking-widest">
                                    {loading ? <RotateCcw size={13} className="animate-spin" /> : <Save size={13} />} 同步至云端
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <InfoCard title="个人联络及资历" icon={User} className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <FormItem label="姓名" name="real_name" value={formData.real_name} icon={User} />
                            <FormItem label="最高学历" name="education" value={formData.education} icon={GraduationCap} type="select" options={['高中', '大专', '本科', '硕士', '博士']} />
                            <div className="sm:col-span-2"><FormItem label="个人邮箱" name="email" value={formData.email} icon={Mail} /></div>
                            <div className="sm:col-span-2"><FormItem label="手机号码" name="phone" value={formData.phone} icon={Phone} /></div>
                        </div>
                    </InfoCard>

                    <InfoCard title="紧急事务与地址" icon={Users} className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <FormItem label="紧急联系人" name="emergency_contact" value={formData.emergency_contact} icon={User} />
                            <FormItem label="联系人电话" name="emergency_phone" value={formData.emergency_phone} icon={Phone} />
                            <div className="sm:col-span-2"><FormItem label="常驻地址" name="address" value={formData.address} icon={MapPin} /></div>
                        </div>
                    </InfoCard>

                    <div className="md:col-span-2 text-left">
                        <InfoCard title="数字化身份档案存证" icon={ShieldCheck} className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {[
                                    { label: '身份证 · 正面快照', name: 'id_card_front_url', val: formData.id_card_front_url },
                                    { label: '身份证 · 反面快照', name: 'id_card_back_url', val: formData.id_card_back_url }
                                ].map((img, i) => (
                                    <div key={i} className="space-y-4 group">
                                        <div className="flex items-center justify-between px-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{img.label}</p>
                                            {img.val && <Tag className="m-0 border-none bg-emerald-50 text-[#07C160] font-black text-[8px] rounded px-1.5">已上传</Tag>}
                                        </div>
                                        <div className="aspect-video rounded-3xl bg-slate-50 border border-slate-200/60 overflow-hidden relative group hover:border-[#07C160]/40 transition-all shadow-inner">
                                            {img.val ? (
                                                <img src={getImageUrl(img.val)} className="w-full h-full object-cover cursor-pointer transition-transform duration-700 group-hover:scale-105" onClick={() => setImageModal({ isOpen: true, url: getImageUrl(img.val), title: img.label })} />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-200 gap-3">
                                                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center"><Camera size={32} /></div>
                                                    <span className="font-black uppercase text-[10px] tracking-widest opacity-40">等待证件存证</span>
                                                </div>
                                            )}
                                            {editing && (
                                                <Upload beforeUpload={(file) => handleFileUpload(file, img.name, 'id_cards')} showUploadList={false}>
                                                    <div className="absolute inset-0 bg-emerald-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all cursor-pointer backdrop-blur-sm">
                                                        <div className="w-12 h-12 rounded-2xl bg-white text-[#07C160] flex items-center justify-center mb-3 shadow-xl"><Camera size={24} /></div>
                                                        <span className="text-white font-black text-[10px] uppercase tracking-widest">更换身份快照</span>
                                                    </div>
                                                </Upload>
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
        
        <div className="pt-10 text-center animate-in fade-in duration-1000">
            <span className="text-[9px] text-slate-300 font-black uppercase tracking-[0.6em] opacity-60">
                雷犀合规治理引擎 v2.2 - 核心身份存证模块
            </span>
        </div>
      </div>

      {/* 安全设置弹窗 */}
      <Modal 
        title={<div className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2"><Shield size={18} className="text-emerald-500" /> 重置系统安全密码</div>} 
        open={showPasswordModal} onCancel={() => setShowPasswordModal(false)} footer={null} centered width={420} 
        className="flagship-modal"
      >
        <form onSubmit={handlePasswordChange} className="py-6 space-y-6 text-left">
            <div className="space-y-2">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">当前旧密码验证</Text>
                <Input.Password className="h-12 flagship-input" value={passwordData.oldPassword} onChange={e=>setPasswordData({...passwordData, oldPassword:e.target.value})} />
            </div>
            <div className="space-y-2">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">设定新登录密码</Text>
                <Input.Password className="h-12 flagship-input" value={passwordData.newPassword} onChange={e=>setPasswordData({...passwordData, newPassword:e.target.value})} />
            </div>
            <div className="space-y-2">
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">重复确认新密码</Text>
                <Input.Password className="h-12 flagship-input" value={passwordData.confirmPassword} onChange={e=>setPasswordData({...passwordData, confirmPassword:e.target.value})} />
            </div>
            <button type="submit" disabled={passwordLoading} className="w-full h-12 bg-slate-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200 mt-6 active:scale-95 duration-300 uppercase tracking-widest text-[11px]">
                {passwordLoading ? <RotateCcw size={16} className="animate-spin" /> : '执行重置并物理注销'}
            </button>
        </form>
      </Modal>

      {/* 个性化弹窗 */}
      <Modal title={null} open={showThemeModal} onCancel={() => setShowThemeModal(false)} footer={null} centered width={380} className="flagship-modal">
        <div className="py-6">
            <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#07C160]"><Palette size={20} /></div>
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">个性化画布设置</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Canvas Preference</p>
                </div>
            </div>
            <div className="grid grid-cols-5 gap-4">
                {['#f8fafc', '#ffffff', '#eff6ff', '#f0fdf4', '#fff7ed', '#e0f2fe', '#fdf2f8', '#faf5ff', '#07C160', '#3b82f6'].map(c => (
                    <button 
                        key={c} 
                        onClick={()=>{setTheme({background:c}); localStorage.setItem('personalInfoTheme', JSON.stringify({background:c}));}} 
                        className={`aspect-square rounded-2xl border-4 transition-all duration-300 relative group ${theme.background === c ? 'border-[#07C160] scale-110 shadow-lg shadow-emerald-100' : 'border-slate-100 hover:border-slate-200'}`} 
                        style={{ backgroundColor: c }}
                    >
                        {theme.background === c && <div className="absolute inset-0 flex items-center justify-center text-white"><ShieldCheck size={16} className={c === '#ffffff' || c === '#f8fafc' ? 'text-emerald-500' : 'text-white'} /></div>}
                    </button>
                ))}
            </div>
            <button onClick={()=>setShowThemeModal(false)} className="w-full mt-10 h-12 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all uppercase tracking-widest text-[11px]">保存偏好设置</button>
        </div>
      </Modal>

      {/* 证件全屏预览 */}
      {imageModal.isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/90 p-4 animate-in fade-in duration-500 backdrop-blur-md" onClick={() => setImageModal({ isOpen: false, url: '', title: '' })}>
            <div className="max-w-5xl w-full flex flex-col items-center gap-6 animate-in zoom-in-95 duration-500">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-2 rounded-full">
                    <Text className="text-white font-black text-xs uppercase tracking-[0.4em]">{imageModal.title}</Text>
                </div>
                <img src={imageModal.url} className="max-w-full max-h-[80vh] rounded-[2rem] shadow-2xl border-8 border-white/10" />
                <button className="text-white/30 font-black text-[9px] uppercase tracking-[0.6em] mt-4 flex items-center gap-2"><X size={12}/> 点击任意位置物理退出预览</button>
            </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .flagship-modal .ant-modal-content { border-radius: 2rem !important; padding: 2rem !important; border: 1px solid #f1f5f9 !important; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1) !important; }
        .flagship-select .ant-select-selector { border-radius: 12px !important; border-color: #e2e8f0 !important; height: 44px !important; padding: 0 16px !important; display: flex !important; align-items: center !important; }
        .flagship-input { border-radius: 12px !important; border-color: #e2e8f0 !important; transition: all 0.3s !important; }
        .flagship-input:focus, .flagship-input:hover { border-color: #07C160 !important; box-shadow: 0 0 0 4px rgba(7, 193, 96, 0.08) !important; }
        * { font-style: normal !important; }
      `}} />
    </div>
    </ConfigProvider>
  );
};

export default PersonalInfo;
