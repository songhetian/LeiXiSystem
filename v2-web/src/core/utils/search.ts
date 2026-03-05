import { pinyin } from 'pinyin-pro';

/**
 * 判断字符串是否包含搜索关键字（支持中文、拼音、首字母）
 */
export const matchPinyin = (text: string, keyword: string): boolean => {
  if (!keyword || keyword.trim() === '') return true;
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase().trim();
  
  // 1. 直接匹配
  if (lowerText.includes(lowerKeyword)) return true;
  
  // 2. 拼音全拼匹配
  const fullPinyin = pinyin(text, { toneType: 'none', type: 'array' }).join('').toLowerCase();
  if (fullPinyin.includes(lowerKeyword)) return true;
  
  // 3. 拼音首字母匹配
  const firstLetters = pinyin(text, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();
  if (firstLetters.includes(lowerKeyword)) return true;
  
  return false;
};
