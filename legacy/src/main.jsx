import logger from '@/utils/logger';
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App'
import './index.css'
import './styles/business-theme.css'
import './styles/antd-custom.css'
import { loadRuntimeConfig } from './utils/apiConfig'

// 立即开始加载运行时配置并渲染应用
(async () => {
    try {
        await loadRuntimeConfig();
    } catch (e) {
        logger.error('Failed to pre-load runtime config:', e);
    }

    dayjs.locale('zh-cn')

    ReactDOM.createRoot(document.getElementById('root')).render(
        <ConfigProvider locale={zhCN}>
            <AntdApp>
                <App />
            </AntdApp>
        </ConfigProvider>,
    )
})();
