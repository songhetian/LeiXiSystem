import React, { useState } from 'react';

const FileMessage = ({ message, isSender, onReply, onForward, onCollect, isNew, onRecall, onDelete }) => {
  const [showActions, setShowActions] = useState(false);

  const containerClass = isSender ? 'sender' : 'receiver';

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (!bytes) return '未知大小';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 获取文件图标
  const getFileIcon = (fileName) => {
    if (!fileName) return '📄';
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
      pdf: '📕',
      doc: '📘',
      docx: '📘',
      xls: '📗',
      xlsx: '📗',
      ppt: '📙',
      pptx: '📙',
      zip: '🗜️',
      rar: '🗜️',
      txt: '📝',
      jpg: '🖼️',
      jpeg: '🖼️',
      png: '🖼️',
      gif: '🖼️',
      mp3: '🎵',
      mp4: '🎬',
    };
    return iconMap[ext] || '📄';
  };

  return (
    <div
      className={`wechat-message-container ${containerClass}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="relative">
        <a
          href={message.file_url}
          download={message.file_name}
          className="block bg-white rounded-lg p-3 max-w-xs hover:bg-gray-50 transition-colors border border-gray-200"
        >
          <div className="flex items-center space-x-3">
            <div className="text-3xl flex-shrink-0">
              {getFileIcon(message.file_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {message.file_name || '未知文件'}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(message.file_size)}
              </p>
            </div>
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
          </div>
        </a>

        {/* 时间戳 */}
        <span className="wechat-timestamp block mt-1">
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        {/* 操作按钮 */}
        {showActions && (
          <div className={`wechat-message-actions ${isSender ? 'right-full mr-2' : 'left-full ml-2'}`}>
            {!isSender && onReply && (
              <button onClick={() => onReply(message)} title="回复">回复</button>
            )}
            {isSender && onRecall && (
              <button onClick={() => onRecall(message.id)} title="撤回">撤回</button>
            )}
            {isSender && onDelete && (
              <button onClick={() => onDelete(message.id)} title="删除">删除</button>
            )}
            {onForward && (
              <button onClick={() => onForward(message)} title="转发">转发</button>
            )}
            {onCollect && (
              <button onClick={() => onCollect(message.id)} title="收藏">收藏</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileMessage;
