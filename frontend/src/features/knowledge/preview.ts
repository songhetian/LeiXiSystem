/**
 * 文件预览工具：通过 `getPreviewMode` 判定渲染形态（image/video/audio/pdf/office/unsupported），
 * 供 FilePreviewModal 选择原生元素；Office 类型再由 `shouldUseViewer` 决定交由 @open-file-viewer 在线渲染。
 */

export type PreviewMode = 'image' | 'video' | 'audio' | 'pdf' | 'office' | 'unsupported';

const OFFICE_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
const OFFICE_MIME_KEYWORDS = ['presentation', 'wordprocessing', 'spreadsheet', 'ms-office', 'openxmlformats'];

/** 提取小写扩展名，忽略查询参数 / hash 与路径。 */
export function getFileExt(fileName: string): string {
  if (!fileName) return '';
  const clean = String(fileName).split('?')[0].split('#')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? (parts.pop() ?? '').toLowerCase() : '';
}

/** 将字节数格式化为可读大小（B/KB/MB/GB，至多 1 位小数）。 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value % 1 === 0 ? String(value) : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

/** 根据文件名/扩展名判断文件的在线预览形态；无法预览返回 unsupported。 */
export function getPreviewMode(fileName: string, mimeType: string): PreviewMode {
  const ext = getFileExt(fileName);
  const mime = (mimeType || '').toLowerCase();

  const kind = mime.split('/')[0];
  if (kind === 'image') return 'image';
  if (kind === 'video') return 'video';
  if (kind === 'audio') return 'audio';

  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';

  if (OFFICE_EXT.includes(ext) || OFFICE_MIME_KEYWORDS.some((k) => mime.includes(k))) return 'office';

  return 'unsupported';
}

/**
 * 该模式是否交由 @open-file-viewer 在浏览器端渲染。
 * 仅 Office 文档走第三方预览器（客户端直渲染，无需公网/在线服务）；
 * 图片/视频/音频/PDF 均用浏览器原生能力预览，避免引入脆弱的 pdf.js worker 构建配置。
 */
export function shouldUseViewer(mode: PreviewMode): boolean {
  return mode === 'office';
}