/**
 * 个人中心 (极简扁平版 - 修复失焦与视觉过载)
 */
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getImageUrl } from "../utils/fileUtils";
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Lock,
  Camera,
  MapPin,
  Save,
  ShieldCheck,
  Shield,
  Palette,
  Check,
} from "lucide-react";
import {
  ConfigProvider,
  Select,
  Input,
  Button,
  Modal,
  Upload,
  Tag,
  Avatar as AntdAvatar,
} from "antd";
import api from "../api";

// --- 子组件提取到外部 (彻底解决失焦问题) ---

const InfoCard = ({ title, icon: Icon, children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col ${className}`}>
    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
      <Icon size={16} className="text-slate-500" />
      <h3 className="text-sm font-bold text-slate-700">{title}</h3>
    </div>
    <div className="p-6 flex-1">{children}</div>
  </div>
);

const FormLabel = ({ label, icon: Icon }) => (
  <label className="text-[12px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
    {Icon && <Icon size={12} className="text-slate-400" />} {label}
  </label>
);

const PersonalInfo = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [theme, setTheme] = useState({ background: "#f0f2f5" });
  
  const [formData, setFormData] = useState({
    real_name: "",
    email: "",
    phone: "",
    emergency_contact: "",
    emergency_phone: "",
    address: "",
    education: "",
    id_card_front_url: "",
    id_card_back_url: "",
    avatar: "",
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("personalInfoTheme");
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (e) {}
    }
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const savedUserStr = localStorage.getItem("user");
      const cachedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
      if (cachedUser) {
        setUser(cachedUser);
        setFormData(prev => ({ ...prev, ...cachedUser }));
      }

      const response = await api.get(`/users/${cachedUser?.id}/profile`);
      if (response.data.success) {
        let userData = response.data.data;
        if (userData.avatar && userData.avatar.startsWith("data:image")) {
          userData.avatar = "";
        }
        setUser(userData);
        setFormData({ ...userData });
        localStorage.setItem("user", JSON.stringify(userData));
      }
    } catch (e) {
      console.error("加载用户信息失败", e);
    }
  };

  const handleFileUpload = async (file, field, bizType) => {
    const uploadData = new FormData();
    uploadData.append("file", file);
    try {
      toast.loading("正在上传...", { id: "uploading" });
      const res = await api.post(`/upload?bizType=${bizType}`, uploadData);
      if (res.data.success) {
        setFormData(prev => ({ ...prev, [field]: res.data.bizPath }));
        toast.success("上传成功", { id: "uploading" });
      }
    } catch (e) {
      toast.error("上传失败", { id: "uploading" });
    }
    return false;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await api.put(`/users/${user.id}/profile`, formData);
      if (response.data.success) {
        await loadUserInfo();
        setEditing(false);
        toast.success("保存成功");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword)
      return toast.error("新密码输入不一致");
    setPasswordLoading(true);
    try {
      const res = await api.post("/auth/change-password", {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword,
      });
      if (res.data.success) {
        toast.success("密码修改成功，请重新登录");
        setTimeout(() => {
          localStorage.clear();
          window.location.reload();
        }, 1500);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "修改失败");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) return <div className="p-20 text-center text-slate-400 font-bold">正在加载个人档案...</div>;

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff", borderRadius: 6 } }}>
      <div className="min-h-screen p-6 text-left transition-colors duration-500" style={{ backgroundColor: theme.background }}>
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* 顶部标题栏 */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-2 border-slate-100 p-1 bg-white overflow-hidden shadow-sm">
                  {formData.avatar ? (
                    <img src={getImageUrl(formData.avatar)} className="w-full h-full object-cover rounded-full" alt="avatar" />
                  ) : (
                    <div className="w-full h-full bg-slate-50 flex items-center justify-center rounded-full">
                      <User size={32} className="text-slate-300" />
                    </div>
                  )}
                </div>
                {editing && (
                  <Upload beforeUpload={(file) => handleFileUpload(file, "avatar", "avatar")} showUploadList={false}>
                    <button className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md hover:bg-blue-700">
                      <Camera size={14} />
                    </button>
                  </Upload>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">{user.real_name}</h2>
                  <Tag color="blue" className="m-0 font-bold px-2 rounded">{user.role || "正式员工"}</Tag>
                </div>
                <div className="flex items-center gap-4 text-slate-500 text-xs font-medium">
                  <span className="flex items-center gap-1"><Shield size={12} /> 工号: {user.employee_no || user.id}</span>
                  <span className="flex items-center gap-1"><ShieldCheck size={12} /> {user.department_name || "技术部"}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              {!editing ? (
                <>
                  <Button icon={<Palette size={14} />} onClick={() => setShowThemeModal(true)} className="font-bold">背景设置</Button>
                  <Button icon={<Lock size={14} />} onClick={() => setShowPasswordModal(true)} className="font-bold">修改密码</Button>
                  <Button type="primary" icon={<Save size={14} />} onClick={() => setEditing(true)} className="font-bold">编辑资料</Button>
                </>
              ) : (
                <>
                  <Button onClick={() => { setEditing(false); loadUserInfo(); }} className="font-bold">取消</Button>
                  <Button type="primary" loading={loading} onClick={handleSave} className="font-bold">保存修改</Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 基础资料 */}
            <InfoCard title="基础联络信息" icon={User}>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <FormLabel label="姓名" />
                    {editing ? (
                      <Input value={formData.real_name} onChange={e => setFormData({...formData, real_name: e.target.value})} className="font-bold text-slate-800" />
                    ) : (
                      <div className="py-1 text-sm font-bold text-slate-800">{formData.real_name}</div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <FormLabel label="学历" />
                    {editing ? (
                      <Select 
                        value={formData.education} 
                        onChange={v => setFormData({...formData, education: v})} 
                        className="w-full font-bold"
                        options={["高中", "大专", "本科", "硕士", "博士"].map(o => ({ label: o, value: o }))}
                      />
                    ) : (
                      <div className="py-1 text-sm font-bold text-slate-800">{formData.education || "未填写"}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col">
                  <FormLabel label="手机号码" icon={Phone} />
                  {editing ? (
                    <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="font-bold text-slate-800" />
                  ) : (
                    <div className="py-1 text-sm font-bold text-slate-800">{formData.phone || "未填写"}</div>
                  )}
                </div>
                <div className="flex flex-col">
                  <FormLabel label="个人邮箱" icon={Mail} />
                  {editing ? (
                    <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="font-bold text-slate-800" />
                  ) : (
                    <div className="py-1 text-sm font-bold text-slate-800">{formData.email || "未填写"}</div>
                  )}
                </div>
              </div>
            </InfoCard>

            {/* 紧急联系 */}
            <InfoCard title="紧急联系与地址" icon={MapPin}>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <FormLabel label="紧急联系人" />
                    {editing ? (
                      <Input value={formData.emergency_contact} onChange={e => setFormData({...formData, emergency_contact: e.target.value})} className="font-bold text-slate-800" />
                    ) : (
                      <div className="py-1 text-sm font-bold text-slate-800">{formData.emergency_contact || "未填写"}</div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <FormLabel label="联系人电话" />
                    {editing ? (
                      <Input value={formData.emergency_phone} onChange={e => setFormData({...formData, emergency_phone: e.target.value})} className="font-bold text-slate-800" />
                    ) : (
                      <div className="py-1 text-sm font-bold text-slate-800">{formData.emergency_phone || "未填写"}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col">
                  <FormLabel label="常驻地址" icon={MapPin} />
                  {editing ? (
                    <Input.TextArea rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="font-bold text-slate-800" />
                  ) : (
                    <div className="py-1 text-sm font-bold text-slate-800">{formData.address || "未填写"}</div>
                  )}
                </div>
              </div>
            </InfoCard>

            {/* 证件存档 */}
            <div className="md:col-span-2">
              <InfoCard title="数字化身份存证" icon={ShieldCheck}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[
                    { label: "身份证正面", name: "id_card_front_url", val: formData.id_card_front_url },
                    { label: "身份证反面", name: "id_card_back_url", val: formData.id_card_back_url }
                  ].map((img, i) => (
                    <div key={i} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-600">{img.label}</span>
                        {img.val && <Tag color="success" className="m-0 border-none font-bold text-[10px]">已同步</Tag>}
                      </div>
                      <div className="aspect-video bg-slate-50 border border-slate-200 rounded-lg overflow-hidden relative group">
                        {img.val ? (
                          <img src={getImageUrl(img.val)} className="w-full h-full object-cover" alt="ID card" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                            <Camera size={24} />
                            <span className="text-[10px] font-bold">待上传</span>
                          </div>
                        )}
                        {editing && (
                          <Upload beforeUpload={(file) => handleFileUpload(file, img.name, "id_cards")} showUploadList={false}>
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                              <Button type="primary" size="small" className="font-bold">更换照片</Button>
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

        {/* 修改密码弹窗 */}
        <Modal
          title={<span className="font-bold text-slate-800">重置安全密码</span>}
          open={showPasswordModal}
          onCancel={() => setShowPasswordModal(false)}
          footer={null}
          centered
          width={400}
        >
          <form onSubmit={handlePasswordChange} className="py-4 space-y-5">
            <div>
              <FormLabel label="当前旧密码" />
              <Input.Password value={passwordData.oldPassword} onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})} className="h-10 font-bold" />
            </div>
            <div>
              <FormLabel label="设定新密码" />
              <Input.Password value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} className="h-10 font-bold" />
            </div>
            <div>
              <FormLabel label="确认新密码" />
              <Input.Password value={passwordData.confirmPassword} onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} className="h-10 font-bold" />
            </div>
            <Button type="primary" htmlType="submit" block loading={passwordLoading} className="h-10 font-bold mt-4 bg-slate-900 border-none">
              确认修改并重新登录
            </Button>
          </form>
        </Modal>

        {/* 个性化设置弹窗 - 扁平版 */}
        <Modal
          title={<span className="font-bold text-slate-800">个性化画布设置</span>}
          open={showThemeModal}
          onCancel={() => setShowThemeModal(false)}
          footer={null}
          centered
          width={400}
        >
          <div className="py-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">选择系统背景底色</div>
            <div className="grid grid-cols-5 gap-3">
              {[
                "#f0f2f5", "#ffffff", "#fafafa", "#f8fafc", "#f1f5f9",
                "#eff6ff", "#f0fdf4", "#fff7ed", "#fff1f2", "#f5f3ff"
              ].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setTheme({ background: c });
                    localStorage.setItem("personalInfoTheme", JSON.stringify({ background: c }));
                  }}
                  className={`aspect-square rounded-lg border-2 transition-all relative ${theme.background === c ? "border-blue-500 shadow-md scale-105" : "border-slate-100 hover:border-slate-300"}`}
                  style={{ backgroundColor: c }}
                >
                  {theme.background === c && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check size={16} className={c === "#ffffff" || c === "#fafafa" || c === "#f8fafc" ? "text-blue-500" : "text-white shadow-sm"} />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <Button type="primary" block onClick={() => setShowThemeModal(false)} className="h-10 font-bold mt-8 bg-blue-600">
              完成设置
            </Button>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

export default PersonalInfo;
