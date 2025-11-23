import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../utils/apiConfig';

const DatabaseCheck = ({ children }) => {
  const [dbStatus, setDbStatus] = useState('checking'); // checking, connected, error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const checkDatabaseConnection = async () => {
      try {
        // 获取API URL并打印到控制台，便于调试
        const healthUrl = getApiUrl('/api/health');
        console.log('Checking database connection at:', healthUrl);

        // 检查服务器是否可访问
        const response = await fetch(healthUrl, {
          method: 'GET',
          timeout: 5000 // 5秒超时
        });

        console.log('Health check response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('Health check response data:', data);

          // 检查数据库连接状态
          if (data.database === 'connected' && data.dbTest === true) {
            setDbStatus('connected');
          } else if (data.database === 'not initialized') {
            setDbStatus('error');
            setErrorMessage('后端服务正在初始化，请稍后刷新页面');
          } else if (data.database === 'disconnected') {
            setDbStatus('error');
            setErrorMessage('数据库连接失败: ' + (data.error || '未知错误'));
          } else {
            // 兼容旧版本的健康检查响应
            setDbStatus('connected');
          }
        } else {
          throw new Error(`Server health check failed with status ${response.status}`);
        }
      } catch (error) {
        console.error('Database connection check failed:', error);
        setDbStatus('error');
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          setErrorMessage('无法连接到后端服务。请确保：\n1. 已复制整个项目文件夹\n2. 在项目根目录运行了 "npm run server"\n3. 网络连接正常');
        } else {
          setErrorMessage('后端服务连接异常: ' + error.message);
        }
      }
    };

    checkDatabaseConnection();
  }, []);

  if (dbStatus === 'checking') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">正在检查数据库连接...</p>
        </div>
      </div>
    );
  }

  if (dbStatus === 'error') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">数据库连接失败</h3>
            <div className="text-left bg-red-50 p-4 rounded-lg mb-4">
              <p className="text-red-700 whitespace-pre-line">{errorMessage}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-left">
              <h4 className="font-medium text-yellow-800 mb-2">解决方法：</h4>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-yellow-700">
                <li>确保已复制整个项目文件夹，而不仅仅是exe文件</li>
                <li>在项目根目录打开终端，运行命令：<br/>
                  <code className="bg-gray-100 px-2 py-1 rounded mt-1 block">npm run server</code>
                </li>
                <li>等待后端服务启动完成（显示"Server listening"）</li>
                <li>刷新当前页面或重新启动应用</li>
              </ol>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              重新检查连接
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 如果数据库连接正常，渲染子组件
  return children;
};

export default DatabaseCheck;
