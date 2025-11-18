import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { qualityAPI } from '../api'; // Assuming qualityAPI is correctly configured

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
    <div className="p-8">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">案例库</h2>
            <p className="text-gray-500 text-sm mt-1">共 {pagination.total} 条案例</p>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              name="search"
              placeholder="搜索案例..."
              value={filters.search}
              onChange={handleFilterChange}
              className="px-4 py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <select
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="px-4 py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部分类</option>
              {/* Add dynamic categories here */}
              <option value="服务态度">服务态度</option>
              <option value="专业能力">专业能力</option>
            </select>
            <select
              name="difficulty"
              value={filters.difficulty}
              onChange={handleFilterChange}
              className="px-4 py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              className="px-4 py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="created_at">最新</option>
              <option value="view_count">最热</option>
              <option value="like_count">最赞</option>
            </select>
            <select
              name="sortOrder"
              value={filters.sortOrder}
              onChange={handleFilterChange}
              className="px-4 py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
            <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              新增案例
            </button>
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              onClick={handleExportCases}
            >
              导出案例数据
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => toast.info('导出功能待实现')} // Placeholder for export
            >
              导出
            </button>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              onClick={() => window.print()} // Browser print functionality
            >
              打印
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-8">暂无案例数据</div>
          ) : (
            cases.map((caseItem) => (
              <div key={caseItem.id} className="bg-primary-50 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{caseItem.title}</h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{caseItem.description}</p>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>分类: {caseItem.category}</span>
                  <span>难度: {caseItem.difficulty_level}</span>
                  <span>
                    <i className="fas fa-eye mr-1"></i> {caseItem.view_count || 0}
                  </span>
                  <span>
                    <i className="fas fa-thumbs-up mr-1"></i> {caseItem.like_count || 0}
                  </span>
                  <span
                    className="cursor-pointer"
                    onClick={() => handleFavoriteToggle(caseItem.id, caseItem.isFavorited)}
                  >
                    <i className={`${caseItem.isFavorited ? 'fas text-yellow-500' : 'far'} fa-star mr-1`}></i>
                  </span>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    className="text-primary-600 hover:text-primary-800 text-sm"
                    onClick={() => {
                      const caseUrl = `${window.location.origin}/case/${caseItem.id}`; // Example URL, adjust as needed
                      navigator.clipboard.writeText(caseUrl);
                      toast.success('案例链接已复制到剪贴板');
                    }}
                  >
                    分享
                  </button>
                  <button
                    className="text-primary-600 hover:text-primary-800 text-sm"
                    onClick={() => {
                      qualityAPI.startLearningCase(caseItem.id, currentUserId); // Record learning start
                      toast.info(`开始学习案例: ${caseItem.title}`);
                      // TODO: Implement actual navigation to CaseDetailPage or open a modal
                    }}
                  >
                    查看详情
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center items-center mt-6 space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 border rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              上一页
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`px-3 py-1 border rounded-lg ${
                  pagination.page === p ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 border rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50"
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
