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
        Table: { border: { wrapper: true, cell: true }, hover: true, stripe: false },
        Button: { type: 'default', shape: 'square' },
        Tag: { bordered: true },
        Modal: { alignCenter: true },
      }}
      theme={{
        primaryColor: '#165dff',
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
)
