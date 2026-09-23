import { getPreviewMode } from '../preview';
import { formatFileSize, getFileExt, shouldUseViewer } from '../preview';

describe('getPreviewMode', () => {
  it('识别图片类型', () => {
    expect(getPreviewMode('photo.jpg', 'image/jpeg')).toBe('image');
    expect(getPreviewMode('logo.png', 'image/png')).toBe('image');
  });

  it('识别视频类型', () => {
    expect(getPreviewMode('demo.mp4', 'video/mp4')).toBe('video');
    expect(getPreviewMode('clip.webm', 'video/webm')).toBe('video');
  });

  it('识别音频类型', () => {
    expect(getPreviewMode('voice.mp3', 'audio/mpeg')).toBe('audio');
    expect(getPreviewMode('sound.wav', 'audio/wav')).toBe('audio');
  });

  it('识别 PDF（按扩展名兜底）', () => {
    expect(getPreviewMode('report.pdf', 'application/pdf')).toBe('pdf');
    // mime 缺失时按扩展名判断
    expect(getPreviewMode('report.pdf', '')).toBe('pdf');
  });

  it('识别 Office 文档（docx/pptx/xlsx）', () => {
    expect(getPreviewMode('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('office');
    expect(getPreviewMode('b.pptx', 'application/vnd.ms-powerpoint')).toBe('office');
    expect(getPreviewMode('c.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('office');
  });

  it('不支持的扩展名类型判定为 unsupported', () => {
    expect(getPreviewMode('archive.zip', 'application/zip')).toBe('unsupported');
    expect(getPreviewMode('notes.txt', 'text/plain')).toBe('unsupported');
  });

  it('无法识别的 mime 与扩展名判定为 unsupported', () => {
    expect(getPreviewMode('unknown.foo', 'application/octet-stream')).toBe('unsupported');
    expect(getPreviewMode('', '')).toBe('unsupported');
  });
});

describe('shouldUseViewer（由 @open-file-viewer 渲染的类型）', () => {
  it('Office 文档走 @open-file-viewer 在线渲染', () => {
    expect(shouldUseViewer('office')).toBe(true);
  });
  it('图片/视频/音频仍用浏览器原生预览，不接第三方预览器', () => {
    expect(shouldUseViewer('image')).toBe(false);
    expect(shouldUseViewer('video')).toBe(false);
    expect(shouldUseViewer('audio')).toBe(false);
  });
  it('PDF 仍用浏览器原生 iframe 预览，无需 pdf.js 构建；不支持类型走下载兜底', () => {
    expect(shouldUseViewer('pdf')).toBe(false);
    expect(shouldUseViewer('unsupported')).toBe(false);
  });
});

describe('getFileExt', () => {
  it('提取小写扩展名，忽略查询参数', () => {
    expect(getFileExt('photo.PNG?sig=1')).toBe('png');
    expect(getFileExt('a.pdf')).toBe('pdf');
    expect(getFileExt('/upload/x.docx')).toBe('docx');
  });

  it('无扩展名返回空串', () => {
    expect(getFileExt('README')).toBe('');
    expect(getFileExt('')).toBe('');
  });
});

describe('formatFileSize', () => {
  it('格式化 KB/MB', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3 MB');
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});