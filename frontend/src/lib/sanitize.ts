import DOMPurify, { type Config } from 'dompurify';

/**
 * 允许的安全 HTML 标签和属性（白名单模式）。
 *
 * 仅放行富文本展示所需的最小标签集合，移除 script、iframe、
 * on* 事件属性等可被用于 XSS 的危险内容。DOMPurify 会在该
 * 白名单基础上做进一步净化（如协议校验、mXSS 防护）。
 */
const sanitizeConfig: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'u', 's', 'sub', 'sup', 'small',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span', 'figure', 'figcaption',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'style',
    'target', 'rel', 'width', 'height',
    'colspan', 'rowspan',
  ],
  ALLOW_DATA_ATTR: false,
};

/**
 * 使用 DOMPurify 净化用户提交的 HTML 内容。
 * SSR 环境下跳过净化（返回原始 HTML），客户端水合时再执行净化。
 *
 * @param dirty 待净化的原始 HTML 字符串（允许 undefined/null）
 * @returns 经过白名单过滤后的安全 HTML 字符串；输入为空时返回空字符串
 */
export function sanitizeHtml(dirty: string | undefined | null): string {
  if (!dirty) return '';
  if (typeof window === 'undefined') return '';
  return DOMPurify.sanitize(dirty, sanitizeConfig);
}
