import React, { useState } from 'react';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

const TextMessage = ({ message, isSender, onReply, onForward, onCollect, isNew, onRecall, onDelete }) => {
  const [showActions, setShowActions] = useState(false);

  const containerClass = isSender ? 'sender' : 'receiver';
  const bubbleClass = isSender ? 'sender' : 'receiver';

  // 检查消息是否被撤回
  const isRecalled = message.is_recalled === 1 || message.content === '这条消息已被撤回';

  return (
    <div
      className={`wechat-message-container ${containerClass}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* 消息气泡 */}
      <div className={`wechat-message-bubble ${bubbleClass} relative`}>
        {/* 回复引用 */}
        {message.reply_to_message_id && !isRecalled && (
          <div className="wechat-reply-indicator">
            <p className="font-semibold text-xs">回复:</p>
            <p className="truncate text-xs">{message.reply_to_message_content || '原始消息'}</p>
          </div>
        )}

        {/* 消息内容 */}
        <p className={`text-sm ${isRecalled ? 'italic text-gray-500' : ''}`}>
          {message.content}
        </p>

        {/* 时间戳 */}
        <span className="wechat-timestamp">
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        {/* 操作按钮 - 悬停时显示 */}
        {showActions && !isRecalled && (
          <div className={`wechat-message-actions ${isSender ? 'right-full mr-2' : 'left-full ml-2'}`}>
            {!isSender && onReply && (
              <button
                onClick={() => onReply(message)}
                title="回复"
              >
                回复
              </button>
            )}
            {isSender && onRecall && (
              <button
                onClick={() => onRecall(message.id)}
                title="撤回"
              >
                撤回
              </button>
            )}
            {isSender && onDelete && (
              <button
                onClick={() => onDelete(message.id)}
                title="删除"
              >
                删除
              </button>
            )}
            {onForward && (
              <button
                onClick={() => onForward(message)}
                title="转发"
              >
                转发
              </button>
            )}
            {onCollect && (
              <button
                onClick={() => onCollect(message.id)}
                title="收藏"
              >
                收藏
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TextMessage;
