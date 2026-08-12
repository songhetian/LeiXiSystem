import logger from '@/utils/logger';
import React from 'react'
import { Result, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

/**
 * 错误边界组件 - 旗舰纯净版
 * 仅显示业务提示，严禁泄露任何技术详情
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    logger.error('🔥 [ErrorBoundary] 捕获到运行时错误');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl p-12 border border-slate-100 animate-in zoom-in duration-300">
            <Result
              status="error"
              title={<span className="text-2xl font-black text-slate-800 tracking-tight">系统运行出现异常</span>}
              subTitle={<span className="text-slate-500 font-bold">由于网络波动或数据同步延迟，页面加载受阻。请尝试刷新。</span>}
              extra={[
                <Button 
                  type="primary" 
                  key="retry" 
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={() => window.location.reload()}
                  className="rounded-xl bg-slate-900 h-12 px-10 font-black border-none shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                >
                  立即刷新页面
                </Button>
              ]}
            />
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
