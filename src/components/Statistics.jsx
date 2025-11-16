import React, { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'
import { getApiUrl } from '../utils/apiConfig'


const Statistics = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchStatistics()
  }, [dateRange])

  const fetchStatistics = async () => {
    setLoading(true)
    try {
      const params = { range: dateRange }
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const response = await axios.get(getApiUrl('/api/statistics'), { params })
      setStats(response.data)
    } catch (error) {
      toast.error('获取统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">数据统计</h1>
        <p className="text-gray-600 mt-1">系统运营数据统计分析</p>
      </div>

      {/* 时间范围选择 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4 items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange('today')}
              className={`px-4 py-2 rounded-lg ${dateRange === 'today' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              今日
            </button>
            <button
              onClick={() => setDateRange('week')}
              className={`px-4 py-2 rounded-lg ${dateRange === 'week' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              本周
            </button>
            <button
              onClick={() => setDateRange('month')}
              className={`px-4 py-2 rounded-lg ${dateRange === 'month' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              本月
            </button>
            <button
              onClick={() => setDateRange('year')}
              className={`px-4 py-2 rounded-lg ${dateRange === 'year' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              本年
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <span>至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={fetchStatistics}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              查询
            </button>
          </div>
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600">员工总数</span>
            <span className="text-2xl">👥</span>
          </div>
          <div className="text-3xl font-bold text-gray-800">{stats.employees.total}</div>
          <div className="text-sm text-gray-500 mt-2">
            在职 {stats.employees.active} | 离职 {stats.employees.inactive}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600">部门数量</span>
            <span className="text-2xl">🏢</span>
          </div>
          <div className="text-3xl font-bold text-gray-800">{stats.departments.total}</div>
          <div className="text-sm text-gray-500 mt-2">
            活跃 {stats.departments.active}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600">知识文章</span>
            <span className="text-2xl">📚</span>
          </div>
          <div className="text-3xl font-bold text-gray-800">{stats.knowledge.total}</div>
    <div className="text-sm text-gray-500 mt-2">
            已发布 {stats.knowledge.published}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600">考试试卷</span>
            <span className="text-2xl">📝</span>
          </div>
          <div className="text-3xl font-bold text-gray-800">{stats.exams.total}</div>
          <div className="text-sm text-gray-500 mt-2">
            已发布 {stats.exams.published}
          </div>
        </div>
      </div>

      {/* 考勤统计 */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">考勤统计</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-gray-700">正常出勤</span>
              <span className="text-xl font-bold text-green-600">{stats.attendance.normal}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
              <span className="text-gray-700">迟到</span>
              <span className="text-xl font-bold text-yellow-600">{stats.attendance.late}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="text-gray-700">缺勤</span>
              <span className="text-xl font-bold text-red-600">{stats.attendance.absent}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-gray-700">请假</span>
              <span className="text-xl font-bold text-blue-600">{stats.attendance.leave}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">质检统计</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">待质检</span>
              <span className="text-xl font-bold text-gray-600">{stats.quality.pending}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-gray-700">质检中</span>
              <span className="text-xl font-bold text-blue-600">{stats.quality.in_review}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-gray-700">已完成</span>
              <span className="text-xl font-bold text-green-600">{stats.quality.completed}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-primary-50 rounded-lg">
              <span className="text-gray-700">平均分</span>
              <span className="text-xl font-bold text-primary-600">{stats.quality.avg_score}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 部门员工分布 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">部门员工分布</h3>
        <div className="space-y-3">
          {stats.departmentDistribution.map((dept) => (
            <div key={dept.id} className="flex items-center gap-4">
              <div className="w-32 text-gray-700">{dept.name}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                <div
                  className="bg-primary-500 h-8 rounded-full flex items-center justify-end px-3 text-white text-sm font-medium"
                  style={{ width: `${(dept.count / stats.employees.total) * 100}%` }}
                >
                  {dept.count}人
                </div>
              </div>
              <div className="w-16 text-right text-gray-600">
                {((dept.count / stats.employees.total) * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 考核统计 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">考核统计</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{stats.assessment.total_exams}</div>
            <div className="text-sm text-gray-600 mt-1">考试总数</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.assessment.passed}</div>
            <div className="text-sm text-gray-600 mt-1">通过人数</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.assessment.failed}</div>
            <div className="text-sm text-gray-600 mt-1">未通过人数</div>
          </div>
          <div className="text-center p-4 bg-primary-50 rounded-lg">
            <div className="text-2xl font-bold text-primary-600">{stats.assessment.pass_rate}%</div>
            <div className="text-sm text-gray-600 mt-1">通过率</div>
          </div>
        </div>
      </div>

      {/* 知识库统计 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">知识库热门文章 Top 10</h3>
        <div className="space-y-2">
          {stats.topArticles.map((article, index) => (
            <div key={article.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                index < 3 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{article.title}</div>
                <div className="text-sm text-gray-500">{article.category_name || '未分类'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">👁️ {article.view_count}</div>
                <div className="text-sm text-gray-600">❤️ {article.like_count}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Statistics
