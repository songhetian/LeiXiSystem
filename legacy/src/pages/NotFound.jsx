import React from 'react';
import { Button, Result } from 'antd';
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const NotFound = ({ onBack }) => {
  return (
    <div className="h-full flex items-center justify-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-300 m-4">
      <Result
        status="404"
        title={<span className="text-3xl font-black text-slate-800">404</span>}
        subTitle={<span className="text-slate-500 font-medium">抱歉，您访问的页面已前往外太空或尚未开发...</span>}
        extra={
          <div className="flex gap-4 justify-center mt-4">
            <Button 
              icon={<ArrowLeftOutlined />} 
              size="large"
              onClick={() => window.history.back()}
              className="rounded-xl border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-600 transition-all"
            >
              返回上一页
            </Button>
            <Button 
              type="primary" 
              icon={<HomeOutlined />} 
              size="large"
              onClick={() => onBack && onBack('dashboard')}
              className="rounded-xl bg-blue-600 shadow-lg shadow-blue-200 hover:scale-105 transition-all"
            >
              回控制面板
            </Button>
          </div>
        }
      />
    </div>
  );
};

export default NotFound;
