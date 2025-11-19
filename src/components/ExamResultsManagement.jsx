import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import debounce from 'lodash.debounce';

const ExamResultsManagement = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // e.g., 'passed', 'failed'
  const [filterExam, setFilterExam] = useState(''); // filter by exam ID
  const [availableExams, setAvailableExams] = useState([]); // for exam filter dropdown

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchResults();
    fetchAvailableExams();
  }, []);

  const filteredResults = useMemo(() => {
    if (!Array.isArray(results)) return [];
    return results.filter(result => {
      const matchesSearch =
        result.exam_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.user_real_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.user_employee_no?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === '' ||
        (filterStatus === 'passed' && result.passed) ||
        (filterStatus === 'failed' && !result.passed);

      const matchesExam = filterExam === '' || result.exam_id === parseInt(filterExam);

      return matchesSearch && matchesStatus && matchesExam;
    });
  }, [results, searchTerm, filterStatus, filterExam]);

  useEffect(() => {
    if (filteredResults) {
      setTotalPages(Math.ceil(filteredResults.length / pageSize));
      setCurrentPage(1); // Reset to first page on filter change
    }
  }, [filteredResults, pageSize]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await api.get('/assessment-results');
      // Handle response structure: { success: true, data: { results: [...] } } or { success: true, data: [...] }
      const resultsData = response.data?.data?.results || response.data?.data || [];
      setResults(Array.isArray(resultsData) ? resultsData : []);
    } catch (error) {
      console.error('获取考试结果失败:', error);
      toast.error('获取考试结果列表失败');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableExams = async () => {
    try {
      const response = await api.get('/exams');
      // Handle response structure: { success: true, data: { exams: [...] } }
      const exams = response.data?.data?.exams || response.data?.data || [];
      setAvailableExams(Array.isArray(exams) ? exams : []);
    } catch (error) {
      console.error('获取可用试卷失败:', error);
      toast.error('获取可用试卷列表失败');
      setAvailableExams([]);
    }
  };

  const getResultStatusBadge = (passed) => {
    return passed
      ? <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">通过</span>
      : <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">未通过</span>;
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredResults.slice(startIndex, endIndex);
  };

  // Debounced search handler
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className="p-0">
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">考试结果管理</h2>
            <p className="text-gray-500 text-sm mt-1">共 {filteredResults.length} 份考试结果</p>
          </div>
        </div>

        {/* 搜索筛选区 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg flex gap-4">
          <input
            type="text"
            placeholder="按试卷标题、考生姓名、工号搜索..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          >
            <option value="">所有状态</option>
            <option value="passed">通过</option>
            <option value="failed">未通过</option>
          </select>
          <select
            value={filterExam}
            onChange={(e) => setFilterExam(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          >
            <option value="">所有试卷</option>
            {availableExams.map(exam => (
              <option key={exam.id} value={exam.id}>{exam.title}</option>
            ))}
          </select>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider rounded-tl-lg">试卷标题</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">考生</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">得分</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">总分</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">提交时间</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider rounded-tr-lg">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <p className="mt-2 text-gray-600">加载中...</p>
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    暂无考试结果
                  </td>
                </tr>
              ) : (
                getCurrentPageData().map((result, index) => (
                  <tr key={result.id} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-primary-50/30'} hover:bg-primary-100/50 transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{result.exam_title}</div>
                      <div className="text-xs text-gray-500">{result.plan_title}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{result.user_real_name}</div>
                      <div className="text-xs text-gray-500">{result.user_employee_no}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{result.score}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{result.total_score}</td>
                    <td className="px-4 py-3 text-center">{getResultStatusBadge(result.passed)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{new Date(result.submitted_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => alert(`查看结果详情: ${result.id}`)} // TODO: Implement view result detail logic
                          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          查看详情
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 分页组件 */}
        {filteredResults.length > 0 && (
          <div className="mt-4 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">每页显示</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-gray-600">条</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">
                第 {currentPage} / {totalPages} 页
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamResultsManagement;
