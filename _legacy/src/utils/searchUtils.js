import { pinyin } from 'pinyin-pro';

/**
 * 判断字符串是否包含搜索关键字（支持中文、拼音、首字母）
 * @param {string} text - 待搜索的文本（通常是姓名、名称等）
 * @param {string} keyword - 搜索关键字
 * @returns {boolean} - 是否匹配
 */
export const matchPinyin = (text, keyword) => {
  if (!keyword || keyword.trim() === '') return true;
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase().trim();
  
  // 1. 直接匹配 (包含中文直接匹配)
  if (lowerText.includes(lowerKeyword)) return true;
  
  // 2. 拼音全拼匹配 (如: kuaiji)
  const fullPinyin = pinyin(text, { toneType: 'none', type: 'array' }).join('').toLowerCase();
  if (fullPinyin.includes(lowerKeyword)) return true;
  
  // 3. 拼音首字母匹配 (如: kj)
  const firstLetters = pinyin(text, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();
  if (firstLetters.includes(lowerKeyword)) return true;
  
  return false;
};

/**
 * Ant Design Select 组件的 filterOption 增强版
 */
export const filterOptionWithPinyin = (input, option) => {
  const label = option?.label || option?.children;
  if (typeof label !== 'string') return false;
  return matchPinyin(label, input);
};

export default {
  matchPinyin,
  filterOptionWithPinyin
};
