import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from '@arco-design/web-react'
import zhCN from '@arco-design/web-react/es/locale/zh-CN'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import '@arco-design/web-react/dist/css/arco.css'
import './styles/design-tokens.css'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      componentConfig={{
        Card: { bordered: false },
        Table: { border: { wrapper: true, cell: false }, hover: true, stripe: false },
        Button: { type: 'default', shape: 'round' },
        Tag: { bordered: true },
        Modal: { alignCenter: true },
        Input: { size: 'default' },
        Select: { size: 'default' },
      }}
      theme={{
        primaryColor: '#10B981',
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
)
