import React, { useState } from 'react';

const VideoMessage = ({ message, isSender, onReply, onForward, onCollect, isNew, onRecall, onDelete }) => {
  const [showActions, setShowActions] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const containerClass = isSender ? 'sender' : 'receiver';

  return (
    <div
      className={`wechat-message-container ${containerClass}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="relative">
        <div className="rounded-lg overflow-hidden max-w-xs">
          {!isPlaying ? (
            // 视频封面和播放按钮
            <div
              className="relative cursor-pointer bg-black"
              onClick={() => setIsPlaying(true)}
            >
              <video
                src={message.file_url}
                className="w-full h-auto"
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                <div className="w-16 h-16 rounded-full bg-white bg-opacity-90 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            // 视频播放器
            <video
              src={message.file_url}
              controls
              autoPlay
              className="w-full h-auto rounded-lg"
            />
          )}
        </div>

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

export default VideoMessage;
