import React from 'react';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

const TextMessage = ({ message, isSender, onReply, onForward, onCollect, isNew }) => {
  const messageClass = isSender
    ? 'bg-blue-500 text-white rounded-br-none'
    : 'bg-gray-200 text-gray-800 rounded-bl-none';

  const containerClass = isSender ? 'justify-end' : 'justify-start';
  const animationClass = isNew ? 'animate-fade-in' : '';

  return (
    <div className={`flex ${containerClass}`}>
      <div className={`p-3 rounded-lg max-w-xs break-words ${messageClass} relative ${animationClass}`}>
        {message.reply_to_message_id && (
          <div className="bg-gray-300 text-gray-700 text-xs p-2 rounded-md mb-2 border-l-4 border-blue-500">
            <p className="font-semibold">Replying to:</p>
            <p className="truncate">{message.reply_to_message_content || 'Original message'}</p>
          </div>
        )}
        <p className="text-sm">{message.content}</p>
        <div className="flex justify-between items-center mt-1">
          <span className={`text-xs ${isSender ? 'text-blue-200' : 'text-gray-500'}`}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isSender && onReply && (
            <button
              className="text-xs text-gray-400 hover:text-gray-600 ml-2"
              onClick={() => onReply(message)}
              title="Reply"
            >
              <ArrowUturnLeftIcon className="h-4 w-4" />
            </button>
          )}
          {onForward && (
            <button
              className="text-xs text-gray-400 hover:text-gray-600 ml-2"
              onClick={() => onForward(message)}
              title="Forward"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
            </button>
          )}
          {onCollect && (
            <button
              className="text-xs text-gray-400 hover:text-gray-600 ml-2"
              onClick={() => onCollect(message.id)}
              title="Collect"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.05 11.05H12a1 1 0 001-1V3a1 1 0 00-1-1h-1a1 1 0 00-1 1v7a1 1 0 001 1zm-3.95 0H7a1 1 0 00-1 1v7a1 1 0 001 1h1a1 1 0 001-1v-7a1 1 0 00-1-1zm7.9 0h-1a1 1 0 00-1 1v7a1 1 0 001 1h1a1 1 0 001-1v-7a1 1 0 00-1-1z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TextMessage;