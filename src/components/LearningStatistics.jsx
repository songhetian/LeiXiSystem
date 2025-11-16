import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';

const LearningStatistics = () => {
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
  const [timeRange, setTimeRange] = useState('week'); // week, month, year

  // 获取学习统计
  const fetchStatistics = async () => {
    setLoading(true);
    try {
      // 这里应该调用后端API获取真实统计数据
      // 暂时使用模拟数据
      const mockData = {
        totalTasks: 15,
        completedTasks: 12,
        totalPlans: 3,
        completedPlans: 1,
        articlesRead: 28,
        examsTaken: 5,
        totalDuration: 1200 // 分钟
      };
      setStatistics(mockData);
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

  useEffect(() => {
    fetchStatistics();
  }, [timeRange]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">学习统计</h1>
            <p className="text-gray-600 mt-1">查看您的学习进度和统计信息</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">时间范围:</span>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="week">本周</option>
              <option value="month">本月</option>
              <option value="year">本年</option>
            </select>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* 任务完成率 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
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
        <div className="bg-white rounded-lg shadow-sm p-6">
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
        <div className="bg-white rounded-lg shadow-sm p-6">
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
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <span className="text-yellow-600 text-xl">⏱️</span>
            </div>
            <div className="ml-4">
              <p className="text-gray-500 text-sm">学习时长</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(statistics.totalDuration)}
              </p>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-4">总学习时间</p>
        </div>
      </div>

      {/* 详细统计 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6">详细统计</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 任务统计 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-4">任务统计</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">总任务数</span>
                <span className="font-medium">{statistics.totalTasks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">已完成</span>
                <span className="font-medium text-green-600">{statistics.completedTasks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">进行中</span>
                <span className="font-medium">
                  {statistics.totalTasks - statistics.completedTasks}
                </span>
              </div>
            </div>
          </div>

          {/* 计划统计 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-4">计划统计</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">总计划数</span>
                <span className="font-medium">{statistics.totalPlans}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">已完成</span>
                <span className="font-medium text-green-600">{statistics.completedPlans}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">进行中</span>
                <span className="font-medium">
                  {statistics.totalPlans - statistics.completedPlans}
                </span>
              </div>
            </div>
          </div>

          {/* 学习内容统计 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-4">学习内容</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">文章阅读</span>
                <span className="font-medium">{statistics.articlesRead}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">考试参与</span>
                <span className="font-medium">{statistics.examsTaken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">平均时长</span>
                <span className="font-medium">
                  {statistics.articlesRead > 0
                    ? formatDuration(Math.round(statistics.totalDuration / statistics.articlesRead))
                    : '0分钟'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 学习趋势图 (占位符) */}
      <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6">学习趋势</h2>
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">📊</div>
          <p>学习趋势图将在此处显示</p>
          <p className="text-sm mt-2">功能开发中，敬请期待...</p>
        </div>
      </div>
    </div>
  );
};

export default LearningStatistics;
