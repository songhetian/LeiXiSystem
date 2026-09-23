import { getToken } from './api';

/**
 * 用登录令牌下载导出文件。
 * 后端导出端点返回二进制流，无法用 <a href> 直接携带 Authorization 头，
 * 因此用 fetch 拉取 Blob，再解析 Content-Disposition 的文件名触发浏览器下载。
 */
export async function downloadExport(pathWithQuery: string): Promise<void> {
  const token = getToken();
  const res = await fetch(pathWithQuery, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('导出失败，请稍后重试');
  const blob = await res.blob();
  // 优先取 RFC5987 的 filename*=UTF-8''…（保留中文名）
  const dispo = res.headers.get('content-disposition') ?? '';
  let filename = 'export';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(dispo);
  if (star) filename = decodeURIComponent(star[1]!);
  else {
    const plain = /filename="?([^";]+)"?/i.exec(dispo);
    if (plain) filename = plain[1]!;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}