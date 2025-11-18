import React, { useState, useRef } from 'react';
import { PaperAirplaneIcon, FaceSmileIcon, PaperClipIcon } from '@heroicons/react/24/outline';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { Picker } from 'emoji-mart';
import data from 'emoji-mart/data/apple.json'; // Or any other emoji data

const MessageInput = ({ onSendMessage, onTyping, onImageUpload, onFileUpload, onVoiceRecord, onVideoUpload, replyToMessage, setReplyToMessage }) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage({ content: message, type: 'text' });
      setMessage('');
      setReplyToMessage(null); // Clear reply message after sending
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    onTyping(e.target.value.length > 0); // Emit typing status
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
      e.target.value = null; // Clear the input for next upload
    }
  };

  const handleVideoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onVideoUpload(e.target.files[0]);
      e.target.value = null; // Clear the input for next upload
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center space-x-2 mb-2">
        {/* Emoji Selector Button */}
        <div className="relative">
          <button className="p-2 text-gray-500 hover:text-gray-700" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
            <FaceSmileIcon className="h-6 w-6" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 left-0 z-10">
              <Picker
                set="apple" // Or any other set
                data={data}
                onSelect={(emoji) => {
                  setMessage((prevMessage) => prevMessage + emoji.native);
                  setShowEmojiPicker(false);
                }}
                style={{ position: 'absolute', bottom: '100%', left: '0' }}
                theme="light"
              />
            </div>
          )}
        </div>
        {/* File Upload Button */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button className="p-2 text-gray-500 hover:text-gray-700" onClick={() => fileInputRef.current.click()}>
          <PaperClipIcon className="h-6 w-6" />
        </button>
        {/* Image Upload Button */}
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          style={{ display: 'none' }}
          onChange={handleImageChange}
        />
        <button className="p-2 text-gray-500 hover:text-gray-700" onClick={() => imageInputRef.current.click()}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        {/* Video Upload Button */}
        <input
          type="file"
          accept="video/*"
          ref={videoInputRef}
          style={{ display: 'none' }}
          onChange={handleVideoChange}
        />
        <button className="p-2 text-gray-500 hover:text-gray-700" onClick={() => videoInputRef.current.click()}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        {/* Voice Record Button */}
        <button className="p-2 text-gray-500 hover:text-gray-700" onClick={onVoiceRecord}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      </div>
      {replyToMessage && (
        <div className="flex items-center justify-between p-2 bg-blue-100 rounded-t-md border-b border-blue-200 -mt-2">
          <div className="flex items-center space-x-2">
            <ArrowUturnLeftIcon className="h-4 w-4 text-blue-600" />
            <p className="text-sm text-blue-800 truncate">
              Replying to: {replyToMessage.content || `Message ID: ${replyToMessage.id}`}
            </p>
          </div>
          <button onClick={() => setReplyToMessage(null)} className="text-blue-600 hover:text-blue-800">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center space-x-2">
        <textarea
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows="1"
          placeholder="Type your message..."
          value={message}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          aria-label="Message input"
        />
        <button
          className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={handleSendMessage}
          disabled={!message.trim()}
          aria-label="Send message"
        >
          <PaperAirplaneIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;