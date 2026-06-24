/**
 * 防抖函数 - 延迟执行，只执行最后一次
 * @param {Function} func - 要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export const debounce = (func, delay = 300) => {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

/**
 * 节流函数 - 限制执行频率
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * 延迟执行函数
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise}
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 平滑滚动到指定元素
 * @param {HTMLElement} element - 目标元素
 * @param {Object} options - 滚动选项
 */
export const smoothScrollTo = (element, options = {}) => {
  if (!element) return;

  const defaultOptions = {
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest',
    ...options
  };

  element.scrollIntoView(defaultOptions);
};

/**
 * 检查元素是否在视口中
 * @param {HTMLElement} element - 要检查的元素
 * @returns {boolean}
 */
export const isElementInViewport = (element) => {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

/**
 * 批量处理函数 - 收集多次调用，批量执行一次
 * @param {Function} func - 要批量执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function}
 */
export const batchProcess = (func, wait = 100) => {
  let items = [];
  let timeoutId;

  return function (item) {
    items.push(item);
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      func(items);
      items = [];
    }, wait);
  };
};

/**
 * 请求动画帧节流
 * @param {Function} func - 要执行的函数
 * @returns {Function}
 */
export const rafThrottle = (func) => {
  let rafId = null;

  return function (...args) {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, args);
        rafId = null;
      });
    }
  };
};

export default {
  debounce,
  throttle,
  delay,
  smoothScrollTo,
  isElementInViewport,
  batchProcess,
  rafThrottle
};
