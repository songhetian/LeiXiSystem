import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilePreviewModal from '../components/FilePreviewModal';

// 桩替换 @open-file-viewer：单测只验证组件分支，不渲染真实的预览器。
jest.mock('@open-file-viewer/react', () => ({
  FileViewer: (props: any) => (
    <div data-testid="file-viewer">
      office-viewer:{props.fileName}
    </div>
  ),
}));

jest.mock('@open-file-viewer/core', () => ({
  officePlugin: () => ({ name: 'office-plugin-mock' }),
}));

describe('FilePreviewModal', () => {
  it('图片类型渲染 img 原生元素', () => {
    render(
      <FilePreviewModal
        visible
        file={{ name: 'photo.jpg', mimeType: 'image/jpeg', size: 1024, url: 'blob:xx', blob: new Blob([]) }}
        onClose={jest.fn()}
      />,
    );
    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('blob:xx');
    // 图片不接第三方预览器
    expect(screen.queryByTestId('file-viewer')).not.toBeInTheDocument();
  });

  it('视频类型渲染 video 原生元素', () => {
    render(
      <FilePreviewModal
        visible
        file={{ name: 'demo.mp4', mimeType: 'video/mp4', size: 2048, url: 'blob:yy', blob: new Blob([]) }}
        onClose={jest.fn()}
      />,
    );
    expect(document.querySelector('video')).not.toBeNull();
  });

  it('Office 文档（docx/pptx/xlsx）走 @open-file-viewer 在线渲染', async () => {
    render(
      <FilePreviewModal
        visible
        file={{ name: '合同.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1024, url: 'blob:off', blob: new Blob(['x']) }}
        onClose={jest.fn()}
      />,
    );
    // dynamic ssr:false 的 ViewerPreview 异步加载，需等待真实渲染
    expect(await screen.findByTestId('file-viewer')).toBeInTheDocument();
    expect(await screen.findByText('office-viewer:合同.docx')).toBeInTheDocument();
  });

  it('不支持的类型渲染下载兜底', () => {
    render(
      <FilePreviewModal
        visible
        file={{ name: 'archive.zip', mimeType: 'application/zip', size: 4096, url: 'blob:zz', blob: new Blob([]) }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText(/此文件类型不支持在线预览/)).toBeInTheDocument();
    const link = screen.getByText('下载文件');
    expect(link).not.toBeNull();
  });

  it('不可见时不渲染内容', () => {
    render(
      <FilePreviewModal
        visible={false}
        file={{ name: 'archive.zip', mimeType: 'application/zip', size: 1, url: 'blob:zz', blob: new Blob([]) }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText(/此文件类型不支持在线预览/)).not.toBeInTheDocument();
  });
});