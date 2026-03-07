import { io } from 'socket.io-client'
import { getWsBaseUrl } from '../utils/apiConfig'
import logger from '../utils/logger'

/**
 * WebSocket管理器
 * 负责管理WebSocket连接、事件监听和消息推送
 */
class WebSocketManager {
  constructor() {
    this.socket = null
    this.listeners = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.isConnecting = false
  }

  /**
   * 连接到WebSocket服务器
   * @param {Object} options - 连接配置
   */
  connect(options = {}) {
    if (this.socket?.connected || this.isConnecting) {
      logger.debug('⚠️ [WebSocket] 已连接或正在连接中')
      return
    }

    const token = options.token || localStorage.getItem('token')
    if (!token) {
      logger.warn('⚠️ [WebSocket] 未登录，无法连接')
      return
    }

    this.isConnecting = true

    // 获取 WebSocket 服务器绝对 URL（Socket.IO 不支持相对路径）
    const WS_BASE_URL = getWsBaseUrl()

    logger.info(`🔌 [WebSocket] 正在连接到 ${WS_BASE_URL}...`)

    this.socket = io(WS_BASE_URL, {
      auth: { 
        token,
        avatar: options.avatar || null
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 10000
    })

    // 连接成功
    this.socket.on('connected', (data) => {
      logger.info('✅ [WebSocket] 连接成功:', data.message)
      this.isConnecting = false
      this.reconnectAttempts = 0
      this.emit('connected', data)
    })

    // 连接事件
    this.socket.on('connect', () => {
      logger.info('✅ [WebSocket] Socket已连接')
      this.isConnecting = false
    })

    // 新通知
    this.socket.on('new_notification', (notification) => {
      logger.debug('📨 [WebSocket] 收到新通知:', notification)
      this.emit('notification', notification)
    })

    // 新备忘录
    this.socket.on('new_memo', (memo) => {
      logger.debug('📝 [WebSocket] 收到新备忘录:', memo)
      this.emit('memo', memo)
    })

    // 新广播
    this.socket.on('new_broadcast', (broadcast) => {
      logger.debug('📣 [WebSocket] 收到系统广播:', broadcast)
      this.emit('broadcast', broadcast)
    })

    // 在线用户数更新
    this.socket.on('online_users_count', (data) => {
      this.emit('online_users_count', data)
    })

    // 下线指令
    this.socket.on('kicked_out', (data) => {
      logger.warn('🚨 [WebSocket] 收到下线指令:', data.message)
      this.emit('kicked_out', data)
    })

    // 未读数更新
    this.socket.on('unread_count', (data) => {
      this.emit('unread_count', data)
    })

    // --- 新增聊天相关监听 ---
    
    // 收到新消息
    this.socket.on('receive_message', (msg) => {
      logger.debug('💬 [WebSocket] 收到新消息:', msg)
      this.emit('chat_message', msg)
    })

    // 群成员变动
    this.socket.on('member_update', (data) => {
      logger.debug('👥 [WebSocket] 群成员变动:', data)
      this.emit('member_update', data)
    })

    // 未读计数精准更新
    this.socket.on('unread_count_update', (data) => {
      this.emit('unread_count_update', data)
    })

    // Pong响应
    this.socket.on('pong', (data) => {
      // logger.debug('🏓 [WebSocket] Pong received')
    })

    // 连接错误
    this.socket.on('connect_error', (error) => {
      logger.error('❌ [WebSocket] 连接失败:', error.message)
      this.isConnecting = false
      this.reconnectAttempts++

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error('❌ [WebSocket] 达到最大重连次数，停止重连')
        this.emit('connection_failed', { error: error.message })
      }
    })

    // 断开连接
    this.socket.on('disconnect', (reason) => {
      logger.warn('❌ [WebSocket] 连接已断开:', reason)
      this.isConnecting = false
      this.emit('disconnected', { reason })
    })

    // 重连尝试
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      logger.info(`🔄 [WebSocket] 尝试重连 (${attemptNumber}/${this.maxReconnectAttempts})...`)
    })

    // 重连成功
    this.socket.on('reconnect', (attemptNumber) => {
      logger.info(`✅ [WebSocket] 重连成功 (尝试次数: ${attemptNumber})`)
      this.reconnectAttempts = 0
      this.emit('reconnected', { attemptNumber })
    })

    // 重连失败
    this.socket.on('reconnect_failed', () => {
      logger.error('❌ [WebSocket] 重连失败')
      this.emit('reconnect_failed')
    })

    // 启动心跳
    this.startHeartbeat()
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      logger.info('🔌 [WebSocket] 主动断开连接')
      this.stopHeartbeat()
      this.socket.disconnect()
      this.socket = null
      this.isConnecting = false
    }
    // 不再清除所有监听器，防止重复注册问题
    // this.listeners.clear()
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping')
      }
    }, 30000) // 30秒一次心跳
  }

  /**
   * 停止心跳检测
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * 请求未读通知数
   */
  requestUnreadCount() {
    if (this.socket?.connected) {
      this.socket.emit('request_unread_count')
    }
  }

  /**
   * 注册事件监听器
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * 移除指定事件的所有监听器
   * @param {string} event - 事件名称
   */
  removeAllListeners(event) {
    if (this.listeners.has(event)) {
      this.listeners.delete(event)
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`❌ [WebSocket] 事件处理错误 (${event}):`, error)
        }
      })
    }
  }

  /**
   * 检查是否已连接
   * @returns {boolean}
   */
  isConnected() {
    return this.socket?.connected || false
  }
}

// 创建单例实例
export const wsManager = new WebSocketManager()

// 导出类供测试使用
export { WebSocketManager }
