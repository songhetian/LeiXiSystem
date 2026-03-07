import logger from '@/utils/logger';
import React from 'react'
import { Result, Button, Collapse } from 'antd'
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons'

const { Panel } = Collapse;

/**
 * 错误边界组件 - 旗舰版 Result 风格
 * 捕获子组件中的 JavaScript 错误并展示降级 UI
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    logger.error('🔥 [ErrorBoundary] 捕获到运行时错误:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
          <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl shadow-slate-200/50 p-8 border border-slate-100">
            <Result
              status="error"
              title={<span className="text-2xl font-black text-slate-800">系统遇到了一些小故障</span>}
              subTitle={<span className="text-slate-500">别担心，这通常是临时的。您可以尝试重新加载页面。</span>}
              extra={[
                <Button 
                  type="primary" 
                  key="retry" 
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={() => window.location.reload()}
                  className="rounded-xl bg-blue-600 h-12 px-8"
                >
                  刷新页面
                </Button>,
                <Button 
                  key="home" 
                  size="large"
                  icon={<HomeOutlined />}
                  onClick={() => {
                    this.handleReset();
                    window.location.href = '/';
                  }}
                  className="rounded-xl h-12 px-8 border-slate-300"
                >
                  返回首页
                </Button>,
              ]}
            >
              <div className="mt-6 text-left">
                <Collapse ghost className="border border-slate-100 rounded-xl overflow-hidden">
                  <Panel header={<span className="text-slate-400 text-xs font-bold uppercase tracking-wider">技术详情 (调试用)</span>} key="1">
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-red-600 font-mono text-xs mb-2 font-bold">{this.state.error?.toString()}</p>
                      <pre className="text-[10px] text-slate-400 font-mono overflow-auto max-h-40 custom-scrollbar">
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </div>
                  </Panel>
                </Collapse>
              </div>
            </Result>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

/**
 * 简单的错误提示组件
 */
export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <div className="text-4xl mb-3">⚠️</div>
      <h3 className="text-lg font-semibold text-red-800 mb-2">出错了</h3>
      <p className="text-red-600 mb-4">{message || '加载失败，请重试'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded transition-colors"
        >
          重试
        </button>
      )}
    </div>
  )
}

/**
 * 空状态组件
 */
export function EmptyState({ icon = '📭', title = '暂无数据', description, action }) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 mb-4">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  )
}
