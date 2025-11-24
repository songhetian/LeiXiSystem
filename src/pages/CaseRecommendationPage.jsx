import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import qualityAPI from '../api/qualityAPI.js';

const CaseRecommendationPage = () => {
  const [recommendedCases, setRecommendedCases] = useState([]);
  const [hotCases, setHotCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendedCases();
    loadHotCases();
  }, []);

  const loadRecommendedCases = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getRecommendedCases({ limit: 5 }); // Fetch top 5 recommended
      setRecommendedCases(response.data.data);
    } catch (error) {
      toast.error('加载推荐案例失败');
      console.error('Error loading recommended cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHotCases = async () => {
    try {
      setLoading(true);
      const response = await qualityAPI.getHotCases({ limit: 5 }); // Fetch top 5 hot cases
      setHotCases(response.data.data);
    } catch (error) {
      toast.error('加载热门案例失败');
      console.error('Error loading hot cases:', error);
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

  return (
    <div className="p-6">
      <div className="business-card">
        <div className="business-card-header mb-6">
          <h2 className="business-card-title">案例推荐</h2>
        </div>

        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="w-1 h-6 bg-red-500 rounded-full mr-3"></div>
            <h3 className="text-xl font-semibold text-gray-800">热门案例</h3>
          </div>

          {hotCases.length === 0 ? (
            <p className="text-gray-500 py-4 text-center bg-gray-50 rounded-lg">暂无热门案例</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hotCases.map((caseItem) => (
                <div key={caseItem.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-all duration-200 flex flex-col h-full group">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-800 line-clamp-1 group-hover:text-primary-600 transition-colors">{caseItem.title}</h4>
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">HOT</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-grow">{caseItem.description}</p>
                  <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-gray-100">
                    <div className="flex gap-3">
                      <span><i className="fas fa-eye mr-1"></i> {caseItem.view_count || 0}</span>
                      <span><i className="fas fa-thumbs-up mr-1"></i> {caseItem.like_count || 0}</span>
                    </div>
                    <button className="text-primary-600 hover:text-primary-800 font-medium">查看详情</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center mb-4">
            <div className="w-1 h-6 bg-primary-500 rounded-full mr-3"></div>
            <h3 className="text-xl font-semibold text-gray-800">为您推荐</h3>
          </div>

          {recommendedCases.length === 0 ? (
            <p className="text-gray-500 py-4 text-center bg-gray-50 rounded-lg">暂无推荐案例</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedCases.map((caseItem) => (
                <div key={caseItem.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-all duration-200 flex flex-col h-full group">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-800 line-clamp-1 group-hover:text-primary-600 transition-colors">{caseItem.title}</h4>
                    <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">推荐</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-grow">{caseItem.description}</p>
                  <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-gray-100">
                    <div className="flex gap-3">
                      <span><i className="fas fa-eye mr-1"></i> {caseItem.view_count || 0}</span>
                      <span><i className="fas fa-thumbs-up mr-1"></i> {caseItem.like_count || 0}</span>
                    </div>
                    <button className="text-primary-600 hover:text-primary-800 font-medium">查看详情</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseRecommendationPage;
