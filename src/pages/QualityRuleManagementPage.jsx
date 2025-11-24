import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import qualityAPI from '../api/qualityAPI.js';
import Modal from '../components/Modal'; // Assuming a generic Modal component exists

const QualityRuleManagementPage = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState(null); // For editing
  const [ruleForm, setRuleForm] = useState({
    rule_name: '',
    category: '',
    scoring_standard: '', // This will be a JSON string
    weight: 0,
    is_enabled: true,
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getAllRules();
      setRules(response.data.data);
    } catch (error) {
      toast.error('加载质检规则失败');
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRuleForm({
      ...ruleForm,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const openCreateModal = () => {
    setCurrentRule(null);
    setRuleForm({
      rule_name: '',
      category: '',
      scoring_standard: JSON.stringify({ criteria: [] }, null, 2), // Default empty JSON
      weight: 0,
      is_enabled: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (rule) => {
    setCurrentRule(rule);
    setRuleForm({
      rule_name: rule.rule_name,
      category: rule.category,
      scoring_standard: JSON.stringify(rule.scoring_standard, null, 2),
      weight: rule.weight,
      is_enabled: rule.is_enabled,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...ruleForm,
        scoring_standard: JSON.parse(ruleForm.scoring_standard), // Parse JSON string back to object
        weight: parseInt(ruleForm.weight),
      };

      if (currentRule) {
        await qualityAPI.updateRule(currentRule.id, payload);
        toast.success('质检规则更新成功');
      } else {
        await qualityAPI.createRule(payload);
        toast.success('质检规则创建成功');
      }
      setIsModalOpen(false);
      loadRules();
    } catch (error) {
      toast.error('操作失败: ' + (error.response?.data?.message || error.message));
      console.error('Error submitting rule:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('确定要删除这条规则吗？')) {
      try {
        await qualityAPI.deleteRule(id);
        toast.success('质检规则删除成功');
        loadRules();
      } catch (error) {
        toast.error('删除失败: ' + (error.response?.data?.message || error.message));
        console.error('Error deleting rule:', error);
      }
    }
  };

  const handleToggleEnable = async (rule) => {
    try {
      await qualityAPI.toggleRule(rule.id, !rule.is_enabled);
      toast.success('规则状态更新成功');
      loadRules();
    } catch (error) {
      toast.error('更新状态失败: ' + (error.response?.data?.message || error.message));
      console.error('Error toggling rule status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-600 text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="business-card">
        <div className="business-card-header">
          <div>
            <h2 className="business-card-title">质检规则管理</h2>
            <p className="text-gray-500 text-sm mt-1">共 {rules.length} 条规则</p>
          </div>
          <button
            onClick={openCreateModal}
            className="business-btn business-btn-primary"
          >
            新增规则
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="business-table">
            <thead>
              <tr>
                <th>规则名称</th>
                <th>分类</th>
                <th>权重</th>
                <th>启用状态</th>
                <th className="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-500">
                    暂无规则数据
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="font-medium">{rule.rule_name}</td>
                    <td>{rule.category}</td>
                    <td>{rule.weight}</td>
                    <td>
                      <span className={`business-badge ${rule.is_enabled
                          ? 'business-badge-success'
                          : 'business-badge-error'
                        }`}>
                        {rule.is_enabled ? '已启用' : '已禁用'}
                      </span>
                    </td>
                    <td className="text-center space-x-2">
                      <button
                        onClick={() => openEditModal(rule)}
                        className="business-btn business-btn-secondary business-btn-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleToggleEnable(rule)}
                        className={`business-btn business-btn-sm ${rule.is_enabled ? 'business-btn-warning' : 'business-btn-success'
                          }`}
                      >
                        {rule.is_enabled ? '禁用' : '启用'}
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="business-btn business-btn-danger business-btn-sm"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentRule ? '编辑质检规则' : '新增质检规则'}>
        <div className="space-y-4">
          <div>
            <label className="business-label">规则名称</label>
            <input
              type="text"
              name="rule_name"
              value={ruleForm.rule_name}
              onChange={handleFormChange}
              className="business-input"
            />
          </div>
          <div>
            <label className="business-label">分类</label>
            <input
              type="text"
              name="category"
              value={ruleForm.category}
              onChange={handleFormChange}
              className="business-input"
            />
          </div>
          <div>
            <label className="business-label">权重</label>
            <input
              type="number"
              name="weight"
              value={ruleForm.weight}
              onChange={handleFormChange}
              className="business-input"
            />
          </div>
          <div>
            <label className="business-label">评分标准 (JSON)</label>
            <textarea
              name="scoring_standard"
              value={ruleForm.scoring_standard}
              onChange={handleFormChange}
              rows="6"
              className="business-textarea font-mono text-sm"
            ></textarea>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_enabled"
              checked={ruleForm.is_enabled}
              onChange={handleFormChange}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label className="ml-2 block text-sm text-gray-900">启用</label>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setIsModalOpen(false)}
              className="business-btn business-btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="business-btn business-btn-primary"
            >
              {currentRule ? '更新' : '创建'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QualityRuleManagementPage;
