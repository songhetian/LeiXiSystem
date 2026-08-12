import { DEBUG_MODE } from './apiConfig';

/**
 * 雷犀旗舰版 统一日志管理器
 * 分级策略：
 * - debug: 开发阶段频繁输出，生产环境默认关闭
 * - info: 关键业务节点、连接成功，生产环境默认关闭
 * - warn: 警告、异常分支，生产环境开启
 * - error: 严重错误、接口失败，生产环境开启
 */

const logger = {
  debug: (...args) => {
    if (DEBUG_MODE) {
      console.debug('%c🔍 [DEBUG]', 'color: #7f8c8d; font-weight: bold', ...args);
    }
  },

  info: (...args) => {
    if (DEBUG_MODE) {
      console.info('%cℹ️ [INFO]', 'color: #2980b9; font-weight: bold', ...args);
    }
  },

  warn: (...args) => {
    console.warn('%c⚠️ [WARN]', 'color: #f39c12; font-weight: bold', ...args);
  },

  error: (...args) => {
    console.error('%c🚨 [ERROR]', 'color: #e74c3c; font-weight: bold', ...args);
  },

  // 快捷开启调试模式 (Console中使用)
  enable: () => {
    localStorage.setItem('DEBUG_MODE', 'true');
    console.log('✅ DEBUG_MODE enabled. Please refresh.');
  },

  disable: () => {
    localStorage.removeItem('DEBUG_MODE');
    console.log('🚫 DEBUG_MODE disabled. Please refresh.');
  }
};

export default logger;
