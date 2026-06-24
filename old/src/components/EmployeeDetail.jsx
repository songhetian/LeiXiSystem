import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react'
import { Drawer, Tag, Timeline, Badge, Typography, Avatar, Divider, Space, Skeleton, Empty, Descriptions, Button, Tooltip, Progress, ConfigProvider } from 'antd'
import { 
  Phone, 
  Mail, 
  Home, 
  Calendar,
  FileText,
  User,
  Clock,
  Edit3,
  Key,
  CheckCircle2,
  AlertCircle,
  Trophy,
  CreditCard,
  Target,
  X
} from 'lucide-react'
import { formatDate } from '../utils/date'
import { getApiUrl } from '../utils/apiConfig'
import { getImageUrl } from '../utils/fileUtils'

const { Title, Text, Paragraph } = Typography;

function EmployeeDetail({ employee, isOpen, onClose, onAction }) {
  const [employeeChanges, setEmployeeChanges] = useState([])
  const [detailedEmployee, setDetailedEmployee] = useState(null)
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    if (employee && isOpen) {
      setDetailedEmployee(employee)
      fetchFullProfile()
      fetchEmployeeChanges()
    }
  }, [employee, isOpen])

  const fetchFullProfile = async () => {
    setProfileLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/api/users/${employee.user_id}/profile`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setDetailedEmployee(prev => ({ ...prev, ...result.data }))
        }
      }
    } catch (error) {
      logger.error('获取员工详细信息失败:', error)
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchEmployeeChanges = async () => {
    if (!employee?.id) return
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(getApiUrl(`/api/employee-changes/${employee.id}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const result = await response.json()
        setEmployeeChanges(Array.isArray(result) ? result : [])
      }
    } catch (error) {
      logger.error('获取员工变动记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateCompleteness = () => {
    if (!detailedEmployee) return 0;
    const fields = ['phone', 'email', 'address', 'education', 'skills', 'id_card_front_url', 'emergency_contact'];
    const filled = fields.filter(f => detailedEmployee[f]).length;
    return Math.round((filled / fields.length) * 100);
  }

  const calculateDurationDays = (startDate) => {
    if (!startDate) return 0
    const start = new Date(startDate)
    const end = new Date()
    return Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24))
  }

  const getChangeLabel = (type) => {
    const config = {
      hire: { color: 'green', text: '入职' },
      transfer: { color: 'blue', text: '调岗' },
      promotion: { color: 'gold', text: '晋升' },
      resign: { color: 'red', text: '离职' },
      terminate: { color: 'red', text: '解聘' }
    }
    return config[type] || { color: 'default', text: type }
  }

  if (!employee) return null

  return (
    <ConfigProvider theme={{
      token: { colorPrimary: '#0052D4', borderRadius: 12 },
      components: {
        Descriptions: { labelColor: '#64748b', contentColor: '#1e293b' }
      }
    }}>
      <Drawer
        title={null}
        placement="right"
        onClose={onClose}
        open={isOpen}
        width={520}
        styles={{ 
          body: { padding: 0, overflowX: 'hidden', background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(20px)' },
          mask: { backdropFilter: 'blur(4px)', background: 'rgba(0, 0, 0, 0.1)' }
        }}
        closable={false}
      >
        {/* 顶部操作区 */}
        <div className="sticky top-0 z-50 bg-white/40 backdrop-blur-xl px-6 py-4 border-b border-white/20 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-600">
              <User size={14} />
            </div>
            <span className="text-xs font-black text-slate-800 tracking-wider">档案详情</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onAction?.('edit', detailedEmployee)}
              className="w-8 h-8 rounded-lg bg-white/50 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-all border border-white/50 shadow-sm"
            >
              <Edit3 size={16} />
            </button>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all border border-rose-500/10"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 核心身份栏 */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-5 mb-6 bg-white/40 backdrop-blur-md p-5 rounded-2xl border border-white/60 shadow-sm">
            <Badge 
              dot 
              offset={[-10, 85]} 
              status={detailedEmployee?.status === 'active' ? 'success' : 'default'}
              style={{ width: 14, height: 14, border: '2px solid #fff' }}
            >
              <Avatar 
                size={90} 
                src={detailedEmployee?.avatar ? getImageUrl(detailedEmployee.avatar) : null}
                icon={<User size={40} />}
                className="rounded-2xl border-2 border-white shadow-lg bg-white"
              />
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">{detailedEmployee?.real_name}</h2>
                {detailedEmployee?.is_department_manager === 1 && (
                  <span className="px-2 py-0.5 bg-amber-500 text-white font-black text-[9px] uppercase rounded shadow-sm shadow-amber-200">主管</span>
                )}
              </div>
              <div className="text-[11px] font-bold text-slate-500 mb-3 flex items-center gap-2">
                <span className="text-blue-600 font-mono">#{detailedEmployee?.employee_no}</span>
                <span className="opacity-20">|</span>
                <span>{detailedEmployee?.department_name}</span>
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-sm font-black text-slate-900">{calculateDurationDays(detailedEmployee?.hire_date)} <span className="text-[9px] text-slate-400 font-bold">天</span></div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">在职时长</div>
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 flex items-center gap-1">{detailedEmployee?.rating || 3} <Trophy size={10} className="text-amber-500" /></div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">绩效评级</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            <Button block className="rounded-xl font-bold text-[11px] h-9 bg-white/50 border-white/60 hover:bg-blue-50" onClick={() => onAction?.('edit', detailedEmployee)}>修改资料</Button>
            <Button block className="rounded-xl font-bold text-[11px] h-9 bg-white/50 border-white/60 hover:bg-indigo-50" onClick={() => onAction?.('resetPassword', detailedEmployee)}>账号安全</Button>
            <Button block className="rounded-xl font-bold text-[11px] h-9 bg-white/50 border-white/60 hover:bg-slate-100" onClick={() => onAction?.('permission', detailedEmployee)}>权限管理</Button>
          </div>
        </div>

        {/* 详细档案 */}
        <div className="p-6 pt-0 space-y-8">
          <section>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <FileText size={12} className="text-blue-500" /> 基础联络档案
            </h3>
            <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 p-6 shadow-sm">
              {profileLoading ? <Skeleton active /> : (
                <Descriptions column={1} size="small" colon={false} labelStyle={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', width: '80px' }} contentStyle={{ fontWeight: 800, fontSize: '12px', color: '#1e293b' }}>
                  <Descriptions.Item label="联系电话">{detailedEmployee?.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="入职日期">{formatDate(detailedEmployee?.hire_date)}</Descriptions.Item>
                  <Descriptions.Item label="电子邮箱">{detailedEmployee?.email || '-'}</Descriptions.Item>
                  <Descriptions.Item label="最高学历">{detailedEmployee?.education || '-'}</Descriptions.Item>
                  <Descriptions.Item label="现居住址">{detailedEmployee?.address || '-'}</Descriptions.Item>
                </Descriptions>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <CreditCard size={12} className="text-indigo-500" /> 证件原件
            </h3>
            <div className="flex gap-3">
              <div 
                onClick={() => detailedEmployee?.id_card_front_url && window.open(getImageUrl(detailedEmployee.id_card_front_url))}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl hover:bg-white/60 cursor-pointer transition-all group"
              >
                <CreditCard size={16} className="text-slate-400 group-hover:text-blue-500" />
                <span className="text-[10px] font-black text-slate-500">身份证正面</span>
              </div>
              <div 
                onClick={() => detailedEmployee?.id_card_back_url && window.open(getImageUrl(detailedEmployee.id_card_back_url))}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl hover:bg-white/60 cursor-pointer transition-all group"
              >
                <CreditCard size={16} className="text-slate-400 group-hover:text-blue-500" />
                <span className="text-[10px] font-black text-slate-500">身份证反面</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Clock size={12} className="text-emerald-500" /> 成长足迹
            </h3>
            {loading ? <Skeleton active /> : employeeChanges.length > 0 ? (
              <Timeline 
                className="px-2"
                items={employeeChanges.map(change => ({
                  color: '#0052D4',
                  children: (
                    <div className="pb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-black text-slate-800">{change.new_department_name} · {change.new_position || change.new_position_name}</span>
                        <span className="text-[9px] font-bold text-slate-400">{formatDate(change.change_date)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 italic bg-white/30 p-2 rounded-lg border border-white/40">
                        {change.reason || '调动记录'}
                      </div>
                    </div>
                  )
                }))}
              />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-[9px] font-bold text-slate-300 uppercase">暂无数据</span>} />}
          </section>

          <section className="pb-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Target size={12} className="text-rose-500" /> 内部评价
            </h3>
            <div className="space-y-3">
              <div className="p-4 bg-slate-900/90 backdrop-blur-md rounded-2xl text-white shadow-lg">
                <div className="text-[9px] font-black text-blue-400 uppercase mb-2">专业技能</div>
                <div className="flex flex-wrap gap-1.5">
                  {detailedEmployee?.skills ? detailedEmployee.skills.split(/[,，、\s]+/).map((s, i) => (
                    <Tag key={i} className="m-0 border-none bg-white/10 text-white font-black text-[9px] px-2 py-0.5 rounded"># {s}</Tag>
                  )) : <span className="text-[9px] italic text-white/40">未定义</span>}
                </div>
              </div>
              <div className="p-4 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl shadow-sm">
                <div className="text-[9px] font-black text-slate-400 uppercase mb-2">评估备注</div>
                <Paragraph className="text-[11px] font-bold text-slate-600 m-0 italic leading-relaxed">
                  {detailedEmployee?.remark || '暂无备注。'}
                </Paragraph>
              </div>
            </div>
          </section>
        </div>
      </Drawer>
    </ConfigProvider>
  )
}

export default EmployeeDetail
