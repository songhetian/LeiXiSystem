import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { formatDate } from '../utils/date'
import { toast } from 'sonner';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';

const LearningTaskTracker = () => {
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  // 获取任务列表
  const fetchTasks = async () => {
    setLoading(true);
    try {
      // 获取待完成任务
      const pendingResponse = await axios.get(getApiUrl('/api/learning-tasks?status=pending'));
      // 获取已完成任务
      const completedResponse = await axios.get(getApiUrl('/api/learning-tasks?status=completed'));

      setTasks(pendingResponse.data || []);
      setCompletedTasks(completedResponse.data || []);
    } catch (error) {
      logger.error('获取任务列表失败:', error);
      toast.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 标记任务为完成
  const markTaskAsCompleted = async (taskId) => {
    try {
      await axios.put(getApiUrl(`/api/learning-tasks/${taskId}/complete`));
      toast.success('任务标记为完成');
      fetchTasks(); // 重新获取任务列表
    } catch (error) {
      logger.error('标记任务为完成失败:', error);
      toast.error('标记任务为完成失败');
    }
  };

  // 删除任务
  const deleteTask = async (taskId) => {
    if (!window.confirm('确定要删除这个任务吗？')) return;

    try {
      await axios.delete(getApiUrl(`/api/learning-tasks/${taskId}`));
      toast.success('任务已删除');
      fetchTasks(); // 重新获取任务列表
    } catch (error) {
      logger.error('删除任务失败:', error);
      toast.error('删除任务失败');
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">学习任务跟踪</h1>
        <p className="text-gray-600 mt-2">跟踪和管理您的学习任务</p>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              待完成 ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'completed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              已完成 ({completedTasks.length})
            </button>
          </nav>
        </div>

        {/* 任务列表 */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : activeTab === 'pending' ? (
            <div className="space-y-4">
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">📋</div>
                  <p>暂无待完成的任务</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{task.title}</h3>
                        {task.description && (
                          <p className="text-gray-600 mt-1 text-sm">{task.description}</p>
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
                        <button
                          onClick={() => markTaskAsCompleted(task.id)}
                          className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                        >
                          标记完成
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
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {completedTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">✅</div>
                  <p>暂无已完成的任务</p>
                </div>
              ) : (
                completedTasks.map((task) => (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-4 bg-green-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 line-through">{task.title}</h3>
                        {task.description && (
                          <p className="text-gray-600 mt-1 text-sm line-through">{task.description}</p>
                        )}
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                          <span>完成时间: {new Date(task.completed_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LearningTaskTracker;
