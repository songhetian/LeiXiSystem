import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import { getApiUrl } from '../utils/apiConfig';
import debounce from 'lodash.debounce';

const MyExamList = ({ onStartExam, onViewResult }) => {
  const [myExams, setMyExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchMyExams();
  }, []);

  const filteredMyExams = useMemo(() => {
    if (!Array.isArray(myExams)) return [];
    return myExams.filter(exam =>
      exam.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [myExams, searchTerm]);

  useEffect(() => {
    if (filteredMyExams) {
      setTotalPages(Math.ceil(filteredMyExams.length / pageSize));
      setCurrentPage(1); // Reset to first page on filter change
    }
  }, [filteredMyExams, pageSize]);

  const fetchMyExams = async () => {
    setLoading(true);
    try {
      const response = await api.get('/my-exams');
      // Handle response structure: { success: true, data: { exams: [...] } }
      const examsData = response.data?.data?.exams || response.data?.data || [];
      setMyExams(Array.isArray(examsData) ? examsData : []);
    } catch (error) {
      console.error('获取我的考试列表失败:', error);
      toast.error('获取我的考试列表失败');
      setMyExams([]);
    } finally {
      setLoading(false);
    }
  };

  const getExamStatusBadge = (status) => {
    const badges = {
      not_started: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      expired: 'bg-red-100 text-red-700',
    };
    const labels = {
      not_started: '未开始',
      in_progress: '进行中',
      completed: '已完成',
      expired: '已过期',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${badges[status]}`}>
        {labels[status]}
      </span>
    );
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
    return filteredMyExams.slice(startIndex, endIndex);
  };

  // Debounced search handler
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">我的考试</h2>
            <p className="text-gray-500 text-sm mt-1">共 {filteredMyExams.length} 场考试</p>
          </div>
        </div>

        {/* 搜索筛选区 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <input
            type="text"
            placeholder="按考试标题、描述、分类搜索..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* 考试列表 */}
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider rounded-tl-lg">考试标题</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">分类</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">时长</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">总分</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">及格分</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">状态</th>
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
              ) : filteredMyExams.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    暂无考试
                  </td>
                </tr>
              ) : (
                getCurrentPageData().map((exam, index) => (
                  <tr key={exam.id} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-primary-50/30'} hover:bg-primary-100/50 transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{exam.title}</div>
                      <div className="text-xs text-gray-500">{exam.description}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{exam.category || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{exam.duration}分钟</td>
                    <td className="px-4 py-3 text-center text-gray-600">{exam.total_score}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{exam.pass_score}</td>
                    <td className="px-4 py-3 text-center">{getExamStatusBadge(exam.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {exam.status === 'not_started' && (
                          <button
                            onClick={() => onStartExam(exam.id, exam.plan_id)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 whitespace-nowrap shadow-md hover:shadow-lg"
                          >
                            开始考试
                          </button>
                        )}
                        {exam.status === 'in_progress' && (
                          <button
                            onClick={() => alert(`继续考试: ${exam.title}`)} // TODO: Implement continue exam logic
                            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 whitespace-nowrap shadow-md hover:shadow-lg"
                          >
                            继续考试
                          </button>
                        )}
                        {exam.status === 'completed' && (
                          <button
                            onClick={() => onViewResult(exam.result_id)}
                            className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            查看结果
                          </button>
                        )}
                        {exam.status === 'expired' && (
                          <span className="px-3 py-1.5 text-sm font-medium text-gray-500 bg-gray-50 rounded-lg whitespace-nowrap">
                            已过期
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 分页组件 */}
        {filteredMyExams.length > 0 && (
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

export default MyExamList;
