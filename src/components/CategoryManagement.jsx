import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import Modal from './Modal';
import debounce from 'lodash.debounce';

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await api.get('/categories');
      // Handle response structure: { success: true, data: { categories: [...] } } or { success: true, data: [...] }
      const categoriesData = response.data?.data?.categories || response.data?.data || [];
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      console.error('获取分类失败:', error);
      toast.error('获取分类列表失败');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, formData);
        toast.success('分类更新成功');
      } else {
        await api.post('/categories', formData);
        toast.success('分类创建成功');
      }
      setShowModal(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      console.error('提交失败:', error);
      toast.error(editingCategory ? '更新失败' : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('确定要删除这个分类吗？')) return;

    try {
      await api.delete(`/categories/${categoryId}`);
      toast.success('分类删除成功');
      fetchCategories();
    } catch (error) {
      console.error('删除分类失败:', error);
      toast.error('删除分类失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
    });
    setEditingCategory(null);
  };

  const filteredCategories = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    return categories.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  // Debounced search handler
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className="p-0">
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">分类管理</h2>
            <p className="text-gray-500 text-sm mt-1">共 {filteredCategories.length} 个分类</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              <span>新建分类</span>
            </button>
          </div>
        </div>

        {/* 搜索筛选区 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <input
            type="text"
            placeholder="按分类名称、描述搜索..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider rounded-tl-lg">分类名称</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">描述</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider rounded-tr-lg">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="3" className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <p className="mt-2 text-gray-600">加载中...</p>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                    暂无分类
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category, index) => (
                  <tr key={category.id} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-primary-50/30'} hover:bg-primary-100/50 transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{category.name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{category.description || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setFormData({
                              name: category.name,
                              description: category.description || '',
                            });
                            setShowModal(true);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 创建/编辑分类Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingCategory ? '编辑分类' : '新建分类'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">分类名称 *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="输入分类名称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="输入分类描述"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CategoryManagement;
