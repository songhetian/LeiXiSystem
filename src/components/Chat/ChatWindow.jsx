import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeftIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { throttle, smoothScrollTo } from '../../utils/performanceUtils';

const ChatWindow = ({
  selectedConversation,
  messages,
  renderMessage,
  typingUsers,
  userId,
  searchResults,
  searchQuery,
  onReply,
  onClearHistory,
  onLoadMoreMessages,
  hasMoreMessages,
  isLoadingMessages
}) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showBackToBottom, setShowBackToBottom] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // 平滑滚动到底部
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (messagesEndRef.current) {
      smoothScrollTo(messagesEndRef.current, { behavior });
    }
  }, []);

  // 自动滚动到底部（仅当用户没有手动滚动时）
  useEffect(() => {
    if (!isUserScrolling) {
      // 添加小延迟确保DOM已更新
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [messages, typingUsers, searchResults, isUserScrolling, scrollToBottom]);

  // 节流的滚动处理函数
  const handleScroll = useCallback(
    throttle(() => {
      if (messagesContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowBackToBottom(!isNearBottom);
        setIsUserScrolling(!isNearBottom);
      }
    }, 200),
    []
  );

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // 高亮搜索文本
  const highlightText = (text, highlight) => {
    if (!highlight) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200">{part}</mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  if (!selectedConversation) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
        <div className="text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg">选择一个会话开始聊天</p>
        </div>
      </div>
    );
  }

  const getTypingUsers = () => {
    const typingUserIds = Object.keys(typingUsers).filter(
      (id) => typingUsers[id] && parseInt(id) !== userId
    );
    if (typingUserIds.length === 0) return null;
    const names = typingUserIds.map(id => `用户 ${id}`).join(', ');
    return `${names} 正在输入...`;
  };

  return (
    <div className="wechat-chat-window">
      {/* 微信风格头部 */}
      <div className="wechat-header">
        <button
          className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-800"
          onClick={() => window.history.back()}
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
        <h2 className="wechat-header-title">
          {selectedConversation.name || '未知会话'}
        </h2>
        <div className="flex items-center space-x-2">
          <button
            className="p-2 text-gray-500 hover:text-gray-700"
            onClick={onClearHistory}
            title="清空聊天记录"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            className="p-2 text-gray-500 hover:text-gray-700"
            title="会话信息"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 消息区域 */}
      <div
        ref={messagesContainerRef}
        className="wechat-messages-area"
      >
        {/* 加载更多按钮 */}
        {isLoadingMessages && (
          <div className="flex justify-center mb-4">
            <p className="text-gray-500 text-sm">加载中...</p>
          </div>
        )}
        {hasMoreMessages && !searchQuery && (
          <div className="flex justify-center mb-4">
            <button
              onClick={onLoadMoreMessages}
              className="px-4 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-50 text-sm border border-gray-200"
            >
              加载更多消息
            </button>
          </div>
        )}

        {/* 搜索结果显示 */}
        {searchQuery && searchResults.length > 0 ? (
          <div className="flex flex-col">
            <p className="text-center text-gray-600 text-sm mb-4">
              找到 {searchResults.length} 条结果 "{searchQuery}"
            </p>
            {searchResults.map((message) => (
              <div key={message.id} className="mb-2 p-3 bg-white rounded-lg shadow-sm">
                <p className="text-xs text-gray-500 mb-1">
                  {message.sender_name} · {new Date(message.created_at).toLocaleString()}
                </p>
                <p className="text-sm">{highlightText(message.content, searchQuery)}</p>
              </div>
            ))}
          </div>
        ) : searchQuery && searchResults.length === 0 ? (
          <p className="text-center text-gray-600 text-sm">未找到 "{searchQuery}" 的相关结果</p>
        ) : (
          <>
            {messages.map((message) => renderMessage(message, onReply))}
            {getTypingUsers() && (
              <div className="flex justify-start mb-2">
                <div className="bg-white text-gray-600 text-xs px-3 py-2 rounded-full shadow-sm">
                  {getTypingUsers()}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 回到底部按钮 */}
      {showBackToBottom && (
        <button
          className="wechat-back-to-bottom"
          onClick={() => {
            setIsUserScrolling(false);
            scrollToBottom('smooth');
          }}
          title="回到底部"
        >
          <ChevronDownIcon className="h-5 w-5 text-gray-600" />
        </button>
      )}
    </div>
  );
};

export default ChatWindow;
