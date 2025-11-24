import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import qualityAPI from '../api/qualityAPI.js';
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
        backgroundColor: ['#22c55e', '#eab308', '#3b82f6', '#ef4444'],
        borderColor: ['#22c55e', '#eab308', '#3b82f6', '#ef4444'],
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
        backgroundColor: '#0ea5e9',
        borderColor: '#0ea5e9',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="p-6">
      <div className="business-card">
        <div className="business-card-header">
          <h2 className="business-card-title">质检统计分析</h2>
          <div className="flex gap-3">
            <button
              className="business-btn business-btn-primary"
              onClick={() => handleExport('sessions')}
            >
              导出质检会话
            </button>
            <button
              className="business-btn business-btn-success"
              onClick={() => handleExport('cases')}
            >
              导出案例数据
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-primary-50 rounded-lg p-6 border border-primary-100 shadow-sm">
            <p className="text-sm text-primary-600 font-medium uppercase tracking-wider">总质检会话数</p>
            <p className="text-4xl font-bold text-primary-800 mt-2">{statistics.totalSessions}</p>
          </div>
          <div className="bg-primary-50 rounded-lg p-6 border border-primary-100 shadow-sm">
            <p className="text-sm text-primary-600 font-medium uppercase tracking-wider">平均质检分数</p>
            <p className="text-4xl font-bold text-primary-800 mt-2">{statistics.averageScore ? statistics.averageScore.toFixed(2) : 'N/A'}</p>
          </div>
          <div className="bg-primary-50 rounded-lg p-6 border border-primary-100 shadow-sm">
            <p className="text-sm text-primary-600 font-medium uppercase tracking-wider">待补充指标</p>
            <p className="text-4xl font-bold text-primary-800 mt-2">...</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">会话状态分布</h3>
            <div className="h-80">
              <Pie data={statusDistributionData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">客服平均分排名 (Top 5)</h3>
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
