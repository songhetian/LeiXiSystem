'use client';

import { Modal, Button, Space } from '@arco-design/web-react';
import { IconDownload } from '@arco-design/web-react/icon';
import { getPreviewMode, formatFileSize, getFileExt } from '../preview';

export interface PreviewFile {
  name: string;
  mimeType: string;
  size: number;
  /** 可直接渲染/下载的 URL（图片/视频/音频/PDF 为 objectURL） */
  url: string;
}

interface FilePreviewModalProps {
  file: PreviewFile;
  title?: string;
  /** 默认 true；外部已条件渲染该组件。 */
  visible?: boolean;
  onClose: () => void;
}

const OFFICE_UNSUPPORTED_HINT = '该 Office 文档需下载后使用本地应用查看';

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

/** 基于浏览器原生能力的内嵌文件预览模态，替代 @open-file-viewer */
export default function FilePreviewModal({ file, title, visible = true, onClose }: FilePreviewModalProps) {
  const mode = getPreviewMode(file.name, file.mimeType);

  const content = (() => {
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
      case 'office':
      case 'unsupported':
      default:
        return <DownloadFallback file={file} hint={mode === 'office' ? OFFICE_UNSUPPORTED_HINT : undefined} />;
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