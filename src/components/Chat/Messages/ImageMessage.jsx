import React, { useState, useEffect, useRef } from 'react';

const ImageMessage = ({ message, isSender, onReply, onForward, onCollect, isNew, onRecall, onDelete }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const imgRef = useRef(null);

  const containerClass = isSender ? 'sender' : 'receiver';

  // 使用IntersectionObserver实现懒加载
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsLoaded(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        className={`wechat-message-container ${containerClass}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="relative">
          <div
            ref={imgRef}
            className="rounded-lg overflow-hidden cursor-pointer max-w-xs"
            onClick={() => setShowPreview(true)}
          >
            {!isLoaded ? (
              <div className="wechat-loading-skeleton w-48 h-48 rounded-lg"></div>
            ) : (
              <img
                src={message.file_url}
                alt="图片消息"
                className="max-w-full h-auto rounded-lg"
                loading="lazy"
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

      {/* 图片预览模态框 */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={() => setShowPreview(false)}
        >
          <img
            src={message.file_url}
            alt="图片预览"
            className="max-w-full max-h-full object-contain"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setShowPreview(false)}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
};

export default ImageMessage;
