'use client';

import React, { useMemo, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { FileViewer } from '@open-file-viewer/react';
import {
  imagePlugin,
  pdfPlugin,
  officePlugin,
  textPlugin,
  videoPlugin,
  audioPlugin,
  archivePlugin,
} from '@open-file-viewer/core';
import type { PreviewPlugin } from '@open-file-viewer/core';
import * as pdfjsLib from 'pdfjs-dist';
import '@open-file-viewer/core/style.css';

interface ViewerProps {
  file: Blob;
  fileName: string;
  mimeType?: string;
}

/**
 * ErrorBoundary 包裹 FileViewer，插件加载失败时显示 fallback UI，
 * 避免整个页面白屏。Next.js 中 ErrorBoundary 需要用 class component。
 */
class ViewerErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FileViewer 加载失败:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: '#f53f3f' }}>
          文件预览失败，请下载查看
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Viewer({ file, fileName, mimeType }: ViewerProps) {
  const plugins = useMemo<PreviewPlugin[]>(() => {
    // 使用本地 worker（public 静态路径），避免内网环境无法访问 CDN，
    // 且不参与 webpack 打包，避免 ESM-only pdfjs 被内联压缩而构建失败。
    const workerSrc = '/pdfjs/pdf.worker.min.mjs';

    return [
      imagePlugin(),
      pdfPlugin({
        pdfjs: pdfjsLib,
        workerSrc,
      }),
      officePlugin(),
      textPlugin(),
      videoPlugin(),
      audioPlugin(),
      archivePlugin(),
    ];
  }, []);

  return (
    <ViewerErrorBoundary>
      <FileViewer
        file={file}
        fileName={fileName}
        mimeType={mimeType}
        plugins={plugins}
        theme="light"
        toolbar
        width="100%"
        height="100vh"
        locale="zh-CN"
      />
    </ViewerErrorBoundary>
  );
}
