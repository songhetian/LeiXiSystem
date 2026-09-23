'use client';

import { useMemo } from 'react';
import { FileViewer } from '@open-file-viewer/react';
import { officePlugin } from '@open-file-viewer/core';
import '@open-file-viewer/core/style.css';

interface ViewerPreviewProps {
  file: File;
  name: string;
  mimeType: string;
}

/**
 * 由 @open-file-viewer 提供的 Office 在线预览。
 * 标准 docx/xlsx/pptx 在浏览器端直渲染，无需公网地址 / 微软在线服务。
 * 请注意：本组件仅应在客户端挂载（在 FilePreviewModal 中经 dynamic ssr:false 懒加载）。
 */
export default function ViewerPreview({ file, name, mimeType }: ViewerPreviewProps) {
  const plugins = useMemo(() => [officePlugin()], []);
  return (
    <FileViewer
      file={file}
      fileName={name}
      mimeType={mimeType}
      plugins={plugins}
      width="100%"
      height="62vh"
      fit="contain"
      toolbar
      theme="light"
    />
  );
}