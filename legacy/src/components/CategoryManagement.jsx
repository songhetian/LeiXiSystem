import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FolderOutlined } from '@ant-design/icons'; // 添加图标导入
import api from '../api';
import Modal from './Modal';
import './CategoryManagement.css';

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'recycle'
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // 初始化时展开所有节点
  useEffect(() => {
    if (categories.length > 0 && activeTab === 'active') {
      const allNodeIds = new Set();
      const collectNodeIds = (nodes) => {
        nodes.forEach(node => {
          allNodeIds.add(node.id);
          if (node.children && node.children.length > 0) {
            collectNodeIds(node.children);
          }
        });
      };
      collectNodeIds(categories);
      setExpandedNodes(allNodeIds);
    }
  }, [categories, activeTab]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: null,
  });

  useEffect(() => {
    fetchCategories();
  }, [activeTab]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'recycle'
        ? '/exam-categories/recycle-bin'
        : '/exam-categories/tree';

      const response = await api.get(endpoint);
      const categoriesData = response.data?.data || [];
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      logger.error('获取分类失败:', error);
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
      const submitData = {
        ...formData,
        code: formData.code || undefined, // 让后端自动生成
      };

      if (editingCategory) {
        await api.put(`/exam-categories/${editingCategory.id}`, submitData);
        toast.success('分类更新成功');
      } else {
        await api.post('/exam-categories', submitData);
        toast.success('分类创建成功');
      }
      setShowModal(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      logger.error('提交失败:', error);
      const errorMsg = error.response?.data?.message || (editingCategory ? '更新失败' : '创建失败');
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = (categoryId) => {
    const category = findCategoryById(categories, categoryId);
    setCategoryToDelete(category);
    setShowDeleteModal(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      await api.delete(`/exam-categories/${categoryToDelete.id}`);
      toast.success('分类已移至回收站');
      setShowDeleteModal(false);
      setCategoryToDelete(null);
      fetchCategories();
    } catch (error) {
      logger.error('删除分类失败:', error);
      toast.error(error.response?.data?.message || '删除分类失败');
      setShowDeleteModal(false);
      setCategoryToDelete(null);
    }
  };

  const handlePermanentDelete = (categoryId) => {
    const category = findCategoryById(categories, categoryId);
    setCategoryToDelete(category);
    setShowPermanentDeleteModal(true);
  };

  const confirmPermanentDelete = async () => {
    if (!categoryToDelete) return;

    try {
      await api.delete(`/exam-categories/${categoryToDelete.id}/permanent`);
      toast.success('分类已永久删除');
      setShowPermanentDeleteModal(false);
      setCategoryToDelete(null);
      fetchCategories();
    } catch (error) {
      logger.error('永久删除失败:', error);
      toast.error(error.response?.data?.message || '永久删除失败');
      setShowPermanentDeleteModal(false);
      setCategoryToDelete(null);
    }
  };

  const handleRestoreCategory = async (categoryId) => {
    try {
      await api.put(`/exam-categories/${categoryId}/restore`, { cascade: false });
      toast.success('分类恢复成功');
      fetchCategories();
    } catch (error) {
      logger.error('恢复分类失败:', error);
      toast.error(error.response?.data?.message || '恢复分类失败');
    }
  };

  const findCategoryById = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findCategoryById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      parent_id: null,
    });
    setEditingCategory(null);
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const renderTreeNode = (node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div key={node.id} className="tree-item" style={{ paddingLeft: `${level * 24}px` }}>
        <div
          className="tree-item-content"
        >
          {hasChildren && (
            <button
              className="expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
            >
              <span>{isExpanded ? '▼' : '▶'}</span>
            </button>
          )}
          {!hasChildren && <div className="expand-placeholder" />}

          {/* 添加文件夹图标 */}
          <FolderOutlined className="tree-icon" />

          <span className="tree-label">{node.name}</span>

          <div className="tree-actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFormData({
                  name: '',
                  description: '',
                  parent_id: node.id,
                });
                setShowModal(true);
              }}
              className="btn-icon add-btn"
              title="添加子分类"
            >
              <span>➕</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingCategory(node);
                setFormData({
                  name: node.name,
                  description: node.description || '',
                  parent_id: node.parent_id,
                });
                setShowModal(true);
              }}
              className="btn-icon edit-btn"
              title="编辑"
            >
              <span>✏️</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCategory(node.id);
              }}
              className="btn-icon delete-btn"
              title="删除"
            >
              <span>🗑️</span>
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <div className="category-management">
      <div className="category-header">
        <div>
          <h2>分类管理</h2>
          <p className="category-count">
            {activeTab === 'active' ? `共 ${categories.length} 个分类` : `回收站中 ${categories.length} 个分类`}
          </p>
        </div>
        <div className="header-actions">
          {activeTab === 'active' && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="btn-primary"
            >
              <span>➕</span>
              新建分类
            </button>
          )}
        </div>
      </div>

      {/* 标签页切换 */}
      <div className="category-tabs">
        <button
          onClick={() => setActiveTab('active')}
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
        >
          <span>📁</span>
          正常分类
        </button>
        <button
          onClick={() => setActiveTab('recycle')}
          className={`tab-btn ${activeTab === 'recycle' ? 'active' : ''}`}
        >
          <span>🗑️</span>
          回收站
        </button>
      </div>

      {/* 分类树或回收站列表 */}
      <div className="category-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>加载中...</p>
          </div>
        ) : activeTab === 'active' ? (
          <div className="category-tree">
            {categories.length === 0 ? (
              <div className="empty-state">
                <span>📂</span>
                <p>暂无分类，点击"新建分类"开始创建</p>
              </div>
            ) : (
              categories.map(node => renderTreeNode(node))
            )}
          </div>
        ) : (
          <div className="recycle-list">
            {categories.length === 0 ? (
              <div className="empty-state">
                <span>🗑️</span>
                <p>回收站为空</p>
              </div>
            ) : (
              <table className="recycle-table">
                <thead>
                  <tr>
                    <th>分类名称</th>
                    <th>删除时间</th>
                    <th>删除人</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(category => (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                      <td>{formatDate(category.deleted_at)}</td>
                      <td>{category.deleted_by_name || '-'}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            onClick={() => handleRestoreCategory(category.id)}
                            className="btn-icon restore-btn"
                            title="恢复"
                          >
                            <span>♻️</span>
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(category.id)}
                            className="btn-icon permanent-delete-btn"
                            title="永久删除"
                          >
                            <span>❌</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* 创建/编辑分类Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingCategory ? "编辑分类" : "新建分类"}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="categoryName">分类名称 *</label>
              <input
                id="categoryName"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入分类名称"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="categoryDescription">描述</label>
              <textarea
                id="categoryDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="请输入分类描述"
                className="form-textarea"
                rows="3"
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 删除确认对话框 */}
      {showDeleteModal && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="确认删除"
        >
          <div className="delete-confirm-content">
            <div className="confirm-icon warning">⚠️</div>
            <p className="confirm-text">
              确定要删除分类 "{categoryToDelete?.name}" 吗？
              <br />
              删除后将移至回收站，您仍可以恢复它。
            </p>
            <div className="confirm-actions">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={confirmDeleteCategory}
                className="btn-danger"
                disabled={loading}
              >
                {loading ? '删除中...' : '确定删除'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 永久删除确认对话框 */}
      {showPermanentDeleteModal && (
        <Modal
          isOpen={showPermanentDeleteModal}
          onClose={() => setShowPermanentDeleteModal(false)}
          title="确认永久删除"
        >
          <div className="delete-confirm-content">
            <div className="confirm-icon danger">⚠️</div>
            <p className="confirm-text danger">
              确定要永久删除分类 "{categoryToDelete?.name}" 吗？
              <br />
              <strong>此操作不可恢复！</strong>
            </p>
            <div className="confirm-actions">
              <button
                onClick={() => setShowPermanentDeleteModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={confirmPermanentDelete}
                className="btn-danger"
                disabled={loading}
              >
                {loading ? '删除中...' : '永久删除'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CategoryManagement;
