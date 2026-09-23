import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
      logger.error('Error loading statistics:', error);
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
      logger.error('Error exporting data:', error);
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
    labels: statistics.statusDistribution.map(s => s.quality_status === 'completed' ? '已完成' : '待处理'),
    datasets: [
      {
        label: '会话状态分布',
        data: statistics.statusDistribution.map(s => s.count),
        backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'],
        borderColor: ['#ffffff'],
        borderWidth: 2,
      },
    ],
  };

  const topCustomerServiceData = {
    labels: statistics.topCustomerService.map(cs => cs.customer_service_name),
    datasets: [
      {
        label: '客服平均得分',
        data: statistics.topCustomerService.map(cs => cs.average_score),
        backgroundColor: '#6366f1',
        borderRadius: 8,
      },
    ],
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50/50 min-h-full">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">质检效能看板</h2>
            <p className="text-slate-500 text-sm mt-1">实时监测服务质量与质检进度</p>
          </div>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
              onClick={() => handleExport('sessions')}
            >
              导出质检清单
            </button>
            <button
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-md shadow-slate-200"
              onClick={() => handleExport('cases')}
            >
              导出案例库
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">总质检量</p>
              <p className="text-4xl font-black text-slate-900 mt-2">{statistics.totalSessions}</p>
            </div>
            <MessageSquare className="absolute -right-4 -bottom-4 text-slate-50 w-24 h-24" />
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">平均得分</p>
              <p className="text-4xl font-black text-indigo-600 mt-2">{statistics.averageScore ? statistics.averageScore.toFixed(1) : '0.0'}</p>
            </div>
            <Star className="absolute -right-4 -bottom-4 text-slate-50 w-24 h-24" />
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">质检覆盖率</p>
              <p className="text-4xl font-black text-emerald-600 mt-2">100%</p>
            </div>
            <CheckCircle2 className="absolute -right-4 -bottom-4 text-slate-50 w-24 h-24" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-8 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              会话处理状态分布
            </h3>
            <div className="h-72">
              <Pie data={statusDistributionData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } } }} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-8 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              优秀客服排行榜
            </h3>
            <div className="h-72">
              <Bar data={topCustomerServiceData} options={{ maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, max: 100 } } }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityStatisticsPage;
