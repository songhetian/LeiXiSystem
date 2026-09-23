'use client';

import dynamic from 'next/dynamic';
import { Modal, Button, Space } from '@arco-design/web-react';
import { IconDownload } from '@arco-design/web-react/icon';
import { getPreviewMode, shouldUseViewer, formatFileSize, getFileExt } from '../preview';

export interface PreviewFile {
  name: string;
  mimeType: string;
  size: number;
  /** 可直接渲染/下载的 URL（图片/视频/音频/PDF 为 objectURL） */
  url: string;
  /** 原始文件二进制，供 @open-file-viewer 在线预览 Office 文档 */
  blob?: Blob;
}

interface FilePreviewModalProps {
  file: PreviewFile;
  title?: string;
  /** 默认 true；外部已条件渲染该组件。 */
  visible?: boolean;
  onClose: () => void;
}

// Office 预览器只应在客户端挂载——@open-file-viewer 依赖浏览器 API（worker/媒体能力），
// 且涉及的 CSS 仅随客户端加载，避免在 SSR/服务端导入时崩溃。
const ViewerPreview = dynamic(() => import('./ViewerPreview'), { ssr: false });

/** 非可预览类型的兜底下载卡片 */
function DownloadFallback({ file, hint }: { file: PreviewFile; hint?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: 16,
        color: '#86909c',
      }}
    >
      <div style={{ fontSize: 48, opacity: 0.4 }}>.{getFileExt(file.name)}</div>
      <div style={{ fontSize: 14 }}>{hint ?? '此文件类型不支持在线预览'}</div>
      <div style={{ fontSize: 12 }}>文件大小：{formatFileSize(file.size)}</div>
      <Button type="primary" icon={<IconDownload />} href={file.url} download={file.name}>
        下载文件
      </Button>
    </div>
  );
}

/** 文件预览模态：图片/视频/音频/PDF 用浏览器原生元素，Office 用 @open-file-viewer 在线渲染 */
export default function FilePreviewModal({ file, title, visible = true, onClose }: FilePreviewModalProps) {
  const mode = getPreviewMode(file.name, file.mimeType);

  const content = (() => {
    // Office 文档交由 @open-file-viewer 在线渲染
    if (shouldUseViewer(mode) && file.blob) {
      return (
        <ViewerPreview
          file={new File([file.blob], file.name, { type: file.mimeType })}
          name={file.name}
          mimeType={file.mimeType}
        />
      );
    }
    switch (mode) {
      case 'image':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '65vh', background: '#f7f8fa', overflow: 'auto' }}>
            <img src={file.url} alt={file.name} style={{ maxWidth: '100%', maxHeight: '100%' }} />
          </div>
        );
      case 'video':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '65vh', background: '#000' }}>
            <video controls src={file.url} style={{ maxWidth: '100%', maxHeight: '100%' }} />
          </div>
        );
      case 'audio':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh', background: '#f7f8fa' }}>
            <audio controls src={file.url} style={{ width: '80%' }} />
          </div>
        );
      case 'pdf':
        return (
          <iframe
            key={file.url}
            src={`${file.url}#toolbar=1&navpanes=0`}
            title={file.name}
            style={{ width: '100%', height: '65vh', border: 'none', background: '#fff' }}
          />
        );
      case 'unsupported':
      default:
        return <DownloadFallback file={file} />;
    }
  })();

  return (
    <Modal
      title={title ?? file.name}
      visible={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button type="primary" icon={<IconDownload />} href={file.url} download={file.name}>
            下载
          </Button>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
      style={{ width: 820 }}
    >
      {content}
    </Modal>
  );
}