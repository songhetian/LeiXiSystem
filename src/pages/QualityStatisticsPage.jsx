import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { qualityAPI } from '../api';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const QualityStatisticsPage = () => {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getStatistics();
      setStatistics(response.data.data);
    } catch (error) {
      toast.error('加载质检统计数据失败');
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type) => {
    try {
      let response;
      let filename;
      if (type === 'sessions') {
        response = await qualityAPI.exportSessions();
        filename = 'quality_sessions.csv';
      } else if (type === 'cases') {
        response = await qualityAPI.exportCases();
        filename = 'quality_cases.csv';
      } else {
        toast.error('无效的导出类型');
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success(`${type === 'sessions' ? '质检会话' : '案例数据'}导出成功`);
    } catch (error) {
      toast.error(`导出失败: ${error.response?.data?.message || error.message}`);
      console.error('Error exporting data:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-600 text-xl">加载中...</div>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-xl">暂无统计数据</div>
      </div>
    );
  }

  const statusDistributionData = {
    labels: statistics.statusDistribution.map(s => s.quality_status),
    datasets: [
      {
        label: '会话状态分布',
        data: statistics.statusDistribution.map(s => s.count),
        backgroundColor: ['#4CAF50', '#FFC107', '#2196F3', '#F44336'],
        borderColor: ['#4CAF50', '#FFC107', '#2196F3', '#F44336'],
        borderWidth: 1,
      },
    ],
  };

  const topCustomerServiceData = {
    labels: statistics.topCustomerService.map(cs => cs.customer_service_name),
    datasets: [
      {
        label: '客服平均分',
        data: statistics.topCustomerService.map(cs => cs.average_score),
        backgroundColor: '#36A2EB',
        borderColor: '#36A2EB',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="p-8">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">质检统计分析</h2>
        <div className="flex gap-3 mb-6">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => handleExport('sessions')}
          >
            导出质检会话
          </button>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            onClick={() => handleExport('cases')}
          >
            导出案例数据
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-primary-50 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">总质检会话数</p>
            <p className="text-3xl font-bold text-primary-700">{statistics.totalSessions}</p>
          </div>
          <div className="bg-primary-50 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">平均质检分数</p>
            <p className="text-3xl font-bold text-primary-700">{statistics.averageScore ? statistics.averageScore.toFixed(2) : 'N/A'}</p>
          </div>
          <div className="bg-primary-50 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">待补充指标</p>
            <p className="text-3xl font-bold text-primary-700">...</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-50 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">会话状态分布</h3>
            <div className="h-80">
              <Pie data={statusDistributionData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">客服平均分排名 (Top 5)</h3>
            <div className="h-80">
              <Bar data={topCustomerServiceData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityStatisticsPage;
