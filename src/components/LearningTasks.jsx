import React, { useState, useEffect } from 'react';
import { formatDate } from '../utils/date'
import { toast } from 'react-toastify';
import api from '../api';
import { getApiUrl } from '../utils/apiConfig';

const LearningTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: ''
  });

  // 获取任务列表
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await api.get('/learning-tasks');
      setTasks(response.data || []);
    } catch (error) {
      console.error('获取任务列表失败:', error);
      toast.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingTask) {
        await api.put(`/learning-tasks/${editingTask.id}`, formData);
        toast.success('任务更新成功');
      } else {
        await api.post('/learning-tasks', formData);
        toast.success('任务创建成功');
      }
      setShowModal(false);
      resetForm();
      fetchTasks();
    } catch (error) {
      console.error('提交失败:', error);
      toast.error(editingTask ? '更新失败' : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 标记任务为完成
  const markTaskAsCompleted = async (taskId) => {
    try {
      await api.put(`/learning-tasks/${taskId}/complete`);
      toast.success('任务标记为完成');
      fetchTasks();
    } catch (error) {
      console.error('标记任务为完成失败:', error);
      toast.error('标记任务为完成失败');
    }
  };

  // 删除任务
  const deleteTask = async (taskId) => {
    if (!window.confirm('确定要删除这个任务吗？')) return;
    try {
      await api.delete(`/learning-tasks/${taskId}`);
      toast.success('任务已删除');
      fetchTasks();
    } catch (error) {
      console.error('删除任务失败:', error);
      toast.error('删除任务失败');
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      due_date: ''
    });
    setEditingTask(null);
  };

  // 编辑任务
  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">学习任务</h1>
            <p className="text-gray-600 mt-1">管理您的个人学习任务</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <span>+</span>
            <span>创建任务</span>
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="bg-white rounded-lg shadow-sm">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📋</div>
            <p>暂无学习任务</p>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              创建第一个任务
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {task.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        task.priority === 'high' ? 'bg-red-100 text-red-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority === 'high' ? '高优先级' :
                         task.priority === 'medium' ? '中优先级' : '低优先级'}
                      </span>
                      {task.status === 'completed' && (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          已完成
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-gray-600 mt-2 text-sm">{task.description}</p>
                    )}
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <span>创建时间: {formatDate(task.created_at)}</span>
                      {task.due_date && (
                        <span className="ml-4">
                          截止时间: {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {task.status !== 'completed' && (
                      <button
                        onClick={() => markTaskAsCompleted(task.id)}
                        className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                      >
                        标记完成
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(task)}
                      className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 创建/编辑任务 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingTask ? '编辑任务' : '创建任务'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  任务标题 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入任务标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  任务描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="请输入任务描述"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  优先级
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">低优先级</option>
                  <option value="medium">中优先级</option>
                  <option value="high">高优先级</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  截止日期
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={loading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  {loading ? '提交中...' : (editingTask ? '更新' : '创建')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningTasks;
