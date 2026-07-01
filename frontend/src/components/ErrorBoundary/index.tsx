import { Component, ReactNode } from 'react'
import { Result, Button, Typography } from '@arco-design/web-react'
import styles from './index.module.css'
const { Text } = Typography

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到错误:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/dashboard'
  }

  override render() {
    const { hasError, error } = this.state
    const { children, fallback } = this.props

    if (hasError) {
      if (fallback) {
        return fallback
      }

      return (
        <div className={styles['error-boundary']}>
          <Result
            status="error"
            title="页面加载失败"
            subTitle={error?.message || '发生了未知错误，请稍后重试'}
            extra={[
              <Button key="reload" type="primary" onClick={this.handleReload}>
                重新加载
              </Button>,
              <Button key="home" onClick={this.handleGoHome}>
                返回首页
              </Button>,
            ]}
          />
        </div>
      )
    }

    return children
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

interface AsyncErrorBoundaryProps {
  children: ReactNode
  onError?: (error: Error) => void
}

interface AsyncErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class AsyncErrorBoundary extends Component<AsyncErrorBoundaryProps, AsyncErrorBoundaryState> {
  constructor(props: AsyncErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): AsyncErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AsyncErrorBoundary] 捕获到错误:', error, errorInfo)
    this.props.onError?.(error)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  override render() {
    const { hasError, error } = this.state
    const { children } = this.props

    if (hasError) {
      return (
        <div className={styles['async-error-boundary']}>
          <Text type="error" className={styles['async-error-boundary__message']}>
            操作失败：{error?.message || '未知错误'}
          </Text>
          <Button size="small" onClick={this.handleReset}>
            重试
          </Button>
        </div>
      )
    }

    return children
  }
}
