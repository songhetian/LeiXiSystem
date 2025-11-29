import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import qualityAPI from '../api/qualityAPI';
import Modal from './Modal';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  TagOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import './QualityTagManagement.css';

const QualityTagManagement = () => {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' or 'tags'

  // Modal states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form states
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    parent_id: null,
    sort_order: 0,
  });

  const [tagForm, setTagForm] = useState({
    name: '',
    description: '',
    color: '#10B981',
    category_id: null,
    parent_id: null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, tagsRes] = await Promise.all([
        qualityAPI.getTagCategories({ include_inactive: true }),
        qualityAPI.getTags({ tag_type: 'quality', include_inactive: true }),
      ]);
      setCategories(categoriesRes.data.data || []);
      setTags(tagsRes.data.data || []);
    } catch (error) {
      toast.error('加载数据失败');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Category CRUD
  const handleCreateCategory = () => {
    setEditingItem(null);
    setCategoryForm({
      name: '',
      description: '',
      color: generateRandomColor(),
      parent_id: null,
      sort_order: 0,
    });
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (category) => {
    setEditingItem(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      color: category.color || '#3B82F6',
      parent_id: category.parent_id,
      sort_order: category.sort_order || 0,
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('请输入分类名称');
      return;
    }

    try {
      if (editingItem) {
        await qualityAPI.updateTagCategory(editingItem.id, categoryForm);
        toast.success('分类更新成功');
      } else {
        await qualityAPI.createTagCategory(categoryForm);
        toast.success('分类创建成功');
      }
      setIsCategoryModalOpen(false);
      loadData();
    } catch (error) {
      toast.error(editingItem ? '更新分类失败' : '创建分类失败');
      console.error('Error saving category:', error);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('确定要删除此分类吗？删除后无法恢复。')) {
      return;
    }

    try {
      await qualityAPI.deleteTagCategory(id);
      toast.success('分类删除成功');
      loadData();
    } catch (error) {
      toast.error('删除分类失败：' + (error.response?.data?.message || '可能存在子分类或关联标签'));
      console.error('Error deleting category:', error);
    }
  };

  // Tag CRUD
  const handleCreateTag = () => {
    setEditingItem(null);
    setTagForm({
      name: '',
      description: '',
      color: generateRandomColor(),
      category_id: null,
      parent_id: null,
    });
    setIsTagModalOpen(true);
  };

  const handleEditTag = (tag) => {
    setEditingItem(tag);
    setTagForm({
      name: tag.name,
      description: tag.description || '',
      color: tag.color || '#10B981',
      category_id: tag.category_id,
      parent_id: tag.parent_id,
    });
    setIsTagModalOpen(true);
  };

  const handleSaveTag = async () => {
    if (!tagForm.name.trim()) {
      toast.error('请输入标签名称');
      return;
    }

    try {
      const data = { ...tagForm, tag_type: 'quality' };
      if (editingItem) {
        await qualityAPI.updateTag(editingItem.id, data);
        toast.success('标签更新成功');
      } else {
        await qualityAPI.createTag(data);
        toast.success('标签创建成功');
      }
      setIsTagModalOpen(false);
      loadData();
    } catch (error) {
      toast.error(editingItem ? '更新标签失败' : '创建标签失败');
      console.error('Error saving tag:', error);
    }
  };

  const handleDeleteTag = async (id) => {
    if (!window.confirm('确定要删除此标签吗？删除后无法恢复。')) {
      return;
    }

    try {
      await qualityAPI.deleteTag(id);
      toast.success('标签删除成功');
      loadData();
    } catch (error) {
      toast.error('删除标签失败：' + (error.response?.data?.message || '可能存在子标签'));
      console.error('Error deleting tag:', error);
    }
  };

  // Render tree structure
  const renderCategoryTree = (items, parentId = null, level = 0) => {
    return items
      .filter(item => item.parent_id === parentId)
      .map(item => (
        <div key={item.id} className="tree-item" style={{ paddingLeft: `${level * 24}px` }}>
          <div className="tree-item-content">
            <FolderOutlined className="tree-icon" />
            <span className="tree-label">{item.name}</span>
            <span
              className="tree-color-badge"
              style={{ backgroundColor: item.color }}
            />
            <span className="tree-level">层级: {item.level}</span>
            <div className="tree-actions">
              <button
                onClick={() => handleEditCategory(item)}
                className="btn-icon btn-edit"
                title="编辑"
              >
                <EditOutlined />
              </button>
              <button
                onClick={() => handleDeleteCategory(item.id)}
                className="btn-icon btn-delete"
                title="删除"
              >
                <DeleteOutlined />
              </button>
            </div>
          </div>
          {item.children && item.children.length > 0 && (
            <div className="tree-children">
              {renderCategoryTree(item.children, item.id, level + 1)}
            </div>
          )}
        </div>
      ));
  };

  const renderTagTree = (items, parentId = null, level = 0) => {
    return items
      .filter(item => item.parent_id === parentId)
      .map(item => (
        <div key={item.id} className="tree-item" style={{ paddingLeft: `${level * 24}px` }}>
          <div className="tree-item-content">
            <TagOutlined className="tree-icon" />
            <span className="tree-label">{item.name}</span>
            <span
              className="tag-badge"
              style={{ backgroundColor: item.color, color: '#fff' }}
            >
              {item.name}
            </span>
            <span className="tree-category">
              {item.category_name || '未分类'}
            </span>
            <span className="tree-usage">使用: {item.usage_count || 0}次</span>
            <div className="tree-actions">
              <button
                onClick={() => handleEditTag(item)}
                className="btn-icon btn-edit"
                title="编辑"
              >
                <EditOutlined />
              </button>
              <button
                onClick={() => handleDeleteTag(item.id)}
                className="btn-icon btn-delete"
                title="删除"
              >
                <DeleteOutlined />
              </button>
            </div>
          </div>
          {item.children && item.children.length > 0 && (
            <div className="tree-children">
              {renderTagTree(item.children, item.id, level + 1)}
            </div>
          )}
        </div>
      ));
  };

  // Flatten tree for select options
  const flattenCategories = (items, level = 0) => {
    let result = [];
    items.forEach(item => {
      result.push({ ...item, displayLevel: level });
      if (item.children && item.children.length > 0) {
        result = result.concat(flattenCategories(item.children, level + 1));
      }
    });
    return result;
  };

  if (loading) {
    return (
      <div className="tag-management-loading">
        <div className="loading-spinner">加载中...</div>
      </div>
    );
  }

  return (
    <div className="tag-management">
      <div className="tag-management-header">
        <h2 className="page-title">标签管理</h2>
        <p className="page-subtitle">
          管理质检标签分类和标签，支持无限级分类
        </p>
      </div>

      <div className="tag-management-tabs">
        <button
          className={`tab-button ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          <FolderOutlined /> 标签分类 ({categories.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'tags' ? 'active' : ''}`}
          onClick={() => setActiveTab('tags')}
        >
          <TagOutlined /> 标签 ({tags.length})
        </button>
      </div>

      <div className="tag-management-content">
        {activeTab === 'categories' ? (
          <div className="categories-panel">
            <div className="panel-header">
              <h3>标签分类</h3>
              <button
                onClick={handleCreateCategory}
                className="btn-primary"
              >
                <PlusOutlined /> 新建分类
              </button>
            </div>
            <div className="tree-container">
              {categories.length === 0 ? (
                <div className="empty-state">
                  <p>暂无标签分类</p>
                  <button onClick={handleCreateCategory} className="btn-primary">
                    创建第一个分类
                  </button>
                </div>
              ) : (
                renderCategoryTree(categories)
              )}
            </div>
          </div>
        ) : (
          <div className="tags-panel">
            <div className="panel-header">
              <h3>质检标签</h3>
              <button
                onClick={handleCreateTag}
                className="btn-primary"
              >
                <PlusOutlined /> 新建标签
              </button>
            </div>
            <div className="tree-container">
              {tags.length === 0 ? (
                <div className="empty-state">
                  <p>暂无标签</p>
                  <button onClick={handleCreateTag} className="btn-primary">
                    创建第一个标签
                  </button>
                </div>
              ) : (
                renderTagTree(tags)
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingItem ? '编辑分类' : '新建分类'}
      >
        <div className="form-group">
          <label>分类名称 *</label>
          <input
            type="text"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            placeholder="请输入分类名称"
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label>描述</label>
          <textarea
            value={categoryForm.description}
            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
            placeholder="请输入分类描述"
            className="form-textarea"
            rows="3"
          />
        </div>
        <div className="form-group">
          <label>父分类</label>
          <select
            value={categoryForm.parent_id || ''}
            onChange={(e) => setCategoryForm({ ...categoryForm, parent_id: e.target.value || null })}
            className="form-select"
          >
            <option value="">无（根分类）</option>
            {flattenCategories(categories)
              .filter(c => !editingItem || c.id !== editingItem.id)
              .map(cat => (
                <option key={cat.id} value={cat.id}>
                  {'　'.repeat(cat.displayLevel)}└ {cat.name}
                </option>
              ))}
          </select>
        </div>
        <div className="form-group">
          <label>颜色</label>
          <div className="color-picker-group">
            <input
              type="color"
              value={categoryForm.color}
              onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
              className="form-color-input"
            />
            <input
              type="text"
              value={categoryForm.color}
              onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
              className="form-input"
              placeholder="#3B82F6"
            />
            <button
              onClick={() => setCategoryForm({ ...categoryForm, color: generateRandomColor() })}
              className="btn-secondary"
            >
              随机
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>排序</label>
          <input
            type="number"
            value={categoryForm.sort_order}
            onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })}
            className="form-input"
          />
        </div>
        <div className="modal-actions">
          <button onClick={() => setIsCategoryModalOpen(false)} className="btn-secondary">
            <CloseOutlined /> 取消
          </button>
          <button onClick={handleSaveCategory} className="btn-primary">
            <SaveOutlined /> 保存
          </button>
        </div>
      </Modal>

      {/* Tag Modal */}
      <Modal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title={editingItem ? '编辑标签' : '新建标签'}
      >
        <div className="form-group">
          <label>标签名称 *</label>
          <input
            type="text"
            value={tagForm.name}
            onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
            placeholder="请输入标签名称"
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label>描述</label>
          <textarea
            value={tagForm.description}
            onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
            placeholder="请输入标签描述"
            className="form-textarea"
            rows="3"
          />
        </div>
        <div className="form-group">
          <label>所属分类</label>
          <select
            value={tagForm.category_id || ''}
            onChange={(e) => setTagForm({ ...tagForm, category_id: e.target.value || null })}
            className="form-select"
          >
            <option value="">无分类</option>
            {flattenCategories(categories).map(cat => (
              <option key={cat.id} value={cat.id}>
                {'　'.repeat(cat.displayLevel)}└ {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>父标签</label>
          <select
            value={tagForm.parent_id || ''}
            onChange={(e) => setTagForm({ ...tagForm, parent_id: e.target.value || null })}
            className="form-select"
          >
            <option value="">无（根标签）</option>
            {flattenCategories(tags)
              .filter(t => !editingItem || t.id !== editingItem.id)
              .map(tag => (
                <option key={tag.id} value={tag.id}>
                  {'　'.repeat(tag.displayLevel)}└ {tag.name}
                </option>
              ))}
          </select>
        </div>
        <div className="form-group">
          <label>颜色</label>
          <div className="color-picker-group">
            <input
              type="color"
              value={tagForm.color}
              onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
              className="form-color-input"
            />
            <input
              type="text"
              value={tagForm.color}
              onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
              className="form-input"
              placeholder="#10B981"
            />
            <button
              onClick={() => setTagForm({ ...tagForm, color: generateRandomColor() })}
              className="btn-secondary"
            >
              随机
            </button>
          </div>
          <div className="color-preview">
            <span className="tag-badge" style={{ backgroundColor: tagForm.color, color: '#fff' }}>
              {tagForm.name || '预览'}
            </span>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={() => setIsTagModalOpen(false)} className="btn-secondary">
            <CloseOutlined /> 取消
          </button>
          <button onClick={handleSaveTag} className="btn-primary">
            <SaveOutlined /> 保存
          </button>
        </div>
      </Modal>
    </div>
  );
};

// Helper function to generate random color
function generateRandomColor() {
  const goldenRatio = 0.618033988749895;
  const hue = (Math.random() + goldenRatio) % 1;
  const saturation = 0.6 + Math.random() * 0.2;
  const lightness = 0.5 + Math.random() * 0.15;

  return hslToHex(hue * 360, saturation * 100, lightness * 100);
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export default QualityTagManagement;
