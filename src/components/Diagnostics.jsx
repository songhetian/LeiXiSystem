import React, { useState, useEffect } from 'react';

const Diagnostics = () => {
  const [diagnostics, setDiagnostics] = useState({
    nodeEnv: '',
    platform: '',
    arch: '',
    cwd: '',
    apiBaseUrl: '',
    token: '',
    isConnected: false,
    errorMessage: ''
  });

  useEffect(() => {
    // 获取诊断信息
    const fetchDiagnostics = async () => {
      try {
        // 获取环境信息
        const nodeEnv = process.env.NODE_ENV || 'undefined';
        const platform = window.process?.platform || 'browser';
        const arch = window.process?.arch || 'unknown';
        const cwd = window.process?.cwd?.() || 'unknown';

        // 获取API配置
        let apiBaseUrl = 'unknown';
        let token = localStorage.getItem('token') || 'not found';

        try {
          // 动态导入apiConfig
          const apiConfig = await import('../utils/apiConfig');
          apiBaseUrl = apiConfig.getApiUrl('');
        } catch (e) {
          console.error('Failed to load apiConfig:', e);
        }

        // 测试API连接
        let isConnected = false;
        let errorMessage = '';

        try {
          if (token && token !== 'not found') {
            // 尝试连接API
            const response = await fetch(apiBaseUrl || '/api/health', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            isConnected = response.ok;
          } else {
            errorMessage = 'No auth token found';
          }
        } catch (e) {
          errorMessage = e.message;
        }

        setDiagnostics({
          nodeEnv,
          platform,
          arch,
          cwd,
          apiBaseUrl,
          token: token !== 'not found' ? `${token.substring(0, 10)}...` : 'not found',
          isConnected,
          errorMessage
        });
      } catch (error) {
        console.error('Diagnostics error:', error);
      }
    };

    fetchDiagnostics();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">系统诊断信息</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">环境信息</h2>
          <div className="space-y-3">
            <div>
              <span className="font-medium">NODE_ENV:</span> {diagnostics.nodeEnv}
            </div>
            <div>
              <span className="font-medium">Platform:</span> {diagnostics.platform}
            </div>
            <div>
              <span className="font-medium">Architecture:</span> {diagnostics.arch}
            </div>
            <div>
              <span className="font-medium">Current Directory:</span> {diagnostics.cwd}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">API配置</h2>
          <div className="space-y-3">
            <div>
              <span className="font-medium">API Base URL:</span> {diagnostics.apiBaseUrl}
            </div>
            <div>
              <span className="font-medium">Auth Token:</span> {diagnostics.token}
            </div>
            <div>
              <span className="font-medium">API Connection:</span>
              <span className={diagnostics.isConnected ? 'text-green-600' : 'text-red-600'}>
                {' '}{diagnostics.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {diagnostics.errorMessage && (
              <div>
                <span className="font-medium">Error:</span>
                <span className="text-red-600"> {diagnostics.errorMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">解决方案建议</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>确保后端服务已启动 (运行 <code className="bg-gray-100 px-1 rounded">npm run server</code>)</li>
          <li>检查网络连接是否正常</li>
          <li>确认.env文件配置正确</li>
          <li>如果是在开发模式下运行，请使用 <code className="bg-gray-100 px-1 rounded">npm run dev</code> 命令</li>
          <li>如果是生产模式，请确保所有依赖已正确安装</li>
        </ul>
      </div>
    </div>
  );
};

export default Diagnostics;
