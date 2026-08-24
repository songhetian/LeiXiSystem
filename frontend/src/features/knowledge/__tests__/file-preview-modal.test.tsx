import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilePreviewModal from '../components/FilePreviewModal';

describe('FilePreviewModal', () => {
  it('图片类型渲染 img 原生元素', () => {
    render(
      <FilePreviewModal
        visible
        file={{ name: 'photo.jpg', mimeType: 'image/jpeg', size: 1024, url: 'blob:xx' }}
        onClose={jest.fn()}
      />,
    );
    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('blob:xx');
  });

  it('视频类型渲染 video 原生元素', () => {
    render(
      <FilePreviewModal
        visible
        file={{ name: 'demo.mp4', mimeType: 'video/mp4', size: 2048, url: 'blob:yy' }}
        onClose={jest.fn()}
      />,
    );
    expect(document.querySelector('video')).not.toBeNull();
  });

  it('不支持的类型渲染下载兜底', () => {
    render(
      <FilePreviewModal
        visible
        file={{ name: 'archive.zip', mimeType: 'application/zip', size: 4096, url: 'blob:zz' }}
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
        file={{ name: 'archive.zip', mimeType: 'application/zip', size: 1, url: 'blob:zz' }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText(/此文件类型不支持在线预览/)).not.toBeInTheDocument();
  });
});