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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1000] p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${actualModalWidth} ${actualModalHeight} flex flex-col`}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex-1 min-w-0">
            <h2 className="text-3xl font-bold text-gray-900 truncate">{file.name}</h2>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-base text-gray-700">
              <span className="flex items-center gap-2 text-lg">
                {getFileIcon ? getFileIcon(file.type) : '📄'} {file.type}
              </span>
              <span className="flex items-center gap-2 text-lg">
                📅 {formatDate(new Date())}
              </span>
              <span className="flex items-center gap-2 text-lg">
                � {formatFileSize ? formatFileSize(file.size) : `${(file.size / 1024).toFixed(2)} KB`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 调整宽高按钮 */}
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
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md text-lg"
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
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md text-lg"
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
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md text-lg"
                title={isMaximized ? "恢复窗口" : "最大化"}
              >
                {isMaximized ? '⛶' : '⛶'}
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-md ml-4 text-2xl"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {isImage && (
            <div className="flex flex-col items-center justify-center h-full">
              <img
                src={file.url}
                alt={file.name}
                className="max-w-full h-auto max-h-[70vh] rounded-xl shadow-lg"
              />
              <div className="mt-4 text-center">
                <p className="text-lg text-gray-700">{file.name}</p>
              </div>
            </div>
          )}
          {isVideo && (
            <div className="flex flex-col items-center justify-center h-full">
              <video
                controls
                className="max-w-full h-auto max-h-[70vh] rounded-xl shadow-lg"
              >
                <source src={file.url} type={file.type} />
                您的浏览器不支持视频播放
              </video>
              <div className="mt-4 text-center">
                <p className="text-lg text-gray-700">{file.name}</p>
              </div>
            </div>
          )}
          {isPdf && (
            <div className="flex flex-col h-full">
              <iframe
                src={file.url}
                className="w-full h-full min-h-[70vh] rounded-xl shadow-lg"
                title={file.name}
              />
              <div className="mt-4 text-center">
                <p className="text-lg text-gray-700">{file.name}</p>
              </div>
            </div>
          )}
          {isPpt && (
            <div className="flex flex-col h-full">
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`}
                className="w-full h-full min-h-[70vh] rounded-xl shadow-lg"
                frameBorder="0"
                title={file.name}
              />
              <div className="mt-4 text-center">
                <p className="text-lg text-gray-700">{file.name}</p>
                <p className="text-sm text-gray-500 mt-2">使用 Microsoft Office 在线预览</p>
              </div>
            </div>
          )}
          {!isImage && !isVideo && !isPdf && !isPpt && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white rounded-xl shadow-sm">
              <div className="text-8xl mb-6">
                {getFileIcon ? getFileIcon(file.type) : '📄'}
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-3">{file.name}</div>
              <div className="text-xl text-gray-600 mb-6">此文件类型不支持在线预览</div>
              <div className="text-lg text-gray-500 mb-8">
                文件大小: {formatFileSize ? formatFileSize(file.size) : `${(file.size / 1024).toFixed(2)} KB`}
              </div>
              <a
                href={file.url}
                download={file.name}
                className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-3 text-xl font-medium shadow-lg"
              >
                📥 下载文件
              </a>
              <p className="text-gray-500 mt-6">点击上方按钮下载文件到本地</p>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="text-lg text-gray-700">
            文件大小：{formatFileSize ? formatFileSize(file.size) : `${(file.size / 1024).toFixed(2)} KB`}
          </div>
          <div className="flex gap-4">
            <a
              href={file.url}
              download={file.name}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-3 text-lg font-medium shadow-md"
            >
              📥 下载
            </a>
            <button
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all text-lg font-medium shadow-md"
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
