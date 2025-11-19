/**
 * 敏感词检测和过滤工具
 * Sensitive word detection and filtering utility
 */

// 敏感词词典 - 可以从后端API动态加载
const SENSITIVE_KEYWORDS = [
  '违规',
  '非法',
  '敏感',
  '政治',
  '暴力',
  '色情',
  '赌博',
  '毒品',
  // 可以添加更多敏感词
];

/**
 * 检测文本是否包含敏感词
 * @param {string} text - 要检测的文本
 * @returns {Object} { hasSensitive: boolean, words: string[] }
 */
export const detectSensitiveWords = (text) => {
  if (!text || typeof text !== 'string') {
    return { hasSensitive: false, words: [] };
  }

  const foundWords = [];
  const lowerText = text.toLowerCase();

  for (const keyword of SENSITIVE_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      foundWords.push(keyword);
    }
  }

  return {
    hasSensitive: foundWords.length > 0,
    words: foundWords,
  };
};

/**
 * 替换敏感词为星号
 * @param {string} text - 原文本
 * @returns {string} 替换后的文本
 */
export const maskSensitiveWords = (text) => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let maskedText = text;

  for (const keyword of SENSITIVE_KEYWORDS) {
    const regex = new RegExp(keyword, 'gi');
    maskedText = maskedText.replace(regex, (match) => '*'.repeat(match.length));
  }

  return maskedText;
};

/**
 * 显示敏感词警告对话框
 * @param {string[]} words - 检测到的敏感词列表
 * @returns {Promise<boolean>} 用户是否确认发送
 */
export const showSensitiveWordWarning = (words) => {
  return new Promise((resolve) => {
    const message = `检测到可能包含敏感词：${words.join('、')}\n\n是否仍要发送此消息？`;
    const confirmed = window.confirm(message);
    resolve(confirmed);
  });
};

/**
 * 高亮显示文本中的敏感词
 * @param {string} text - 原文本
 * @returns {string} 带HTML标记的文本
 */
export const highlightSensitiveWords = (text) => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let highlightedText = text;

  for (const keyword of SENSITIVE_KEYWORDS) {
    const regex = new RegExp(`(${keyword})`, 'gi');
    highlightedText = highlightedText.replace(
      regex,
      '<span style="background-color: #ffeb3b; color: #d32f2f;">$1</span>'
    );
  }

  return highlightedText;
};

/**
 * 从服务器加载敏感词词典
 * @param {string} apiUrl - API地址
 * @returns {Promise<string[]>}
 */
export const loadSensitiveWordsFromServer = async (apiUrl) => {
  try {
    const response = await fetch(apiUrl);
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.words)) {
        // 更新本地词典
        SENSITIVE_KEYWORDS.length = 0;
        SENSITIVE_KEYWORDS.push(...data.words);
        return data.words;
      }
    }
  } catch (error) {
    console.error('加载敏感词词典失败:', error);
  }
  return SENSITIVE_KEYWORDS;
};

export default {
  detectSensitiveWords,
  maskSensitiveWords,
  showSensitiveWordWarning,
  highlightSensitiveWords,
  loadSensitiveWordsFromServer,
};
