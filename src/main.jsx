import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App'
import './index.css'
import './styles/business-theme.css'
import './styles/antd-custom.css'
import { loadRuntimeConfig } from './utils/apiConfig'

// 立即开始加载运行时配置
loadRuntimeConfig();

dayjs.locale('zh-cn')

ReactDOM.createRoot(document.getElementById('root')).render(
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>,
)
