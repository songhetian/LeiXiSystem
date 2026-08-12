import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import qualityAPI from '../api/qualityAPI.js';

const CaseRecommendationPage = () => {
  const [recommendedCases, setRecommendedCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 12, // 3列 x 4行
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    loadRecommendedCases();
  }, [pagination.page]);

  const loadRecommendedCases = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getRecommendedCases({
        page: pagination.page,
        pageSize: pagination.pageSize,
      });

      // 如果后端返回分页信息，使用它；否则使用简单的数据
      if (response.data.pagination) {
        setRecommendedCases(response.data.data);
        setPagination(response.data.pagination);
      } else {
        setRecommendedCases(response.data.data || []);
      }
    } catch (error) {
      toast.error('加载推荐案例失败');
      logger.error('Error loading recommended cases:', error);
    } finally {
      setLoading(false);
    }
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
            <h2 className="business-card-title">案例推荐</h2>
            <p className="text-gray-500 text-sm mt-1">
              为您精选优质案例 {pagination.total > 0 && `（共 ${pagination.total} 个）`}
            </p>
          </div>
        </div>

        {recommendedCases.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-gray-300 text-6xl mb-4"></i>
            <p className="text-gray-500 text-lg">暂无推荐案例</p>
            <p className="text-gray-400 text-sm mt-2">收藏一些案例后，系统会为您推荐相关内容</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-all duration-200 flex flex-col h-full group cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 line-clamp-2 group-hover:text-primary-600 transition-colors flex-1">
                      {caseItem.title}
                    </h3>
                    <span className="ml-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs px-2 py-1 rounded-full flex-shrink-0">
                      推荐
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-grow">
                    {caseItem.problem_description || caseItem.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {caseItem.category && (
                      <span className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-md border border-primary-100">
                        {caseItem.category}
                      </span>
                    )}
                    {caseItem.difficulty_level && (
                      <span
                        className={`px-2 py-1 text-xs rounded-md border ${
                          caseItem.difficulty_level === 'easy'
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : caseItem.difficulty_level === 'medium'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                            : 'bg-red-50 text-red-700 border-red-100'
                        }`}
                      >
                        {caseItem.difficulty_level === 'easy'
                          ? '简单'
                          : caseItem.difficulty_level === 'medium'
                          ? '中等'
                          : '困难'}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-100 text-xs text-gray-500">
                    <div className="flex gap-3">
                      <span>
                        <i className="fas fa-eye mr-1"></i>
                        {caseItem.view_count || 0}
                      </span>
                      <span>
                        <i className="fas fa-thumbs-up mr-1"></i>
                        {caseItem.like_count || 0}
                      </span>
                      <span>
                        <i className="fas fa-star mr-1"></i>
                        {caseItem.collect_count || 0}
                      </span>
                    </div>
                    <button className="text-primary-600 hover:text-primary-800 font-medium transition-colors">
                      查看详情 →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center mt-8 space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="business-btn business-btn-secondary business-btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                {Array.from({ length: Math.min(pagination.totalPages, 10) }, (_, i) => {
                  // 显示当前页附近的页码
                  const pageNum = i + 1;
                  const currentPage = pagination.page;
                  const totalPages = pagination.totalPages;

                  // 始终显示第一页、最后一页和当前页附近的页码
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`business-btn business-btn-sm ${
                          pagination.page === pageNum
                            ? 'business-btn-primary'
                            : 'business-btn-secondary'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (
                    (pageNum === currentPage - 3 && currentPage > 4) ||
                    (pageNum === currentPage + 3 && currentPage < totalPages - 3)
                  ) {
                    return <span key={pageNum} className="px-2">...</span>;
                  }
                  return null;
                })}
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="business-btn business-btn-secondary business-btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CaseRecommendationPage;
