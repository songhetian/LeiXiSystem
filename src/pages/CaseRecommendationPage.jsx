import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { qualityAPI } from '../api';

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
    <div className="p-8">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">案例推荐</h2>

        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">热门案例</h3>
          {hotCases.length === 0 ? (
            <p className="text-gray-500">暂无热门案例</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hotCases.map((caseItem) => (
                <div key={caseItem.id} className="bg-primary-50 rounded-lg p-4 shadow-sm">
                  <h4 className="font-medium text-gray-800">{caseItem.title}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2">{caseItem.description}</p>
                  <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                    <span><i className="fas fa-eye mr-1"></i> {caseItem.view_count || 0}</span>
                    <span><i className="fas fa-thumbs-up mr-1"></i> {caseItem.like_count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-4">为您推荐</h3>
          {recommendedCases.length === 0 ? (
            <p className="text-gray-500">暂无推荐案例</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendedCases.map((caseItem) => (
                <div key={caseItem.id} className="bg-primary-50 rounded-lg p-4 shadow-sm">
                  <h4 className="font-medium text-gray-800">{caseItem.title}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2">{caseItem.description}</p>
                  <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                    <span><i className="fas fa-eye mr-1"></i> {caseItem.view_count || 0}</span>
                    <span><i className="fas fa-thumbs-up mr-1"></i> {caseItem.like_count || 0}</span>
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
