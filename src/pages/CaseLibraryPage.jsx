import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import qualityAPI from '../api/qualityAPI.js';

const CaseLibraryPage = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    difficulty: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  // Placeholder for current user ID
  const currentUserId = 1; // In a real app, get this from auth context or similar

  const handleFavoriteToggle = async (caseId, isFavorited) => {
    try {
      if (isFavorited) {
        await qualityAPI.removeFavoriteCase(caseId, currentUserId);
        toast.success('案例已从收藏中移除');
      } else {
        await qualityAPI.addFavoriteCase(caseId, currentUserId);
        toast.success('案例已添加到收藏');
      }
      // Reload cases to update favorite status
      loadCases();
    } catch (error) {
      toast.error(`操作失败: ${error.response?.data?.message || error.message}`);
      console.error('Error toggling favorite status:', error);
    }
  };

  const handleExportCases = async () => {
    try {
      const response = await qualityAPI.exportCases();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'quality_cases.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success('案例数据导出成功');
    } catch (error) {
      toast.error(`导出失败: ${error.response?.data?.message || error.message}`);
      console.error('Error exporting cases:', error);
    }
  };

  useEffect(() => {
    loadCases();
  }, [pagination.page, pagination.pageSize, filters]); // Reload cases when page, pageSize, or filters change

  const loadCases = async () => {
    try {
      setLoading(true);
      const [casesResponse, favoriteCasesResponse] = await Promise.all([
        qualityAPI.getAllCases({
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...filters,
        }),
        qualityAPI.getUserFavoriteCases(currentUserId, { pageSize: 9999 }) // Fetch all favorites for current user
      ]);

      const favoriteCaseIds = new Set(favoriteCasesResponse.data.data.map(favCase => favCase.id));

      const casesWithFavoriteStatus = casesResponse.data.data.map(caseItem => ({
        ...caseItem,
        isFavorited: favoriteCaseIds.has(caseItem.id)
      }));

      setCases(casesWithFavoriteStatus);
      setPagination(casesResponse.data.pagination);
    } catch (error) {
      toast.error('加载案例库失败');
      console.error('Error loading cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPagination({ ...pagination, page: 1 }); // Reset to first page on filter change
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-primary-600 text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="business-card">
        <div className="business-card-header">
          <div>
            <h2 className="business-card-title">案例库</h2>
            <p className="text-gray-500 text-sm mt-1">共 {pagination.total} 条案例</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              name="search"
              placeholder="搜索案例..."
              value={filters.search}
              onChange={handleFilterChange}
              className="business-input w-48"
            />
            <select
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="business-select w-32"
            >
              <option value="">全部分类</option>
              <option value="服务态度">服务态度</option>
              <option value="专业能力">专业能力</option>
            </select>
            <select
              name="difficulty"
              value={filters.difficulty}
              onChange={handleFilterChange}
              className="business-select w-32"
            >
              <option value="">全部难度</option>
              <option value="简单">简单</option>
              <option value="中等">中等</option>
              <option value="困难">困难</option>
            </select>
            <select
              name="sortBy"
              value={filters.sortBy}
              onChange={handleFilterChange}
              className="business-select w-32"
            >
              <option value="created_at">最新</option>
              <option value="view_count">最热</option>
              <option value="like_count">最赞</option>
            </select>
            <select
              name="sortOrder"
              value={filters.sortOrder}
              onChange={handleFilterChange}
              className="business-select w-32"
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
            <button className="business-btn business-btn-primary">
              新增案例
            </button>
            <button
              className="business-btn business-btn-secondary"
              onClick={handleExportCases}
            >
              导出数据
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-8">暂无案例数据</div>
          ) : (
            cases.map((caseItem) => (
              <div key={caseItem.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-all duration-200 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-800 line-clamp-1" title={caseItem.title}>{caseItem.title}</h3>
                  <span
                    className="cursor-pointer p-1 hover:bg-gray-100 rounded-full transition-colors"
                    onClick={() => handleFavoriteToggle(caseItem.id, caseItem.isFavorited)}
                  >
                    <i className={`${caseItem.isFavorited ? 'fas text-yellow-500' : 'far text-gray-400'} fa-star`}></i>
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-4 line-clamp-3 flex-grow">{caseItem.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-md border border-primary-100">
                    {caseItem.category}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-md border ${caseItem.difficulty_level === '简单' ? 'bg-green-50 text-green-700 border-green-100' :
                      caseItem.difficulty_level === '中等' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                        'bg-red-50 text-red-700 border-red-100'
                    }`}>
                    {caseItem.difficulty_level}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-100 text-xs text-gray-500">
                  <div className="flex gap-3">
                    <span><i className="fas fa-eye mr-1"></i>{caseItem.view_count || 0}</span>
                    <span><i className="fas fa-thumbs-up mr-1"></i>{caseItem.like_count || 0}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-primary-600 hover:text-primary-800 font-medium transition-colors"
                      onClick={() => {
                        const caseUrl = `${window.location.origin}/case/${caseItem.id}`;
                        navigator.clipboard.writeText(caseUrl);
                        toast.success('链接已复制');
                      }}
                    >
                      分享
                    </button>
                    <button
                      className="text-primary-600 hover:text-primary-800 font-medium transition-colors"
                      onClick={() => {
                        qualityAPI.startLearningCase(caseItem.id, currentUserId);
                        toast.info(`开始学习: ${caseItem.title}`);
                      }}
                    >
                      详情
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center items-center mt-8 space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="business-btn business-btn-secondary business-btn-sm"
            >
              上一页
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`business-btn business-btn-sm ${pagination.page === p ? 'business-btn-primary' : 'business-btn-secondary'
                  }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="business-btn business-btn-secondary business-btn-sm"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseLibraryPage;
