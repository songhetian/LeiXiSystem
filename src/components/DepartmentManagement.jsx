import api from '@/api';
import React, { useState, useEffect } from 'react'
import { formatDate } from '../utils/date'
import { toast } from 'sonner';
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import { 
    LayoutGrid, 
    Table as TableIcon, 
    Plus, 
    RefreshCcw, 
    Trash2, 
    Edit3, 
    RotateCcw,
    Users,
    Building2,
    Search
} from 'lucide-react';
import { 
    ConfigProvider, 
    Button, 
    Tag, 
    Space, 
    Typography, 
    Input, 
    Switch,
    Divider
} from 'antd';

const { Text, Title } = Typography;

function DepartmentManagement() {
  const [departments, setDepartments] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [viewMode, setViewMode] = useState('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', status: 'active' })

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [confirmDialogConfig, setConfirmDialogConfig] = useState({ title: '', message: '', onConfirm: null })

  useEffect(() => { fetchDepartments() }, [showDeleted])

  const fetchDepartments = async () => {
    setLoading(true)
    try {
      const path = showDeleted ? '/departments?includeDeleted=true' : '/departments'
      const response = await api.get(path)
      const data = response.data
      const deptsWithCount = await Promise.all(
        data.map(async (dept) => {
          try {
            const empResponse = await api.get('/employees')
            const count = empResponse.data.filter(emp => emp.department_id === dept.id).length
            return { ...dept, employee_count: count }
          } catch { return { ...dept, employee_count: 0 } }
        })
      )
      setDepartments(deptsWithCount)
    } catch (error) { toast.error('同步部门数据失败') } finally { setLoading(false) }
  }

  const totalPages = Math.max(1, Math.ceil(departments.length / pageSize))
  const getCurrentPageData = () => departments.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleStatusChange = async (dept, newStatus) => {
    const action = newStatus === 'active' ? '启用' : '停用'
    setConfirmDialogConfig({
      title: `${action}部门`,
      message: `确定要${action}部门 "${dept.name}" 吗？该操作将同步更新所属员工状态。`,
      onConfirm: async () => {
        try {
          await api.put(`/departments/update/${dept.id}`, { ...dept, status: newStatus })
          toast.success(`部门已${action}`); fetchDepartments();
        } catch { toast.error('操作失败') }
      }
    })
    setIsConfirmDialogOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const path = editingDept ? `/departments/update/${editingDept.id}` : '/departments/create'
      await (editingDept ? api.put(path, formData) : api.post(path, formData))
      toast.success(editingDept ? '配置更新成功' : '部门创建成功'); setIsModalOpen(false); fetchDepartments(); resetForm();
    } catch (e) { toast.error('保存失败') }
  }

  const handleDelete = (dept) => {
    setConfirmDialogConfig({
      title: '物理销毁部门',
      message: `确定要删除部门 "${dept.name}" 吗？删除后可随时恢复。`,
      onConfirm: async () => {
        try { await api.delete(`/departments/delete/${dept.id}`); toast.success('已移至回收站'); fetchDepartments(); }
        catch { toast.error('删除失败') }
      }
    })
    setIsConfirmDialogOpen(true)
  }

  const handleRestore = (id) => {
    setConfirmDialogConfig({
      title: '恢复部门',
      message: '确定要恢复该部门吗？恢复后部门将重新投入使用。',
      onConfirm: async () => {
        try { await api.post(`/departments/restore/${id}`); toast.success('部门已恢复'); fetchDepartments(); }
        catch { toast.error('恢复失败') }
      }
    })
    setIsConfirmDialogOpen(true)
  }

  const resetForm = () => { setFormData({ name: '', description: '', status: 'active' }); setEditingDept(null); }

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#000000', borderRadius: 6, controlHeight: 36, colorBorder: '#64748b' }
    }}>
    <div className="p-4 bg-[#f8fafc] min-h-screen text-left font-black">
      {/* 1. Header */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
          <Space size={16}>
            <div className="w-11 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-lg"><Building2 size={22} /></div>
            <div>
                <h1 className="text-lg font-black text-slate-900 m-0">组织架构管理</h1>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-0.5">企业部门层级定义与人力资源归属维护</p>
            </div>
          </Space>
          <Space>
            <Button onClick={() => { resetForm(); setIsModalOpen(true); }} type="primary" icon={<Plus size={14} />} className="font-black bg-slate-900 text-white h-9 px-6 border-none">新增部门</Button>
            <Button onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')} icon={viewMode === 'table' ? <LayoutGrid size={14} /> : <TableIcon size={14} />} className="font-black h-9 border-slate-400 text-slate-900">{viewMode === 'table' ? '卡片视图' : '表格视图'}</Button>
            <Button onClick={fetchDepartments} icon={<RefreshCcw size={14} />} loading={loading} className="font-black h-9 border-slate-400 text-slate-900" />
          </Space>
        </div>
        <div className="bg-slate-50/40 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Text className="text-[11px] font-black text-slate-900">共计活跃部门: <span className="text-indigo-700">{departments.filter(d => d.status !== 'deleted').length}</span></Text>
                <Divider type="vertical" className="border-slate-300" />
                <label className="flex items-center gap-2 text-[11px] font-black text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="w-4 h-4 rounded border-slate-400" />
                    显示回收站 (已删除)
                </label>
            </div>
        </div>
      </div>

      {/* 2. Content */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px]">
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">部门名称</th>
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">职责描述</th>
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">在册人数</th>
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">运行状态</th>
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">创建时间</th>
                <th className="px-6 py-3 text-center font-black text-slate-900 uppercase tracking-widest">管理决策</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-center font-black">
              {getCurrentPageData().map((dept) => (
                <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4"><Text className="text-[14px] font-black text-slate-900">{dept.name}</Text></td>
                  <td className="px-6 py-4"><Text className="text-[13px] font-black text-slate-700">{dept.description || '-'}</Text></td>
                  <td className="px-6 py-4"><Tag className="m-0 bg-indigo-100 text-indigo-900 border-none font-black px-3 py-0.5">{dept.employee_count || 0} 人</Tag></td>
                  <td className="px-6 py-4">
                    {dept.status === 'deleted' ? <Tag color="error" className="m-0 font-black">已销毁</Tag> : (
                      <Switch checked={dept.status === 'active'} size="small" onChange={(checked) => handleStatusChange(dept, checked ? 'active' : 'inactive')} className={dept.status === 'active' ? 'bg-emerald-600' : 'bg-slate-200'} />
                    )}
                  </td>
                  <td className="px-6 py-4 text-[12px] text-slate-600 font-bold">{formatDate(dept.created_at)}</td>
                  <td className="px-6 py-4">
                    <Space size={4}>
                      {dept.status === 'deleted' ? (
                        <Button size="small" icon={<RotateCcw size={12} />} onClick={() => handleRestore(dept.id)} className="text-[11px] font-black text-emerald-700 border-emerald-200 bg-emerald-50">恢复</Button>
                      ) : (
                        <>
                          <Button size="small" icon={<Edit3 size={12} />} onClick={() => { setEditingDept(dept); setFormData({name:dept.name, description:dept.description||'', status:dept.status}); setIsModalOpen(true); }} className="text-[11px] font-black text-blue-700 border-blue-200 bg-blue-50">编辑</Button>
                          <Button size="small" icon={<Trash2 size={12} />} onClick={() => handleDelete(dept)} className="text-[11px] font-black text-rose-700 border-rose-200 bg-rose-50">删除</Button>
                        </>
                      )}
                    </Space>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {getCurrentPageData().map((dept) => (
            <div key={dept.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-3">
                <Title level={5} className="m-0 font-black text-slate-900">{dept.name}</Title>
                {dept.status === 'deleted' ? <Tag color="error" className="m-0 font-black">已销毁</Tag> : <Tag color={dept.status === 'active'?'success':'default'} className="m-0 font-black">{dept.status === 'active'?'运行中':'已停用'}</Tag>}
              </div>
              <Text className="text-[12px] text-slate-600 font-bold block min-h-[36px] line-clamp-2 mb-4">{dept.description || '无详细职责描述'}</Text>
              <div className="flex items-center gap-4 mb-4">
                <Tag className="m-0 border-none bg-slate-100 text-slate-900 font-black"><Users size={12} className="inline mr-1" /> {dept.employee_count || 0}</Tag>
                <Text className="text-[10px] text-slate-400 font-bold">{formatDate(dept.created_at)}</Text>
              </div>
              <div className="pt-3 border-t border-slate-100 flex gap-2">
                {dept.status === 'deleted' ? (
                  <Button block size="small" onClick={() => handleRestore(dept.id)} className="font-black text-emerald-700 border-emerald-200">恢复部门</Button>
                ) : (
                  <>
                    <Button block size="small" onClick={() => { setEditingDept(dept); setFormData({name:dept.name, description:dept.description||'', status:dept.status}); setIsModalOpen(true); }} className="font-black text-blue-700 border-blue-200">编辑</Button>
                    <Button block size="small" onClick={() => handleDelete(dept)} className="font-black text-rose-700 border-rose-200">移除</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingDept ? '部门配置修订' : '创建新组织架构'}>
        <form onSubmit={handleSubmit} className="space-y-4 font-black">
          <div><label className="block text-[13px] font-black text-slate-700 mb-1">部门官方全称 *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full h-9 px-3 border border-slate-300 rounded-lg font-black text-slate-900 outline-none focus:border-slate-900" /></div>
          <div><label className="block text-[13px] font-black text-slate-700 mb-1">主要职责描述</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows="3" className="w-full p-3 border border-slate-300 rounded-lg font-black text-slate-900 outline-none focus:border-slate-900 resize-none" /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-6 h-9 border border-slate-300 rounded-lg text-[13px] font-black text-slate-600">放弃</button><button type="submit" className="px-8 h-9 bg-slate-900 text-white rounded-lg text-[13px] font-black">同步并保存</button></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)} onConfirm={confirmDialogConfig.onConfirm} title={confirmDialogConfig.title} message={confirmDialogConfig.message} zIndex={5000} />
    </div>
    </ConfigProvider>
  )
}

export default DepartmentManagement
