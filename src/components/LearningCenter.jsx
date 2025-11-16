import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import LearningPlanDetails from './LearningPlanDetails';

const LearningCenter = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [viewingPlanDetails, setViewingPlanDetails] = useState(null);
  const [statistics, setStatistics] = useState({
    totalTasks: 0,
    completedTasks: 0,
    totalPlans: 0,
    completedPlans: 0,
    articlesRead: 0,
    examsTaken: 0,
    totalDuration: 0
  });
  const [loading, setLoading] = useState(false);

  // 获取学习统计
  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const response = await api.get('/learning-center/statistics');
      setStatistics(response.data);
    } catch (error) {
      console.error('获取学习统计失败:', error);
      toast.error('获取学习统计失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化时间
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}小时${mins}分钟`;
    }
    return `${mins}分钟`;
  };

  // 计算任务完成率
  const getTaskCompletionRate = () => {
    if (statistics.totalTasks === 0) return 0;
    return Math.round((statistics.completedTasks / statistics.totalTasks) * 100);
  };

  // 计算计划完成率
  const getPlanCompletionRate = () => {
    if (statistics.totalPlans === 0) return 0;
    return Math.round((statistics.completedPlans / statistics.totalPlans) * 100);
  };

  // 添加查看详情函数
  const viewPlanDetails = (planId) => {
    setViewingPlanDetails(planId);
  };

  // 返回学习中心
  const backToLearningCenter = () => {
    setViewingPlanDetails(null);
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  // 如果正在查看计划详情，显示详情组件
  if (viewingPlanDetails) {
    return <LearningPlanDetails planId={viewingPlanDetails} onBack={backToLearningCenter} />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">学习中心</h1>
        <p className="text-gray-600 mt-1">管理和跟踪您的学习进度</p>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              概览
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'plans'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              学习计划
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'statistics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              学习统计
            </button>
          </nav>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-6">学习概览</h2>

              {/* 统计卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* 任务完成率 */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-full">
                      <span className="text-blue-600 text-xl">📋</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-gray-500 text-sm">任务完成率</p>
                      <p className="text-2xl font-bold text-gray-900">{getTaskCompletionRate()}%</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${getTaskCompletionRate()}%` }}
                      ></div>
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      {statistics.completedTasks} / {statistics.totalTasks} 个任务已完成
                    </p>
                  </div>
                </div>

                {/* 计划完成率 */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-full">
                      <span className="text-green-600 text-xl">📅</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-gray-500 text-sm">计划完成率</p>
                      <p className="text-2xl font-bold text-gray-900">{getPlanCompletionRate()}%</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${getPlanCompletionRate()}%` }}
                      ></div>
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      {statistics.completedPlans} / {statistics.totalPlans} 个计划已完成
                    </p>
                  </div>
                </div>

                {/* 阅读文章数 */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 rounded-full">
                      <span className="text-purple-600 text-xl">📖</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-gray-500 text-sm">阅读文章</p>
                      <p className="text-2xl font-bold text-gray-900">{statistics.articlesRead}</p>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-4">篇文章已阅读</p>
                </div>

                {/* 学习时长 */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-3 bg-yellow-100 rounded-full">
                      <span className="text-yellow-600 text-xl">⏱️</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-gray-500 text-sm">学习时长</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatDuration(Math.floor(statistics.totalDuration / 60))}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-4">总学习时间</p>
                </div>
              </div>

              {/* 快速操作 */}
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-4">快速操作</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setActiveTab('plans')}
                    className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-2xl mb-2">📅</span>
                    <span className="text-gray-700">制定计划</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('statistics')}
                    className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-2xl mb-2">📊</span>
                    <span className="text-gray-700">查看统计</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plans' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800">学习计划</h2>
                <div className="space-x-2">
                  <button
                    onClick={() => window.location.hash = '#/learning-plans'}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    管理计划
                  </button>
                  <button
                    onClick={() => viewPlanDetails(1)} // 这里应该传入实际的计划ID，暂时用1作为示例
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    查看详情
                  </button>
                </div>
              </div>
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📅</div>
                <p>点击"管理计划"按钮进入计划管理页面</p>
                <p className="mt-2">点击"查看详情"按钮查看计划详情</p>
              </div>
            </div>
          )}

          {activeTab === 'statistics' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800">学习统计</h2>
                <button
                  onClick={() => window.location.hash = '#/learning-statistics'}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  详细统计
                </button>
              </div>
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">📊</div>
                <p>点击"详细统计"按钮查看完整统计信息</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LearningCenter;
