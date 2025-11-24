import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import qualityAPI from '../api/qualityAPI.js';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const QualityReportPage = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getSummaryReport();
      setReportData(response.data.data);
    } catch (error) {
      toast.error('加载质检报告失败');
      console.error('Error loading quality report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-600 text-xl">加载中...</div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-xl">暂无报告数据</div>
      </div>
    );
  }

  // Chart data for status distribution
  const statusDistributionChartData = {
    labels: reportData.statusDistribution.map(s => s.quality_status),
    datasets: [
      {
        label: '会话状态分布',
        data: reportData.statusDistribution.map(s => s.count),
        backgroundColor: ['#4CAF50', '#FFC107', '#2196F3', '#F44336'],
        borderColor: ['#4CAF50', '#FFC107', '#2196F3', '#F44336'],
        borderWidth: 1,
      },
    ],
  };

  // Chart data for top customer service
  const topCustomerServiceChartData = {
    labels: reportData.topCustomerService.map(cs => cs.customer_service_name),
    datasets: [
      {
        label: '客服平均分',
        data: reportData.topCustomerService.map(cs => cs.average_score),
        backgroundColor: '#36A2EB',
        borderColor: '#36A2EB',
        borderWidth: 1,
      },
    ],
  };

  // Chart data for rule compliance
  const ruleComplianceChartData = {
    labels: reportData.ruleCompliance.map(rc => rc.rule_name),
    datasets: [
      {
        label: '平均规则分数',
        data: reportData.ruleCompliance.map(rc => rc.average_rule_score),
        backgroundColor: '#FF6384',
        borderColor: '#FF6384',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="p-8">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">质检综合报告</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-primary-50 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">总质检会话数</p>
            <p className="text-3xl font-bold text-primary-700">{reportData.totalSessions}</p>
          </div>
          <div className="bg-primary-50 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">平均质检分数</p>
            <p className="text-3xl font-bold text-primary-700">{reportData.averageScore ? reportData.averageScore.toFixed(2) : 'N/A'}</p>
          </div>
          <div className="bg-primary-50 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500">规则覆盖率 (示例)</p>
            <p className="text-3xl font-bold text-primary-700">{(reportData.ruleCompliance.length / reportData.totalRules) * 100 || 0}%</p> {/* Assuming totalRules is available */}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-50 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">会话状态分布</h3>
            <div className="h-80">
              <Pie data={statusDistributionChartData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">客服平均分排名 (Top 5)</h3>
            <div className="h-80">
              <Bar data={topCustomerServiceChartData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-50 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">规则合规性分析</h3>
            <div className="h-80">
              <Bar data={ruleComplianceChartData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">最受欢迎案例 (Top 5)</h3>
            <ul className="list-disc pl-5">
              {reportData.mostViewedCases.map(c => (
                <li key={c.id} className="text-gray-700">{c.title} (浏览: {c.view_count})</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">最受好评案例 (Top 5)</h3>
          <ul className="list-disc pl-5">
            {reportData.mostLikedCases.map(c => (
              <li key={c.id} className="text-gray-700">{c.title} (点赞: {c.like_count})</li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};

export default QualityReportPage;
