import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PaperAirplaneIcon, FaceSmileIcon, PaperClipIcon, XMarkIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { debounce } from '../../utils/performanceUtils';

const MessageInput = ({ onSendMessage, onTyping, onImageUpload, onFileUpload, onVoiceRecord, onVideoUpload, replyToMessage, setReplyToMessage }) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // 防抖的typing事件，避免频繁触发
  const debouncedTyping = useCallback(
    debounce((isTyping) => {
      if (onTyping) onTyping(isTyping);
    }, 500),
    [onTyping]
  );

  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage({ content: message, message_type: 'text' });
      setMessage('');
      if (setReplyToMessage) setReplyToMessage(null);
      // 发送后停止typing状态
      if (onTyping) onTyping(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);
    // 使用防抖的typing事件
    debouncedTyping(value.length > 0);
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
      e.target.value = null;
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      e.target.value = null;
    }
  };

  const handleVideoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onVideoUpload(e.target.files[0]);
      e.target.value = null;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="wechat-input-container">
      {/* 回复消息提示 */}
      {replyToMessage && (
        <div className="flex items-center justify-between p-2 bg-green-50 rounded-md border-l-3 border-green-500 mb-2">
          <div className="flex items-center space-x-2">
            <ArrowUturnLeftIcon className="h-4 w-4 text-green-600" />
            <p className="text-sm text-gray-700 truncate">
              回复: {replyToMessage.content || `消息 ID: ${replyToMessage.id}`}
            </p>
          </div>
          <button onClick={() => setReplyToMessage && setReplyToMessage(null)} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 工具栏 */}
      <div className="wechat-input-toolbar">
        {/* 表情按钮 */}
        <div className="relative">
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="表情">
            <FaceSmileIcon className="h-5 w-5" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 left-0 z-50 bg-white rounded-lg shadow-lg p-3 w-64">
              <div className="grid grid-cols-8 gap-2">
                {['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨'].map((emoji, index) => (
                  <button
                    key={index}
                    className="text-2xl hover:bg-gray-100 rounded p-1"
                    onClick={() => {
                      setMessage((prevMessage) => prevMessage + emoji);
                      setShowEmojiPicker(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 文件上传 */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button onClick={() => fileInputRef.current?.click()} title="文件">
          <PaperClipIcon className="h-5 w-5" />
        </button>

        {/* 图片上传 */}
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          style={{ display: 'none' }}
          onChange={handleImageChange}
        />
        <button onClick={() => imageInputRef.current?.click()} title="图片">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        {/* 视频上传 */}
        <input
          type="file"
          accept="video/*"
          ref={videoInputRef}
          style={{ display: 'none' }}
          onChange={handleVideoChange}
        />
        <button onClick={() => videoInputRef.current?.click()} title="视频">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>

        {/* 语音录制 */}
        {onVoiceRecord && (
          <button onClick={onVoiceRecord} title="语音">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        )}
      </div>

      {/* 输入框和发送按钮 */}
      <div className="wechat-input-box">
        <textarea
          className="wechat-input-box textarea"
          rows="1"
          placeholder="请输入消息..."
          value={message}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          aria-label="消息输入框"
        />
        <button
          className="wechat-send-button"
          onClick={handleSendMessage}
          disabled={!message.trim()}
          aria-label="发送消息"
        >
          发送
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
