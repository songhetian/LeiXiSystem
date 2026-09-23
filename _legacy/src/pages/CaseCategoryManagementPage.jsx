import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
    Plus, 
    Edit3, 
    Trash2, 
    Layers, 
    ArrowUpNarrowWide, 
    Power,
    X,
    FolderTree,
    Info,
    CheckCircle2
} from 'lucide-react';
import qualityAPI from '../api/qualityAPI.js';
import { 
    ConfigProvider, 
    Input, 
    InputNumber, 
    Switch, 
    Button, 
    Empty,
    Tooltip
} from 'antd';

const { TextArea } = Input;

const CaseCategoryManagementPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    parent_id: null,
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getCaseCategories({ includeInactive: true });
      setCategories(response.data.flatData || []);
    } catch (error) {
      toast.error('加载分类列表失败');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setCurrentCategory(null);
    setCategoryForm({ name: '', description: '', parent_id: null, sort_order: 0, is_active: true });
    setIsModalOpen(true);
  };

  const openEditModal = (category) => {
    setCurrentCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      parent_id: category.parent_id,
      sort_order: category.sort_order,
      is_active: category.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!categoryForm.name.trim()) return toast.error('请输入分类名称');
    setSubmitting(true);
    try {
      const payload = {
        ...categoryForm,
        sort_order: parseInt(categoryForm.sort_order) || 0,
        parent_id: categoryForm.parent_id || null,
      };

      if (currentCategory) {
        await qualityAPI.updateCaseCategory(currentCategory.id, payload);
        toast.success('分类信息已更新');
      } else {
        await qualityAPI.createCaseCategory(payload);
        toast.success('新分类已成功创建');
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      toast.error(`操作失败: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('确定要删除这个案例分类吗？此操作不可恢复。')) {
      try {
        await qualityAPI.deleteCaseCategory(id);
        toast.success('分类已彻底移除');
        loadCategories();
      } catch (error) {
        toast.error('删除失败，该分类可能已被引用');
      }
    }
  };

  const handleToggleActive = async (category) => {
    try {
      await qualityAPI.updateCaseCategory(category.id, { is_active: !category.is_active });
      toast.success(category.is_active ? '分类已禁用' : '分类已启用');
      loadCategories();
    } catch (error) {
      toast.error('状态切换失败');
    }
  };

  return (
    <ConfigProvider theme={{
        token: {
            colorPrimary: '#2563eb',
            borderRadius: 10,
        }
    }}>
    <div className="p-4 bg-[#f8fafc] min-h-screen select-none">
      {/* 极简单行顶栏 */}
      <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm p-3 mb-4 sticky top-0 z-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 pl-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <FolderTree size={18} />
            </div>
            <div className="flex flex-col">
                <h1 className="text-sm font-black text-slate-800">案例分类管理</h1>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    共计 {categories.length} 个活跃节点
                </span>
            </div>
          </div>

          <div className="flex gap-2 pr-1">
            <button
              onClick={openCreateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black py-1.5 px-5 rounded-xl text-[10px] shadow-md shadow-blue-100 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Plus size={14} strokeWidth={3} /> 新增根分类
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="py-4 px-6 text-left font-black text-slate-400 text-[10px] uppercase tracking-widest">分类名称</th>
                <th className="py-4 px-6 text-left font-black text-slate-400 text-[10px] uppercase tracking-widest">描述信息</th>
                <th className="py-4 px-4 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">排序权重</th>
                <th className="py-4 px-4 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">当前状态</th>
                <th className="py-4 px-6 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">操作管理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-5 px-6"><div className="h-4 w-32 bg-slate-100 rounded-lg"></div></td>
                    <td className="py-5 px-6"><div className="h-4 w-48 bg-slate-100 rounded-lg"></div></td>
                    <td className="py-5 px-4"><div className="h-4 w-8 bg-slate-100 rounded-lg mx-auto"></div></td>
                    <td className="py-5 px-4"><div className="h-4 w-12 bg-slate-100 rounded-full mx-auto"></div></td>
                    <td className="py-5 px-6"><div className="h-8 w-24 bg-slate-100 rounded-xl mx-auto"></div></td>
                  </tr>
                ))
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-20">
                    <Empty description={<span className="text-[10px] font-black text-slate-300 uppercase">未发现分类数据</span>} />
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-4 rounded-full ${category.is_active ? 'bg-blue-500' : 'bg-slate-300'}`} />
                        <span className="font-black text-slate-700 text-xs">{category.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-[11px] text-slate-500 font-medium line-clamp-1">{category.description || '暂无描述'}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">{category.sort_order}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${category.is_active
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}>
                        {category.is_active ? '● 已启用' : '○ 已禁用'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex gap-2 justify-center">
                        <Tooltip title="编辑详情">
                            <button onClick={() => openEditModal(category)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm active:scale-90">
                                <Edit3 size={14} />
                            </button>
                        </Tooltip>
                        <Tooltip title={category.is_active ? '禁用分类' : '启用分类'}>
                            <button onClick={() => handleToggleActive(category)} className={`p-2 border rounded-xl transition-all shadow-sm active:scale-90 ${category.is_active ? 'bg-white border-amber-200 text-amber-500 hover:bg-amber-50' : 'bg-white border-emerald-200 text-emerald-500 hover:bg-emerald-50'}`}>
                                <Power size={14} />
                            </button>
                        </Tooltip>
                        <Tooltip title="彻底删除">
                            <button onClick={() => handleDelete(category.id)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 rounded-xl transition-all shadow-sm active:scale-90">
                                <Trash2 size={14} />
                            </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 重构后的弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Layers size={18} />
                        </div>
                        <h3 className="text-sm font-black text-slate-800">{currentCategory ? '修改分类属性' : '创建新案例分类'}</h3>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400 transition-all"><X size={20} /></button>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">分类名称 *</label>
                        <Input 
                            placeholder="如：服务规范、异常处理..." 
                            value={categoryForm.name} 
                            onChange={e => setCategoryForm({...categoryForm, name: e.target.value})}
                            className="h-11 font-bold text-slate-700"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">描述说明</label>
                        <TextArea 
                            rows={3} 
                            placeholder="简要说明该分类涵盖的案例范围..." 
                            value={categoryForm.description}
                            onChange={e => setCategoryForm({...categoryForm, description: e.target.value})}
                            className="font-medium text-slate-600 p-3"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                <ArrowUpNarrowWide size={10} /> 排序权重
                            </label>
                            <InputNumber 
                                min={0} 
                                className="w-full h-11 flex items-center font-bold"
                                value={categoryForm.sort_order}
                                onChange={val => setCategoryForm({...categoryForm, sort_order: val})}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                <CheckCircle2 size={10} /> 启用状态
                            </label>
                            <div className="h-11 flex items-center pl-1">
                                <Switch 
                                    checked={categoryForm.is_active} 
                                    onChange={checked => setCategoryForm({...categoryForm, is_active: checked})}
                                    checkedChildren="启用"
                                    unCheckedChildren="禁用"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex justify-end gap-3">
                    <Button type="text" onClick={() => setIsModalOpen(false)} className="font-black text-slate-400">放弃修改</Button>
                    <Button 
                        type="primary" 
                        loading={submitting}
                        onClick={handleSubmit} 
                        className="h-10 px-8 rounded-xl font-black shadow-lg shadow-blue-100"
                    >
                        {currentCategory ? '更新保存' : '立即创建'}
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
    </ConfigProvider>
  );
};

export default CaseCategoryManagementPage;
