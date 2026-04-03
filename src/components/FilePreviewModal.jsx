import React, { useState, useRef, useEffect } from 'react';
import { formatDate } from '../utils/date'

const FilePreviewModal = ({ file, onClose, getFileIcon, formatFileSize, modalWidth, setModalWidth, modalHeight, setModalHeight }) => {
  if (!file) return null;

  const [isMaximized, setIsMaximized] = useState(false);
  const modalRef = useRef(null);
  
  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const isPdf = file.type?.includes('pdf');
  const isPpt = file.type?.includes('presentation') || file.name?.match(/\.(ppt|pptx)$/i);

  // 如果没有传递调整宽高的状态，则使用内部状态
  const [internalModalWidth, internalSetModalWidth] = useState('max-w-6xl');
  const [internalModalHeight, internalSetModalHeight] = useState('max-h-[95vh]');
  const [savedDimensions, setSavedDimensions] = useState({
    width: modalWidth || 'max-w-6xl',
    height: modalHeight || 'max-h-[95vh]'
  });

  const actualModalWidth = isMaximized ? 'w-screen' : (modalWidth || internalModalWidth);
  const actualModalHeight = isMaximized ? 'h-screen' : (modalHeight || internalModalHeight);
  const setActualModalWidth = setModalWidth || internalSetModalWidth;
  const setActualModalHeight = setModalHeight || internalSetModalHeight;

  // 处理全屏切换
  const toggleMaximize = () => {
    if (!isMaximized) {
      // 保存当前尺寸
      setSavedDimensions({
        width: actualModalWidth,
        height: actualModalHeight
      });
    } else {
      // 恢复保存的尺寸
      setActualModalWidth(savedDimensions.width);
      setActualModalHeight(savedDimensions.height);
    }
    setIsMaximized(!isMaximized);
  };

  // 处理ESC键退出全屏
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMaximized) {
        toggleMaximize();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${actualModalWidth} ${actualModalHeight} flex flex-col overflow-hidden border border-slate-200`}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">{file.name}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                {getFileIcon ? getFileIcon(file.type) : '📄'} {file.type}
              </span>
              <span className="inline-flex items-center gap-1">
                📅 {formatDate(new Date())}
              </span>
              <span className="inline-flex items-center gap-1">
                📦 {formatFileSize ? formatFileSize(file.size) : `${((file.size || 0) / 1024).toFixed(2)} KB`}
              </span>
              {isPdf && <span>PDF 预览</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {!isMaximized && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const widths = ['max-w-4xl', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl']
                      const currentIndex = widths.indexOf(actualModalWidth)
                      const nextIndex = (currentIndex + 1) % widths.length
                      setActualModalWidth(widths[nextIndex])
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all text-sm"
                    title="调整宽度"
                  >
                    ↔️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const heights = ['max-h-[90vh]', 'max-h-[95vh]', 'max-h-[98vh]']
                      const currentIndex = heights.indexOf(actualModalHeight)
                      const nextIndex = (currentIndex + 1) % heights.length
                      setActualModalHeight(heights[nextIndex])
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all text-sm"
                    title="调整高度"
                  >
                    ↕️
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMaximize();
                }}
                className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all text-sm"
                title={isMaximized ? "恢复窗口" : "最大化"}
              >
                {isMaximized ? '⛶' : '⛶'}
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all ml-2 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {isImage && (
            <div className="flex flex-col items-center justify-center h-full">
              <img
                src={file.url}
                alt={file.name}
                className="max-w-full h-auto max-h-[70vh] border border-slate-200 bg-white"
              />
            </div>
          )}
          {isVideo && (
            <div className="flex flex-col items-center justify-center h-full">
              <video
                controls
                className="max-w-full h-auto max-h-[70vh] border border-slate-200 bg-black"
              >
                <source src={file.url} type={file.type} />
                您的浏览器不支持视频播放
              </video>
            </div>
          )}
          {isPdf && (
            <div className="h-full min-h-[72vh] border border-slate-200 bg-white">
              <iframe
                key={file.url}
                src={`${file.url}#toolbar=1&navpanes=0&scrollbar=1`}
                className="w-full h-full min-h-[72vh] border-0"
                title={file.name}
              />
            </div>
          )}
          {isPpt && (
            <div className="flex flex-col h-full border border-slate-200 bg-white">
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`}
                className="w-full h-full min-h-[70vh]"
                frameBorder="0"
                title={file.name}
              />
            </div>
          )}
          {!isImage && !isVideo && !isPdf && !isPpt && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white border border-slate-200">
              <div className="text-6xl mb-4">
                {getFileIcon ? getFileIcon(file.type) : '📄'}
              </div>
              <div className="text-lg font-semibold text-slate-900 mb-2">{file.name}</div>
              <div className="text-sm text-slate-600 mb-4">此文件类型不支持在线预览</div>
              <div className="text-sm text-slate-500 mb-6">
                文件大小: {formatFileSize ? formatFileSize(file.size) : `${(file.size / 1024).toFixed(2)} KB`}
              </div>
              <a
                href={file.url}
                download={file.name}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all text-sm font-medium"
              >
                📥 下载文件
              </a>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-white">
          <div className="text-xs text-slate-500">
            文件大小：{formatFileSize ? formatFileSize(file.size) : `${(file.size / 1024).toFixed(2)} KB`}
          </div>
          <div className="flex gap-4">
            <a
              href={file.url}
              download={file.name}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all text-sm"
            >
              📥 下载
            </a>
            {isPdf && (
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-all text-sm"
              >
                新窗口打开
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-all text-sm"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
