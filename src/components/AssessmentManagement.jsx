import React, { useState } from 'react';
import ExamManagement from './ExamManagement';
import AssessmentPlanManagement from './AssessmentPlanManagement';
import CategoryManagement from './CategoryManagement';
import ExamResultsManagement from './ExamResultsManagement';
// 拖拽组卷功能已移除，创建试卷在试卷管理中进行

const ComingSoon = ({ title }) => (
  <div className="p-8 text-center">
    <h1 className="text-3xl font-bold text-gray-700">{title}</h1>
    <p className="text-gray-500 mt-2">此功能正在开发中，敬请期待！</p>
  </div>
);

function AssessmentManagement() {
  const [activeSubTab, setActiveSubTab] = useState('exams');

  const renderContent = () => {
    switch (activeSubTab) {
      case 'exams':
        return <ExamManagement />;
      case 'plans':
        return <AssessmentPlanManagement />;
      case 'categories':
        return <CategoryManagement />;
      case 'results':
        return <ExamResultsManagement />;
      case 'drag-drop-builder':
        return <ExamManagement />;
      default:
        return <ExamManagement />;
    }
  };

  return (
    <div className="p-8">
      <div className="bg-white rounded-xl shadow-md">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveSubTab('exams')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeSubTab === 'exams'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              试卷管理
            </button>
            <button
              onClick={() => setActiveSubTab('plans')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeSubTab === 'plans'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              考核计划
            </button>
            <button
              onClick={() => setActiveSubTab('categories')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeSubTab === 'categories'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              分类管理
            </button>
            <button
              onClick={() => setActiveSubTab('results')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeSubTab === 'results'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              考试结果
            </button>
            {/* 拖拽组卷标签已移除 */}
          </nav>
        </div>
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default AssessmentManagement;
